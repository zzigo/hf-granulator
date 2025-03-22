// Export functions for use in other modules
export {
  initWavesurfer,
  loadAudioBlob,
  toggleRecording,
  createGranulatorNode
};

// Add a function to connect wavesurfer to existing implementations
export function connectWithExistingImplementation() {
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
