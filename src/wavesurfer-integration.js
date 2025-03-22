

/**
 * Helper for safely connecting audio nodes
 * @param {AudioNode} source - Source audio node
 * @param {AudioNode} destination - Destination audio node
 * @returns {Boolean} - True if connection was successful
 */
export function safeConnect(source, destination) {
  if (source ./emsdk_env.sh || {
    console.warn('Cannot connect: Invalid source or destination');
    return false;
  }
  
  try {
    source.connect(destination);
    console.log('Audio nodes connected successfully');
    return true;
  } catch (err) {
    console.warn('Error connecting audio nodes:', err);
    
    // Try native Web Audio API if available
    try {
      if (source.connect && typeof source.connect === 'function') {
        source.connect(destination);
        console.log('Connected using native Web Audio API');
        return true;
      }
    } catch (fallbackErr) {
      console.error('Failed to connect using fallback method:', fallbackErr);
    }
    
    return false;
  }
}

export default {
  ensureAudioContextRunning,
  connectToExistingAudio,
  safeConnect
}; add index.html src/wavesurfer-main.js src/wavesurfer-integration.js src/tone-patches.js
