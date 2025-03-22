/**
 * Touch Gesture Handler
 * Provides unified touch gesture handling for tablet and mobile devices
 */

// Configuration
const config = {
  doubleTapThreshold: 300, // ms
  tapMoveThreshold: 20, // px - how much movement still counts as a tap
  longPressThreshold: 600, // ms
  twoFingerTapThreshold: 300, // ms
  twoFingerSpreadThreshold: 10, // px
};

// State tracking
let lastTapTime = 0;
let touchStartTimes = {};
let touchStartPositions = {};
let activeGestures = new Set();
let debugMode = false;

// Debug logging
function logEvent(type, event) {
  if (!debugMode) return;
  
  const touches = event.touches || event.changedTouches || [];
  console.log(`[TouchGesture] ${type}:`, {
    touchCount: touches.length,
    positions: Array.from(touches).map(t => ({ x: t.clientX, y: t.clientY })),
    timestamp: Date.now()
  });
}

/**
 * Initializes the touch gesture system
 * @param {HTMLElement} element - Element to attach gesture handlers to
 * @param {Object} options - Configuration options
 * @param {Object} handlers - Event handlers for different gestures
 */
export function initTouchGestures(element, options = {}, handlers = {}) {
  // Merge provided options with defaults
  Object.assign(config, options);
  
  // Set debug mode
  debugMode = options.debug || false;
  
  // Prevents the default zoom behavior on double-tap
  function disableZoom(e) {
    e.preventDefault();
    logEvent('disableZoom', e);
  }
  
  // Attach passive: false to prevent default behaviors
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd, { passive: false });
  
  // Disable default zoom behavior
  element.addEventListener('touchstart', disableZoom, { passive: false });
  element.addEventListener('touchmove', disableZoom, { passive: false });
  
  // Process touch start
  function handleTouchStart(e) {
    logEvent('touchstart', e);
    
    const touchCount = e.touches.length;
    
    // Record start position and time for each touch point
    for (let i = 0; i < touchCount; i++) {
      const touch = e.touches[i];
      const id = touch.identifier;
      
      touchStartTimes[id] = Date.now();
      touchStartPositions[id] = { 
        x: touch.clientX, 
        y: touch.clientY 
      };
    }
    
    // Track potential gestures based on touch count
    if (touchCount === 1) {
      activeGestures.add('tap');
      activeGestures.add('longPress');
      activeGestures.add('drag');
    } else if (touchCount === 2) {
      activeGestures.add('twoFingerTap');
      activeGestures.add('pinchZoom');
      activeGestures.add('twoFingerDrag');
    }
    
    // Call the touchstart handler if provided
    if (handlers.touchstart) {
      handlers.touchstart(e, {
        touchCount,
        positions: Array.from(e.touches).map(t => ({ 
          x: t.clientX, 
          y: t.clientY 
        }))
      });
    }
  }
  
  // Process touch move
  function handleTouchMove(e) {
    logEvent('touchmove', e);
    
    const touchCount = e.touches.length;
    
    // For each touch point, calculate movement
    for (let i = 0; i < touchCount; i++) {
      const touch = e.touches[i];
      const id = touch.identifier;
      const startPos = touchStartPositions[id];
      
      if (!startPos) continue;
      
      const currentPos = { x: touch.clientX, y: touch.clientY };
      const deltaX = currentPos.x - startPos.x;
      const deltaY = currentPos.y - startPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // If significant movement, remove tap gestures
      if (distance > config.tapMoveThreshold) {
        activeGestures.delete('tap');
        activeGestures.delete('longPress');
        activeGestures.delete('twoFingerTap');
      }
    }
    
    // Process pinch/zoom gesture
    if (touchCount === 2 && activeGestures.has('pinchZoom')) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const startPos1 = touchStartPositions[touch1.identifier];
      const startPos2 = touchStartPositions[touch2.identifier];
      
      if (startPos1 && startPos2) {
        // Calculate initial and current distances
        const initialDist = Math.sqrt(
          Math.pow(startPos2.x - startPos1.x, 2) + 
          Math.pow(startPos2.y - startPos1.y, 2)
        );
        
        const currentDist = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Calculate scale factor
        const scale = currentDist / initialDist;
        
        // Center point of the two fingers
        const center = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };
        
        if (handlers.pinchZoom) {
          handlers.pinchZoom(e, { scale, center });
        }
      }
    }
    
    // Handle drag events
    if (touchCount === 1 && activeGestures.has('drag')) {
      const touch = e.touches[0];
      const id = touch.identifier;
      const startPos = touchStartPositions[id];
      
      if (startPos) {
        const currentPos = { x: touch.clientX, y: touch.clientY };
        const delta = {
          x: currentPos.x - startPos.x,
          y: currentPos.y - startPos.y
        };
        
        if (handlers.drag) {
          handlers.drag(e, { 
            start: startPos, 
            current: currentPos, 
            delta
          });
        }
      }
    }
    
    // Handle two finger drag (pan)
    if (touchCount === 2 && activeGestures.has('twoFingerDrag')) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const startPos1 = touchStartPositions[touch1.identifier];
      const startPos2 = touchStartPositions[touch2.identifier];
      
      if (startPos1 && startPos2) {
        // Calculate the center points
        const startCenter = {
          x: (startPos1.x + startPos2.x) / 2,
          y: (startPos1.y + startPos2.y) / 2
        };
        
        const currentCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };
        
        const delta = {
          x: currentCenter.x - startCenter.x,
          y: currentCenter.y - startCenter.y
        };
        
        if (handlers.twoFingerDrag) {
          handlers.twoFingerDrag(e, {
            start: startCenter,
            current: currentCenter,
            delta
          });
        }
      }
    }
    
    // Call the touchmove handler if provided
    if (handlers.touchmove) {
      handlers.touchmove(e, {
        touchCount,
        positions: Array.from(e.touches).map(t => ({ 
          x: t.clientX, 
          y: t.clientY 
        }))
      });
    }
  }
  
  // Process touch end
  function handleTouchEnd(e) {
    logEvent('touchend', e);
    
    const now = Date.now();
    const touchCount = e.touches.length; // Remaining touches
    const endedTouches = e.changedTouches; // Touches that ended
    
    // Process ended touches
    for (let i = 0; i < endedTouches.length; i++) {
      const touch = endedTouches[i];
      const id = touch.identifier;
      const startTime = touchStartTimes[id];
      const startPos = touchStartPositions[id];
      
      if (!startTime || !startPos) continue;
      
      const touchDuration = now - startTime;
      const endPos = { x: touch.clientX, y: touch.clientY };
      const deltaX = endPos.x - startPos.x;
      const deltaY = endPos.y - startPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Clean up this touch point
      delete touchStartTimes[id];
      delete touchStartPositions[id];
      
      // Determine the gesture based on conditions
      if (activeGestures.has('tap') && distance < config.tapMoveThreshold && touchDuration < config.doubleTapThreshold) {
        // Check for double tap
        const timeSinceLastTap = now - lastTapTime;
        
        if (timeSinceLastTap <= config.doubleTapThreshold) {
          if (handlers.doubleTap) {
            handlers.doubleTap(e, { position: endPos });
          }
          // Reset last tap time to prevent triple-tap detection
          lastTapTime = 0;
        } else {
          // Single tap detection
          if (handlers.tap) {
            handlers.tap(e, { position: endPos });
          }
          lastTapTime = now;
        }
      }
      
      // Long press detection
      if (activeGestures.has('longPress') && distance < config.tapMoveThreshold && touchDuration >= config.longPressThreshold) {
        if (handlers.longPress) {
          handlers.longPress(e, { position: endPos, duration: touchDuration });
        }
      }
    }
    
    // Check for two finger tap (if both fingers lifted nearly simultaneously)
    if (touchCount === 0 && e.changedTouches.length === 2 && activeGestures.has('twoFingerTap')) {
      const touch1 = e.changedTouches[0];
      const touch2 = e.changedTouches[1];
      
      const touchTime1 = touchStartTimes[touch1.identifier];
      const touchTime2 = touchStartTimes[touch2.identifier];
      
      if (touchTime1 && touchTime2) {
        const touchDuration1 = now - touchTime1;
        const touchDuration2 = now - touchTime2;
        
        // Calculate center position
        const center = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };
        
        // If both touches were short and ended within a short time of each other
        if (touchDuration1 < config.twoFingerTapThreshold && 
            touchDuration2 < config.twoFingerTapThreshold && 
            Math.abs(touchDuration1 - touchDuration2) < 100) {
          if (handlers.twoFingerTap) {
            handlers.twoFingerTap(e, { center });
          }
        }
      }
    }
    
    // Clean up active gestures
    activeGestures.clear();
    
    // Call the touchend handler if provided
    if (handlers.touchend) {
      handlers.touchend(e, {
        touchCount,
        positions: Array.from(e.changedTouches).map(t => ({ 
          x: t.clientX, 
          y: t.clientY 
        }))
      });
    }
  }
  
  // Return a function to remove all event listeners
  return function cleanup() {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchstart', disableZoom);
    element.removeEventListener('touchmove', disableZoom);
  };
}

// Utility functions to help with touch events
export const TouchUtils = {
  /**
   * Checks if the device supports touch events
   */
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },
  
  /**
   * Checks if the device is a mobile device
   */
  isMobile() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|windows phone/.test(userAgent);
  },
  
  /**
   * Checks if the device is a tablet
   */
  isTablet() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(userAgent);
  },
  
  /**
   * Gets device orientation (portrait or landscape)
   */
  getOrientation() {
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  },
  
  /**
   * Enable debug mode for touch events
   */
  enableDebug() {
    debugMode = true;
    console.log('[TouchGesture] Debug mode enabled');
  }
};

// Export gesture types for documentation/reference
export const GestureTypes = {
  TAP: 'tap',
  DOUBLE_TAP: 'doubleTap',
  LONG_PRESS: 'longPress',
  DRAG: 'drag',
  TWO_FINGER_TAP: 'twoFingerTap',
  PINCH_ZOOM: 'pinchZoom',
  TWO_FINGER_DRAG: 'twoFingerDrag'
}; 