// Import touch gesture handling
import { initWaveformTouchHandling, initRecordButtonHandling, TouchUtils } from './touch-integration.js';

// Global variables
let wavesurfer = null;
let regions = null;
let currentRegion = null;
let mediaRecorder = null;
let isRecording = false;
let recordButton = null;
let recordingChunks = [];
let touchHandlersInitialized = false;

// Export all functions that need to be accessible from outside
export {
  initWavesurfer,
  loadAudioBlob,
  toggleRecording,
  createGranulatorNode,
  connectWithExistingImplementation
};

// Add a function to connect wavesurfer to existing implementations
function connectWithExistingImplementation() {
  // This function can be called from main.js to integrate wavesurfer
  return {
    // Methods that can be used by the main code
    create: initWavesurfer,
    loadAudio: loadAudioBlob,
    getWavesurfer: () => wavesurfer,
    // Pass along any events from wavesurfer to the main code
    on: (event, callback) => {
      if (wavesurfer) {
        wavesurfer.on(event, callback);
      } else {
        console.warn("Wavesurfer not initialized when adding event listener for:", event);
        // Add event listener once wavesurfer is created
        document.addEventListener('DOMContentLoaded', () => {
          if (wavesurfer) {
            wavesurfer.on(event, callback);
          }
        });
      }
    }
  };
}

/**
 * Initialize WaveSurfer
 */
function initWavesurfer() {
  console.log('Creating WaveSurfer instance...');
  
  try {
    // Find or create container
    let waveformContainer = document.getElementById('waveform');
    if (!waveformContainer) {
      console.log('Creating waveform container element');
      waveformContainer = document.createElement('div');
      waveformContainer.id = 'waveform';
      document.body.appendChild(waveformContainer);
    }
    
    // Create wavesurfer instance
    wavesurfer = WaveSurfer.create({
      container: waveformContainer,
      waveColor: '#4F4A85',
      progressColor: '#383351',
      height: 128,
      barWidth: 2,
      responsive: true,
    });
    
    // Add regions plugin if available
    try {
      if (WaveSurfer.regions) {
        console.log('Registering regions plugin');
        regions = wavesurfer.registerPlugin(WaveSurfer.regions.create());
      } else {
        console.warn('Regions plugin not available');
      }
    } catch (e) {
      console.error('Error registering regions plugin:', e);
    }
    
    // Setup event listeners
    setupWaveformEvents(waveformContainer);
    
    // Find or create record button
    recordButton = document.getElementById('record');
    if (!recordButton) {
      console.log('Creating record button');
      recordButton = document.createElement('button');
      recordButton.id = 'record';
      recordButton.textContent = 'Record';
      recordButton.className = 'button record';
      document.body.appendChild(recordButton);
    }
    
    // Make record button work with touch
    initRecordButtonHandling(recordButton, toggleRecording);
    
    // Setup mobile optimizations
    setupMobileOptimizations();
    
    console.log('Wavesurfer initialized successfully!');
    return wavesurfer;
  } catch (e) {
    console.error('Error initializing WaveSurfer:', e);
    return null;
  }
}

/**
 * Setup waveform events
 */
function setupWaveformEvents(waveformContainer) {
  if (!wavesurfer) return;
  
  // Setup wavesurfer events
  wavesurfer.on('ready', () => {
    console.log('Wavesurfer is ready!');
    
    // Create default region if available
    if (regions) {
      currentRegion = regions.addRegion({
        start: wavesurfer.getDuration() * 0.25,
        end: wavesurfer.getDuration() * 0.75,
        color: 'rgba(79, 74, 133, 0.3)',
        drag: true,
        resize: true
      });
    }
  });
  
  wavesurfer.on('error', (err) => {
    console.error('Wavesurfer error:', err);
  });
  
  // Setup region events if available
  if (regions) {
    wavesurfer.on('region-click', (region, e) => {
      e.stopPropagation();
      currentRegion = region;
      region.play();
    });
    
    wavesurfer.on('region-dblclick', (region, e) => {
      e.stopPropagation();
      region.remove();
    });
    
    wavesurfer.on('region-created', (region) => {
      currentRegion = region;
    });
  }
  
  // Setup touch handling for waveform
  if (!touchHandlersInitialized && waveformContainer) {
    initWaveformTouchHandling(waveformContainer, {
      onTap: (info) => {
        console.log('Waveform tapped at position:', info.waveformPosition);
        if (wavesurfer) {
          // Set playback position
          wavesurfer.seekTo(info.waveformPosition);
          // Start playback
          wavesurfer.play();
        }
      },
      
      onDoubleTap: (info) => {
        console.log('Waveform double-tapped at position:', info.waveformPosition);
        if (wavesurfer && regions) {
          const duration = wavesurfer.getDuration();
          const position = info.waveformPosition * duration;
          
          // Create a region or toggle loop mode
          if (currentRegion) {
            // Toggle loop on current region
            if (wavesurfer.isPlaying()) {
              currentRegion.play();
            } else {
              currentRegion.play();
            }
          } else {
            // Create new region
            const newRegion = regions.addRegion({
              start: Math.max(0, position - 0.5),
              end: Math.min(duration, position + 0.5),
              color: 'rgba(79, 74, 133, 0.3)',
              drag: true,
              resize: true
            });
            
            currentRegion = newRegion;
            newRegion.play();
          }
        }
      },
      
      onLongPress: (info) => {
        console.log('Waveform long-pressed at position:', info);
        // Could show context menu here
      },
      
      onDrag: (info) => {
        // Scroll the waveform display
        if (wavesurfer) {
          const delta = info.delta.x / waveformContainer.clientWidth;
          wavesurfer.skip(-delta * 2); // Adjust sensitivity as needed
        }
      },
      
      onPinchZoom: (info) => {
        // Zoom the waveform
        if (wavesurfer) {
          const currentZoom = wavesurfer.getZoom();
          const newZoom = currentZoom * info.scale;
          
          // Limit zoom range
          if (newZoom > 10 && newZoom < 1000) {
            wavesurfer.zoom(newZoom);
          }
        }
      },
      
      onTwoFingerTap: (info) => {
        // Toggle play/pause
        if (wavesurfer) {
          if (wavesurfer.isPlaying()) {
            wavesurfer.pause();
          } else {
            wavesurfer.play();
          }
        }
      }
    });
    
    touchHandlersInitialized = true;
  }
}

/**
 * Setup mobile optimizations
 */
function setupMobileOptimizations() {
  // Adjust meta viewport for better mobile experience
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }
  
  viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  
  // Add styles for better button touch targets on mobile
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      button {
        min-width: 44px;
        min-height: 44px;
        padding: 10px 15px;
        margin: 5px;
        font-size: 16px;
      }
      
      .touch-active {
        transform: scale(0.95);
        opacity: 0.8;
      }
      
      #waveform {
        height: 150px !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Make iOS/iPad fullscreen capable
  const meta = document.createElement('meta');
  meta.name = 'apple-mobile-web-app-capable';
  meta.content = 'yes';
  document.head.appendChild(meta);
}

/**
 * Load audio from a blob
 */
function loadAudioBlob(blob) {
  if (!wavesurfer) {
    console.error('WaveSurfer not initialized');
    return;
  }
  
  try {
    wavesurfer.loadBlob(blob);
    console.log('Audio blob loaded successfully');
  } catch (e) {
    console.error('Error loading audio blob:', e);
  }
}

/**
 * Toggle recording
 */
async function toggleRecording() {
  console.log('Toggling recording, current state:', isRecording);
  
  try {
    if (isRecording) {
      // Stop recording
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        
        if (recordButton) {
          recordButton.textContent = 'Record';
          recordButton.classList.remove('recording');
        }
        
        console.log('Recording stopped');
      }
    } else {
      // Start recording
      if (!navigator.mediaDevices) {
        console.error('MediaDevices API not available');
        alert('Your browser does not support audio recording.');
        return;
      }
      
      // Request audio stream with forced audio context resume
      try {
        // First, try to resume audio context if it exists
        if (window.Tone && window.Tone.context) {
          await window.Tone.context.resume();
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingChunks = [];
        
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordingChunks.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordingChunks, { type: 'audio/wav' });
          loadAudioBlob(blob);
          
          // Clean up stream tracks
          stream.getTracks().forEach(track => track.stop());
        };
        
        // Start recording
        mediaRecorder.start();
        isRecording = true;
        
        if (recordButton) {
          recordButton.textContent = 'Stop';
          recordButton.classList.add('recording');
        }
        
        console.log('Recording started');
      } catch (err) {
        console.error('Error accessing media devices:', err);
        
        if (err.name === 'NotAllowedError') {
          alert('Please allow microphone access to record audio.');
        } else {
          alert(`Error starting recording: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error in toggleRecording:', err);
  }
}

/**
 * Create a granulator audio node
 */
function createGranulatorNode() {
  // Placeholder for future granular synthesis functionality
  console.log('Granulator node creation requested (not implemented yet)');
  return null;
}
