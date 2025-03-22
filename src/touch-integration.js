/**
 * Touch Integration
 * Connects the touch gesture system with the application functionality
 */

import { initTouchGestures, TouchUtils, GestureTypes } from './touch-gestures.js';

// Store references to cleanup functions
const cleanupFunctions = new Map();

/**
 * Initialize touch gesture handling for the waveform container
 * @param {HTMLElement} waveformContainer - The waveform container element
 * @param {Object} callbacks - Callback functions for audio control
 * @returns {Function} Cleanup function
 */
export function initWaveformTouchHandling(waveformContainer, callbacks = {}) {
  console.log('Initializing touch handling for waveform container');
  
  // Default callback functions if not provided
  const actions = {
    onTap: callbacks.onTap || function(position) {
      console.log('Tap detected at position:', position);
    },
    onDoubleTap: callbacks.onDoubleTap || function(position) {
      console.log('Double tap detected at position:', position);
    },
    onLongPress: callbacks.onLongPress || function(position) {
      console.log('Long press detected at position:', position);
    },
    onDrag: callbacks.onDrag || function(info) {
      console.log('Drag detected:', info);
    },
    onPinchZoom: callbacks.onPinchZoom || function(info) {
      console.log('Pinch zoom detected:', info);
    },
    onTwoFingerTap: callbacks.onTwoFingerTap || function(info) {
      console.log('Two finger tap detected:', info);
    }
  };
  
  // Convert event info to waveform position
  function eventToWaveformPosition(element, clientX) {
    const rect = element.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;
    return relativeX;
  }
  
  // Initialize touch gestures
  const cleanupGestures = initTouchGestures(waveformContainer, {
    debug: true, // Set to false in production
    doubleTapThreshold: 300, // ms
  }, {
    // Basic tap - positions playhead
    tap: (e, info) => {
      const position = info.position;
      const waveformPosition = eventToWaveformPosition(waveformContainer, position.x);
      
      // Call the provided tap callback
      actions.onTap({
        x: position.x,
        y: position.y,
        waveformPosition
      });
    },
    
    // Double tap - create loop region
    doubleTap: (e, info) => {
      const position = info.position;
      const waveformPosition = eventToWaveformPosition(waveformContainer, position.x);
      
      // Call the provided double tap callback
      actions.onDoubleTap({
        x: position.x,
        y: position.y,
        waveformPosition
      });
    },
    
    // Long press - show context menu
    longPress: (e, info) => {
      const position = info.position;
      const waveformPosition = eventToWaveformPosition(waveformContainer, position.x);
      
      // Call the provided long press callback
      actions.onLongPress({
        x: position.x,
        y: position.y,
        waveformPosition,
        duration: info.duration
      });
    },
    
    // Drag - scroll waveform
    drag: (e, info) => {
      const currentPosition = eventToWaveformPosition(waveformContainer, info.current.x);
      const startPosition = eventToWaveformPosition(waveformContainer, info.start.x);
      
      // Call the provided drag callback
      actions.onDrag({
        start: {
          x: info.start.x,
          y: info.start.y,
          waveformPosition: startPosition
        },
        current: {
          x: info.current.x,
          y: info.current.y,
          waveformPosition: currentPosition
        },
        delta: info.delta
      });
    },
    
    // Pinch zoom - zoom waveform
    pinchZoom: (e, info) => {
      const centerPosition = eventToWaveformPosition(waveformContainer, info.center.x);
      
      // Call the provided pinch zoom callback
      actions.onPinchZoom({
        scale: info.scale,
        center: {
          x: info.center.x,
          y: info.center.y,
          waveformPosition: centerPosition
        }
      });
    },
    
    // Two finger tap - toggle playback
    twoFingerTap: (e, info) => {
      const centerPosition = eventToWaveformPosition(waveformContainer, info.center.x);
      
      // Call the provided two finger tap callback
      actions.onTwoFingerTap({
        center: {
          x: info.center.x,
          y: info.center.y,
          waveformPosition: centerPosition
        }
      });
    }
  });
  
  // Store cleanup function for later use
  cleanupFunctions.set(waveformContainer, cleanupGestures);
  
  return cleanupGestures;
}

/**
 * Initialize touch gesture handling for UI buttons
 * @param {HTMLElement} buttonElement - The button element
 * @param {Function} onClick - Function to call when button is tapped
 * @param {Function} onLongPress - Function to call when button is long pressed
 * @returns {Function} Cleanup function
 */
export function initButtonTouchHandling(buttonElement, onClick, onLongPress) {
  console.log('Initializing touch handling for button:', buttonElement.id || buttonElement.className);
  
  // Initialize touch gestures
  const cleanupGestures = initTouchGestures(buttonElement, {
    debug: false,
    longPressThreshold: 600
  }, {
    tap: (e, info) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Button tapped:', buttonElement.id || buttonElement.className);
      
      // Trigger click handler
      if (typeof onClick === 'function') {
        onClick(e);
      }
    },
    
    longPress: (e, info) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Button long pressed:', buttonElement.id || buttonElement.className);
      
      // Trigger long press handler
      if (typeof onLongPress === 'function') {
        onLongPress(e, info.duration);
      }
    }
  });
  
  // Add visual feedback for touch
  buttonElement.addEventListener('touchstart', () => {
    buttonElement.classList.add('touch-active');
  });
  
  buttonElement.addEventListener('touchend', () => {
    buttonElement.classList.remove('touch-active');
  });
  
  buttonElement.addEventListener('touchcancel', () => {
    buttonElement.classList.remove('touch-active');
  });
  
  // Store cleanup function for later use
  cleanupFunctions.set(buttonElement, cleanupGestures);
  
  return cleanupGestures;
}

/**
 * Initialize touch handling for the recording button
 * @param {HTMLElement} recordButton - The recording button element
 * @param {Function} toggleRecording - The function that toggles recording
 * @returns {Function} Cleanup function
 */
export function initRecordButtonHandling(recordButton, toggleRecording) {
  console.log('Initializing touch handling for record button');
  
  // Add an additional handler to forcibly bypass audio context restrictions
  function handleRecordTap(e) {
    e.preventDefault();
    
    // Force the audio context to resume before toggle recording
    if (window.Tone && window.Tone.context) {
      if (window.Tone.context.state !== 'running') {
        window.Tone.context.resume().then(() => {
          console.log('Audio context resumed before recording');
          toggleRecording();
        }).catch(err => {
          console.warn('Error resuming audio context, trying anyway:', err);
          toggleRecording();
        });
      } else {
        toggleRecording();
      }
    } else {
      // If Tone.js is not available, just toggle recording directly
      toggleRecording();
    }
  }
  
  // Show recording settings on long press
  function handleRecordLongPress(e, duration) {
    console.log('Record button long pressed for', duration, 'ms');
    
    // You could show a settings dialog or additional options here
    const event = new CustomEvent('recordButtonLongPress', {
      detail: { duration, button: recordButton }
    });
    
    document.dispatchEvent(event);
  }
  
  return initButtonTouchHandling(recordButton, handleRecordTap, handleRecordLongPress);
}

/**
 * Cleanup all touch gesture handlers
 */
export function cleanupAllTouchHandlers() {
  console.log('Cleaning up all touch handlers');
  
  cleanupFunctions.forEach((cleanup, element) => {
    cleanup();
  });
  
  cleanupFunctions.clear();
}

// Re-export the imported utility functions
export { TouchUtils, GestureTypes }; 