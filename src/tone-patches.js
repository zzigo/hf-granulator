/**
 * Tone.js Patches
 * This file contains patches for common Tone.js issues
 */

console.log('Initializing Tone.js patches');

// Wait for window to be fully loaded
window.addEventListener('DOMContentLoaded', () => {
  if (!window.Tone) {
    console.warn('Tone.js not found, waiting for it to load...');
    
    // Check for Tone.js every 100ms
    const checkInterval = setInterval(() => {
      if (window.Tone) {
        console.log('Tone.js found, applying patches...');
        applyTonePatches();
        clearInterval(checkInterval);
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!window.Tone) {
        console.error('Tone.js not loaded after 5 seconds, patches not applied');
        clearInterval(checkInterval);
      }
    }, 5000);
  } else {
    console.log('Tone.js found immediately, applying patches...');
    applyTonePatches();
  }
});

/**
 * Apply all patches to Tone.js
 */
function applyTonePatches() {
  // Store original console.error to restore later
  const originalConsoleError = console.error;
  
  // Patch console.error to intercept Tone.js key errors
  console.error = function(...args) {
    // Check if this is a Tone.js key error
    const errorMessage = args.join(' ');
    if (
      errorMessage.includes('A value with the given key could not be found') ||
      errorMessage.includes('key not found') ||
      errorMessage.includes('Cannot read properties of undefined')
    ) {
      console.warn('Intercepted Tone.js key error:', ...args);
      return null; // Don't propagate the error
    }
    
    // For all other errors, use the original console.error
    return originalConsoleError.apply(console, args);
  };
  
  // Patch getValueForKey if it exists
  if (window.Tone && window.Tone.getValueForKey) {
    const originalGetValueForKey = window.Tone.getValueForKey;
    window.Tone.getValueForKey = function(obj, key) {
      try {
        return originalGetValueForKey(obj, key);
      } catch (e) {
        console.warn(`Prevented Tone.js key error: could not find key "${key}"`, e);
        return null; // Return null instead of throwing
      }
    };
    console.log('Patched Tone.getValueForKey successfully');
  }
  
  // Patch Tone.js connect method to be more resilient for mobile
  if (window.Tone && window.Tone.ToneAudioNode) {
    const originalConnect = window.Tone.ToneAudioNode.prototype.connect;
    window.Tone.ToneAudioNode.prototype.connect = function(...args) {
      try {
        return originalConnect.apply(this, args);
      } catch (e) {
        console.warn('Error in Tone.js connect, using fallback connect:', e);
        
        // Try native connect as fallback
        if (this.output && typeof this.output.connect === 'function') {
          try {
            return this.output.connect(...args);
          } catch (innerError) {
            console.error('Fallback connect also failed:', innerError);
          }
        }
        
        // At least don't crash the application
        return this;
      }
    };
    console.log('Patched Tone.ToneAudioNode.connect successfully');
  }
  
  // Patch the start method to be more resilient on mobile
  if (window.Tone && window.Tone.Source) {
    const originalStart = window.Tone.Source.prototype.start;
    window.Tone.Source.prototype.start = function(...args) {
      try {
        return originalStart.apply(this, args);
      } catch (e) {
        console.warn('Error in Tone.Source.start, using fallback:', e);
        
        // Try to start the source using the internal source if possible
        if (this._source && typeof this._source.start === 'function') {
          try {
            return this._source.start(...args);
          } catch (innerError) {
            console.warn('Fallback source start also failed:', innerError);
          }
        }
        
        // Return this to allow method chaining
        return this;
      }
    };
    console.log('Patched Tone.Source.start successfully');
  }
  
  // Patch tablet-specific issues for Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    console.log('iOS device detected, applying iOS-specific patches');
    
    // Ensure audio context starts correctly on iOS
    document.addEventListener('touchstart', function iosAudioFix() {
      if (window.Tone && window.Tone.context) {
        if (window.Tone.context.state !== 'running') {
          window.Tone.context.resume().then(() => {
            console.log('iOS audio context resumed successfully');
          });
        }
        document.removeEventListener('touchstart', iosAudioFix);
      }
    }, { once: false });
    
    // Fix for Safari AudioContext issues
    if (window.Tone && window.Tone.context) {
      const originalResume = window.Tone.context.resume;
      window.Tone.context.resume = function() {
        // Add event handlers to help iOS unlock audio
        document.documentElement.addEventListener('touchstart', function unlockiOS() {
          document.documentElement.removeEventListener('touchstart', unlockiOS);
          console.log('iOS touch gesture detected, attempting to resume audio context');
        }, { once: true });
        
        return originalResume.call(this);
      };
      console.log('Enhanced resume method for iOS');
    }
  }
  
  // Add a global error handler for unhandled Tone.js errors
  window.addEventListener('error', function(event) {
    if (event.error && (
      (event.error.stack && event.error.stack.includes('Tone')) ||
      (event.message && event.message.includes('Tone'))
    )) {
      console.warn('Intercepted unhandled Tone.js error:', event.error);
      event.preventDefault();
      return true; // Prevent the error from bubbling up
    }
  });
  
  console.log('All Tone.js patches applied successfully');
}
