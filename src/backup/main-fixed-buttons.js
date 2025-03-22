import * as Tone from "tone";
import EventEmitter from "event-emitter";
import WaveformPlaylist from "waveform-playlist";

// Device detection utility
const deviceDetection = {
  isMobile: () => {
    return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },
  isTablet: () => {
    return /(iPad|tablet|Nexus 9)/i.test(navigator.userAgent) || 
           (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
  },
  isMobileOrTablet: function() {
    return this.isMobile() || this.isTablet();
  },
  init: function() {
    this.isMobileBrowser = this.isMobile();
    this.isTabletBrowser = this.isTablet();
    console.log(`📱 Device detection: Mobile: ${this.isMobileBrowser}, Tablet: ${this.isTabletBrowser}`);
  }
};

// State variables
let isRecording = false;
let audioBuffer = null;
window.waveformInstance = null;
let mediaRecorder = null;
let audioChunks = [];
let selectionStart = 0;
let selectionEnd = 0;
let playbackPosition = 0;
let showHud = true; // HUD visibility
let ee = EventEmitter(); // EventEmitter for waveform control
let audioInputDevices = []; // Array to store audio input devices
let selectedDeviceId = ''; // Currently selected audio device
let analyser = null; // Audio analyser for VU meter
let outputAnalyser = null; // Audio analyser for output VU meter
let animationFrameId = null; // For animation loop
let outputAnimationFrameId = null; // For output VU meter animation
let liveRecordingStream = null; // For live recording preview
let liveRecordingVisualizer = null; // For live visualization
let loopPlayer = null; // Tone.js player for looping
let isLooping = false; // Flag to track if we're currently looping
let lastTouchEnd = 0; // Variable to track last touch end time (for double-tap zoom prevention)

// Inject CSS dynamically
function injectCSS(styles) {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// HUD + Styling
injectCSS(`
  body {
    background-color: black;
    color: white;
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .app {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
    position: relative;
  }

.waveform {
  width: 100%;
  height: 100vh; /* Full viewport height */
  background-color: black; /* Background of the waveform */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.waveform canvas {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  background-color: black !important;
}

/* Force shorter waveforms to stretch to full width */
.waveform .playlist-time-scale {
  display: none !important; /* Hide timescale for minimal look */
}

.waveform .channel {
  width: 100% !important;
}

.waveform .channel-wrapper {
  filter: invert(100%); /* Invert colors to make waveform white */
  width: 100% !important;
}

.waveform .cursor {
  background-color: white !important; /* Cursor color */
}

.waveform .selection {
  background-color: rgba(255, 255, 255, 0.3) !important; /* Selection box in white */
}

/* Live recording canvas styles */
.live-waveform {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 5;
  pointer-events: none;
}

.live-waveform canvas {
  width: 100%;
  height: 100%;
  background-color: transparent;
}

  .record-button {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    position: absolute;
    bottom: 10%;
    margin: auto;
    background-color: gray;
    border: none;
    transition: background 0.3s;
    z-index: 100;
  }

  .record-button.recording {
    background-color: red;
  }

  .hud {
    position: absolute;
    bottom: 20px;
    left: 90px; /* Position next to audio input menu (20px + 60px + 10px) */
    background: transparent;
    color: white;
    font-size: 12px;
    display: ${showHud ? "flex" : "none"};
    z-index: 100;
    gap: 10px;
  }
  
  .hud-item {
    position: relative;
    cursor: default;
  }
  
  .hud-value {
    opacity: 0.7;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  
  .hud-tooltip {
    visibility: hidden;
    background-color: transparent;
    color: white;
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
  }
  
  .hud-item:hover .hud-tooltip {
    visibility: visible;
    opacity: 1;
  }
  
  .window-width {
    position: absolute;
    bottom: 20px;
    right: 50px; /* Move away from console edge (30px plus extra space) */
    color: white;
    font-size: 11px;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .loop-icon {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 1px solid white;
    border-radius: 50%;
    position: relative;
  }
  
  .loop-icon::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 6px;
    height: 6px;
    border-right: 1px solid white;
    border-bottom: 1px solid white;
    transform: rotate(-45deg);
  }
  
  /* Audio device dropdown styles */
  .audio-device-dropdown {
    position: absolute;
    bottom: 20px;
    left: 20px;
    z-index: 100;
    background: transparent;
    width: 60px; /* Set a fixed width to calculate positions better */
  }
  
  .audio-device-dropdown select {
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    padding: 5px;
    font-size: 11px;
    border-radius: 4px;
    outline: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 100%;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  /* Hide default arrow in Firefox */
  .audio-device-dropdown select::-ms-expand {
    display: none;
  }
  
  /* VU meter styles - Input */
  .vu-meter {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0);
    z-index: 99;
    pointer-events: none;
  }
  
  .vu-meter-level {
    position: absolute;
    bottom: 0;
    width: 1px;
    background-color: white;
    transition: height 0.05s ease;
  }
  
  /* VU meter styles - Output */
  .output-vu-meter {
    position: absolute;
    right: 0;
    top: 0;
    width: 1px;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0);
    z-index: 99;
    pointer-events: none;
  }
  
  .output-vu-meter-level {
    position: absolute;
    bottom: 0;
    width: 1px;
    background-color: white;
    transition: height 0.05s ease;
  }
`);

// **🔹 Load Eruda Debugging if not already present**
(function () {
  var script = document.createElement("script");
  script.src = "//cdn.jsdelivr.net/npm/eruda";
  document.body.appendChild(script);
  script.onload = function () {
    // Fix wheel event warning by adding hook before eruda init
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      // Force passive true for wheel events
      if (type === 'wheel' || type === 'mousewheel' || type === 'DOMMouseScroll') {
        let newOptions = options;
        if (newOptions === undefined || newOptions === null) {
          newOptions = { passive: true };
        } else if (typeof newOptions === 'object') {
          newOptions = { ...newOptions, passive: true };
        } else if (newOptions === false) {
          newOptions = { capture: true, passive: true };
        } else if (newOptions === true) {
          newOptions = { capture: true, passive: true };
        }
        return originalAddEventListener.call(this, type, listener, newOptions);
      } else {
        return originalAddEventListener.call(this, type, listener, options);
      }
    };
    
    eruda.init({
      tool: ['console', 'elements', 'network', 'resources', 'info', 'sources'],
      useShadowDom: true,
      defaults: {
        displaySize: 50,
        transparency: 0.9
      }
    });
    
    // Additional fix with CSS
    const style = document.createElement('style');
    style.textContent = '.eruda-dev-tools * { touch-action: pan-x pan-y; }';
    document.head.appendChild(style);
    
    console.log("✅ Eruda Debugging Loaded!");
  };
})();

// Function to initialize AudioContext
function startAudioContext() {
  if (Tone.context.state !== "running") {
    console.log("Starting AudioContext...");
    // Use both methods to ensure it works across browsers
    Tone.start();
    
    Tone.context
      .resume()
      .then(() => console.log("AudioContext resumed successfully! State:", Tone.context.state))
      .catch(err => console.error("Error resuming AudioContext:", err));
    
    // Unlock the audio context on iOS
    const unlockAudio = () => {
      if (Tone.context.state !== "running") {
        // Create and play a silent sound to unlock audio
        const silentAudio = Tone.context.createBuffer(1, 1, 22050);
        const source = Tone.context.createBufferSource();
        source.buffer = silentAudio;
        source.connect(Tone.context.destination);
        source.start();
        console.log("Silent audio played to unlock context");
      }
    };
    
    // Call unlock immediately
    unlockAudio();
  } else {
    console.log("AudioContext already running:", Tone.context.state);
  }
}

// Simulate a user gesture by dispatching a fake event
function simulateUserGesture() {
  const button = document.createElement("button");
  button.style.display = "none";
  document.body.appendChild(button);
  button.click();
  document.body.removeChild(button);
}

// Try to resume AudioContext when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Application initialized");
  
  // Check for device type and set up mobile optimizations
  deviceDetection.init();
  if (deviceDetection.isMobileOrTablet()) {
    setupMobileOptimizations();
    setupTouchInteractions();
  }
  
  // Initialize application components
  initializeEventListeners();
  startAudioContext();
  updateHUD();
  
  // Display initial welcome message
  const welcomeMessage = "Welcome to Hiperfono Granulator. Load an audio file to begin.";
  document.querySelector('.progress-bar-container').textContent = welcomeMessage;
  
  // Create initial fullscreen indicator (hidden by default)
  const indicator = document.createElement('div');
  indicator.className = 'fullscreen-indicator';
  indicator.style.display = 'none';
  indicator.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
    </svg>
  `;
  document.body.appendChild(indicator);
});

// Function to enumerate audio input devices
async function getAudioInputDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    audioInputDevices = devices.filter(device => device.kind === 'audioinput');
    console.log('📱 Available audio devices:', audioInputDevices);
    
    // Update dropdown with available devices
    updateAudioDeviceDropdown();
    
    // Select first device by default if one exists
    if (audioInputDevices.length > 0 && !selectedDeviceId) {
      selectedDeviceId = audioInputDevices[0].deviceId;
    }
  } catch (err) {
    console.error('❌ Error getting audio devices:', err);
  }
}

// Function to update the audio device dropdown
function updateAudioDeviceDropdown() {
  const dropdown = document.getElementById('audio-device-select');
  if (!dropdown) return;
  
  // Clear existing options
  dropdown.innerHTML = '';
  
  // Add devices to dropdown
  audioInputDevices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Microphone ${audioInputDevices.indexOf(device) + 1}`;
    dropdown.appendChild(option);
  });
  
  // Set selected device if it exists
  if (selectedDeviceId) {
    dropdown.value = selectedDeviceId;
  }
}

// Function to handle audio device change
function handleDeviceChange(e) {
  selectedDeviceId = e.target.value;
  
  // If already recording, stop and restart with new device
  if (isRecording) {
    toggleRecording().then(() => toggleRecording());
  }
  
  // Start audio context and analyzer with the new device
  setupAudioAnalyser();
}

// Function to setup audio analyser for VU meter
async function setupAudioAnalyser() {
  try {
    // Create audio context if not exists
    if (!Tone.context.state === 'running') {
      await startAudioContext();
    }
    
    // Stop previous analyzer if exists
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Get user media with selected device
    const constraints = { 
      audio: {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
      } 
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Create analyzer
    const audioContext = Tone.getContext().rawContext;
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    
    // Start VU meter animation
    updateVUMeter();
    
  } catch (err) {
    console.error('❌ Error setting up audio analyser:', err);
  }
}

// Function to update VU meter
function updateVUMeter() {
  if (!analyser) return;
  
  const vuMeterElement = document.querySelector('.vu-meter-level');
  if (!vuMeterElement) return;
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  function draw() {
    animationFrameId = requestAnimationFrame(draw);
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate volume level (average of frequency data)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    
    // Convert to percentage (0-100)
    const level = (average / 255) * 100;
    
    // Update VU meter height (as percentage of viewport height)
    vuMeterElement.style.height = `${level}vh`;
  }
  
  draw();
}

// Setup output VU meter for playback monitoring
function setupOutputAnalyser() {
  // Stop previous animation if exists
  if (outputAnimationFrameId) {
    cancelAnimationFrame(outputAnimationFrameId);
    outputAnimationFrameId = null;
  }
  
  // Create analyzer for output audio
  const audioContext = Tone.getContext().rawContext;
  outputAnalyser = audioContext.createAnalyser();
  outputAnalyser.fftSize = 1024;
  outputAnalyser.smoothingTimeConstant = 0.85;
  
  // Create a meter to track levels and connect to main output
  const meter = new Tone.Meter();
  Tone.Destination.connect(meter);
  
  // Connect the output to the analyzer
  Tone.Destination.connect(outputAnalyser);
  
  updateOutputVUMeter();
}

// Function to update output VU meter
function updateOutputVUMeter() {
  if (!outputAnalyser) return;
  
  const vuMeterElement = document.querySelector('.output-vu-meter-level');
  if (!vuMeterElement) return;
  
  const dataArray = new Uint8Array(outputAnalyser.frequencyBinCount);
  
  function draw() {
    outputAnimationFrameId = requestAnimationFrame(draw);
    
    outputAnalyser.getByteFrequencyData(dataArray);
    
    // Calculate volume level (average of frequency data)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    
    // Convert to percentage (0-100)
    const level = (average / 255) * 100;
    
    // Update VU meter height (as percentage of viewport height)
    vuMeterElement.style.height = `${level}vh`;
  }
  
  draw();
}

// Function for live waveform visualization during recording
function setupLiveWaveformVisualizer() {
  // Create canvas for live visualization if not exists
  if (!document.getElementById('live-canvas')) {
    const liveWaveformDiv = document.createElement('div');
    liveWaveformDiv.className = 'live-waveform';
    
    const canvas = document.createElement('canvas');
    canvas.id = 'live-canvas';
    liveWaveformDiv.appendChild(canvas);
    
    document.querySelector('.app').appendChild(liveWaveformDiv);
  }
  
  const canvas = document.getElementById('live-canvas');
  const canvasCtx = canvas.getContext('2d');
  
  // Set canvas dimensions to match window size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // Create analyzer for live visualization
  const audioContext = Tone.getContext().rawContext;
  const liveAnalyser = audioContext.createAnalyser();
  liveAnalyser.fftSize = 2048;
  const bufferLength = liveAnalyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  // Connect the live stream to the analyzer
  if (liveRecordingStream) {
    const source = audioContext.createMediaStreamSource(liveRecordingStream);
    source.connect(liveAnalyser);
  }
  
  // Draw function for the live waveform
  function draw() {
    liveRecordingVisualizer = requestAnimationFrame(draw);
    
    // Clear the canvas
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get time domain data
    liveAnalyser.getByteTimeDomainData(dataArray);
    
    // Set drawing styles
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'white';
    canvasCtx.beginPath();
    
    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      // Scale the waveform to fill the entire height
      const v = (dataArray[i] / 128.0); // normalize to 0-2 range
      const y = (v * canvas.height/2); // scale to canvas height, centered
      
      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    canvasCtx.stroke();
  }
  
  draw();
  
  return liveAnalyser;
}

// Function to setup waveform event handlers
function setupWaveformEvents() {
  // Listen for selection updates
  ee.on('select', (start, end, track) => {
    console.log('🔄 Selection changed:', start, end);
    selectionStart = start;
    selectionEnd = end;
    
    // Set timestamp to identify selection operations
    window.lastSelectionTime = Date.now();
    
    // Update HUD
    updateHUD();
    
    // Start looping the selected region automatically
    if (start !== end) {
      // Force audio context to start (this ensures it's running before we try to play)
      Tone.start();
      startAudioContext();
      
      // Immediate playback with a very short delay to ensure UI updates first
      setTimeout(() => {
        playLoopSelection(start, end);
      }, 10);
    } else {
      stopCurrentLoop();
    }
  });
  
  // Add double click to play from position
  ee.on('dblclick', (time) => {
    console.log('🔄 Double click at time:', time);
    // Ensure time is within valid range
    time = Math.max(0, Math.min(time, audioBuffer ? audioBuffer.duration - 0.01 : 0));
    selectionStart = time;
    selectionEnd = audioBuffer ? audioBuffer.duration : 0;
    
    // Update HUD
    updateHUD();
    
    // Force audio context to start
    Tone.start();
    startAudioContext();
    
    // Play from this position to the end
    playLoopSelection(time, selectionEnd);
  });
  
  // Listen for cursor position updates
  ee.on('timeupdate', (time) => {
    playbackPosition = time;
    updateHUD();
  });
}

// Function to stop current loop
function stopCurrentLoop() {
  if (loopPlayer) {
    loopPlayer.stop();
    loopPlayer.dispose();
    loopPlayer = null;
    isLooping = false;
    console.log('🛑 Loop stopped');
  }
}

// Enhanced function to loop selected portion of the audio
function playLoopSelection(start, end) {
  if (!audioBuffer || start >= end) return;
  
  // Stop any existing loop
  stopCurrentLoop();
  
  // Ensure values are within the valid range
  start = Math.max(0, Math.min(start, audioBuffer.duration - 0.01));
  end = Math.max(start + 0.01, Math.min(end, audioBuffer.duration));
  
  console.log('▶️ Starting loop:', start, end, 'Buffer duration:', audioBuffer.duration);
  
  try {
    // Make sure Tone.js context is explicitly started first
    Tone.start();
    console.log('Tone context state:', Tone.context.state);
    
    if (Tone.context.state !== "running") {
      console.log('Resuming Tone context explicitly');
      Tone.context.resume();
    }
    
    // Setup output analyzer if not already set up
    if (!outputAnalyser) {
      setupOutputAnalyser();
    }
    
    // Check buffer before using
    console.log('Using buffer:', audioBuffer);
    
    // Create player directly with the buffer object (not URL)
    loopPlayer = new Tone.Player();
    
    // Set the buffer directly (avoid URL loading which can fail)
    loopPlayer.buffer = audioBuffer;
    
    // Configure loop settings after buffer is set
    loopPlayer.loop = true;
    loopPlayer.loopStart = start;
    loopPlayer.loopEnd = end;
    
    // Connect to destination
    loopPlayer.toDestination();
    
    // Start playback with a slight delay to ensure everything is set up
    loopPlayer.start();
    
    isLooping = true;
    updateHUD();
    
    // Adjust waveform for very short loops
    if ((end - start) < 1) {
      console.log('📏 Short loop detected, ensuring full-width display');
      // Force all canvases and channel elements to full width
      document.querySelectorAll('.waveform canvas, .channel, .channel-wrapper').forEach(el => {
        el.style.width = '100%';
      });
    }
    
    console.log('✅ Loop player started at position:', start);
    
  } catch (error) {
    console.error('❌ Error creating loop player:', error);
  }
}

// Function to loop selected portion of the audio (original version)
function loopSelectedAudio() {
  if (!audioBuffer || selectionStart >= selectionEnd) return;

  // This is now a wrapper for the enhanced version
  playLoopSelection(selectionStart, selectionEnd);
}

// Function to visualize waveform with EventEmitter
async function visualizeWaveform(audioBlob) {
  if (!audioBlob) {
    console.error("❌ No audio blob provided");
    return;
  }

  console.log("🔄 Processing audio blob:", audioBlob.size, "bytes, type:", audioBlob.type);

  // Ensure waveform container is created before initializing WaveformPlaylist
  let waveformContainer = document.getElementById("waveform");
  if (!waveformContainer) {
    console.error("❌ Waveform container is missing. Creating new container.");
    waveformContainer = document.createElement("div");
    waveformContainer.id = "waveform";
    waveformContainer.className = "waveform";
    document.body.appendChild(waveformContainer);
  }

  waveformContainer.innerHTML = ""; // Clear previous waveform

  try {
    console.log("🔄 Converting Blob to ArrayBuffer...");
    // Use a more explicit conversion via FileReader for better compatibility
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsArrayBuffer(audioBlob);
    });
    
    console.log("✅ ArrayBuffer conversion successful:", arrayBuffer.byteLength, "bytes");

    // Force audio context to resume before decoding (important!)
    Tone.start();
    startAudioContext();
    console.log("🔊 AudioContext state before decoding:", Tone.context.state);

    console.log("🔄 Decoding Audio Data...");
    try {
      // Use the raw Web Audio API for decoding for better compatibility
      audioBuffer = await Tone.getContext().rawContext.decodeAudioData(arrayBuffer);
      console.log("✅ Audio Decoded:", audioBuffer, "duration:", audioBuffer.duration);
      
      // Create a test player to verify the buffer works (but don't play it)
      const testPlayer = new Tone.Player().toDestination();
      testPlayer.buffer = audioBuffer;
      console.log("✅ Test player created successfully with buffer");
    } catch (decodeError) {
      console.error("❌ Error decoding audio data:", decodeError);
      // Try fallback decoding if the first method fails
      try {
        const rawContext = Tone.getContext().rawContext;
        audioBuffer = await new Promise((resolve, reject) => {
          rawContext.decodeAudioData(
            arrayBuffer, 
            buffer => resolve(buffer), 
            err => reject(err)
          );
        });
        console.log("✅ Audio Decoded with fallback method:", audioBuffer);
      } catch(fallbackError) {
        console.error("❌ Fallback decoding also failed:", fallbackError);
        return;
      }
    }

    // Calculate appropriate samplesPerPixel based on duration and window width
    // For longer recordings, use higher values to ensure everything fits on one line
    const duration = audioBuffer.duration;
    let samplesPerPixel = 256; // default
    
    // Determine number of samples that will fit in the window width
    const maxSamplesForSingleLine = audioBuffer.sampleRate * duration;
    const windowWidthSamples = window.innerWidth;
    samplesPerPixel = Math.max(32, Math.ceil(maxSamplesForSingleLine / windowWidthSamples));
    
    console.log(`📏 Duration: ${duration.toFixed(2)}s, Using samplesPerPixel: ${samplesPerPixel} to fit waveform in window`);

    // Ensure WaveformPlaylist is created on a real DOM node
    console.log("🔄 Initializing WaveformPlaylist...");
    window.waveformInstance = WaveformPlaylist(
      {
        container: waveformContainer, // ✅ Ensures it uses a real DOM element
        state: "select", 
        zoomLevels: [16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192], // Added higher zoom levels
        samplesPerPixel: samplesPerPixel, // Dynamic resolution based on duration
        waveHeight: window.innerHeight, // Full height
        isAutomaticScroll: true,
        waveOutlineColor: '#ffffff', // White outline
        waveColor: 'rgba(255, 255, 255, 0.8)', // White color with slight transparency
        timescale: false, // Hide timescale for minimal look
        barWidth: 1, // Thinner bars look better when stretched
        barGap: 0, // No gap between bars for continuous look
        isEventPropagationEnabled: false, // Prevent event propagation to avoid conflicts with our handlers
        
        // IMPORTANT: Force horizontal rendering only - prevent multiple lines
        timelinePixels: Number.MAX_SAFE_INTEGER, // Extremely large value forces horizontal scrolling instead of wrapping
        forceSingleLine: true, // Custom parameter to ensure single line display
      },
      ee // Attach EventEmitter
    );

    console.log("✅ WaveformPlaylist Initialized:", window.waveformInstance);

    // Setup event handlers for selection and timeupdate
    setupWaveformEvents();
    
    // Remove test tone - this is a performance instrument

    // Load the waveform after decoding
    setTimeout(async () => {
      try {
        console.log("🔄 Loading Waveform...");
        await window.waveformInstance.load([
          { src: URL.createObjectURL(audioBlob), name: "Audio" },
        ]);
        console.log("✅ Waveform Loaded Successfully");

        updateHUD();
        
        // Show saved waveform and hide live waveform
        waveformContainer.style.display = 'block';
        
        // Setup full width/height waveform
        window.waveformInstance.setWaveHeight(window.innerHeight);
        
        // Apply post-load fixes to ensure single line display
        const trackElements = document.querySelectorAll('.playlist-track');
        trackElements.forEach(track => {
          track.style.height = '100vh';
          track.style.marginBottom = '0';
          track.style.width = '100%';
          
          // Set track container to allow horizontal overflow but hide vertical overflow
          const trackContainer = track.closest('.playlist-tracks');
          if (trackContainer) {
            trackContainer.style.overflowY = 'hidden';
            trackContainer.style.overflowX = 'hidden';
            trackContainer.style.width = '100%';
            trackContainer.style.maxWidth = '100vw';
          }
          
          // Adjust waveform container height
          const containerElements = track.querySelectorAll('.channel-wrapper, .channel');
          containerElements.forEach(el => {
            el.style.height = '100vh';
            el.style.width = '100%'; // Force full width
            el.style.maxWidth = '100vw';
          });
        });
        
        // Force all canvases to proper dimensions
        const canvases = document.querySelectorAll('.waveform canvas');
        canvases.forEach(canvas => {
          canvas.style.width = '100%';
          canvas.style.maxWidth = '100vw';
          canvas.style.height = '100vh';
        });

        // Ensure waveform is rendered
        setTimeout(() => {
          console.log("✅ Re-rendering waveform...");
          window.waveformInstance.drawRequest();
          window.waveformInstance.render();
          
          // Final width adjustment for channel elements
          document.querySelectorAll('.playlist-tracks').forEach(el => {
            el.style.width = '100%';
            el.style.maxWidth = '100vw';
          });
          
          // Force single line display by setting all track container heights
          document.querySelectorAll('.track-container').forEach(el => {
            el.style.height = '100vh';
            el.style.width = '100%';
            el.style.maxWidth = '100vw';
          });
        }, 300);

        // Add these lines after playlist initialization is complete
        setupMobileOptimizations();
        if (deviceDetection.isMobile() || deviceDetection.isTablet()) {
          setupTouchInteractions();
        }
      } catch (loadError) {
        console.error("❌ Error loading waveform:", loadError);
      }
    }, 200);
  } catch (err) {
    console.error("❌ Error visualizing waveform:", err);
  }
}

// Function to handle window resize
function handleResize() {
  // Update live canvas dimensions if it exists
  const liveCanvas = document.getElementById('live-canvas');
  if (liveCanvas) {
    liveCanvas.width = window.innerWidth;
    liveCanvas.height = window.innerHeight;
  }
  
  // Update waveform display if it exists
  if (window.waveformInstance) {
    window.waveformInstance.setWaveHeight(window.innerHeight);
    window.waveformInstance.drawRequest();
    
    // Adjust track heights
    const trackElements = document.querySelectorAll('.playlist-track');
    trackElements.forEach(track => {
      track.style.height = '100vh';
      
      // Adjust waveform container height and width
      const containerElements = track.querySelectorAll('.channel-wrapper, .channel');
      containerElements.forEach(el => {
        el.style.height = '100vh';
        el.style.width = '100%'; // Force full width
      });
    });
    
    // Force track containers to full width
    document.querySelectorAll('.playlist-tracks, .playlist, .track-container').forEach(el => {
      el.style.width = '100%';
    });
    
    // Force all canvases to full width
    document.querySelectorAll('.waveform canvas').forEach(canvas => {
      canvas.style.width = '100%';
    });
  }
  
  updateHUD();
}

// Function to update button state
function updateButtonState() {
  const button = document.getElementById("record-button");
  if (button) {
    button.classList.toggle("recording", isRecording);
  }
}

// Function to update HUD display
function updateHUD() {
  if (!showHud) return;

  const hud = document.getElementById("hud");
  if (!hud) return;
  
  // Clear previous HUD
  hud.innerHTML = '';
  
  // Format number consistently - ensure all have same number of digits for equal width
  const formatNumber = (num) => {
    if (num === "N/A") return "N/A";
    // No padding, just return the rounded number
    return String(Math.round(num));
  };
  
  // Create HUD items
  const items = [
    {
      label: "Buffer Size",
      value: audioBuffer ? formatNumber(audioBuffer.length) : "N/A"
    },
    {
      label: "Total Time",
      value: audioBuffer ? formatNumber(audioBuffer.duration * 1000) : "N/A"
    },
    {
      label: "Selection Start",
      value: formatNumber(selectionStart * 1000)
    },
    {
      label: "Selection End",
      value: formatNumber(selectionEnd * 1000)
    },
    {
      label: "Selected Duration",
      value: formatNumber((selectionEnd - selectionStart) * 1000)
    },
    {
      label: "Playback Position",
      value: formatNumber(playbackPosition * 1000)
    }
  ];
  
  // Add each item to HUD
  items.forEach(item => {
    const hudItem = document.createElement('div');
    hudItem.className = 'hud-item';
    
    const hudValue = document.createElement('div');
    hudValue.className = 'hud-value';
    hudValue.innerText = item.value;
    
    const hudTooltip = document.createElement('div');
    hudTooltip.className = 'hud-tooltip';
    hudTooltip.innerText = item.label;
    
    hudItem.appendChild(hudValue);
    hudItem.appendChild(hudTooltip);
    hud.appendChild(hudItem);
  });
  
  // Add loop status as icon (only when active)
  if (isLooping) {
    const loopItem = document.createElement('div');
    loopItem.className = 'hud-item';
    
    const loopIcon = document.createElement('div');
    loopIcon.className = 'loop-icon';
    
    const hudTooltip = document.createElement('div');
    hudTooltip.className = 'hud-tooltip';
    hudTooltip.innerText = 'Loop Active';
    
    loopItem.appendChild(loopIcon);
    loopItem.appendChild(hudTooltip);
    hud.appendChild(loopItem);
  }
  
  // Create window width display on the right side
  let widthDisplay = document.querySelector('.window-width');
  
  if (!widthDisplay) {
    widthDisplay = document.createElement('div');
    widthDisplay.className = 'window-width';
    document.body.appendChild(widthDisplay);
  }
  
  widthDisplay.innerText = formatNumber(window.innerWidth);
}

// Initialize the UI
function init() {
  const app = document.createElement("div");
  app.className = "app";

  const waveformDiv = document.createElement("div");
  waveformDiv.id = "waveform";
  waveformDiv.className = "waveform";
  
  // Add tap handler for waveform to play/pause (mobile friendly)
  waveformDiv.addEventListener("click", (e) => {
    // Skip if it's a click from a selection operation (mouseup after selection dragging)
    // We can detect this by checking for recent selection changes
    const now = Date.now();
    if (window.lastSelectionTime && (now - window.lastSelectionTime < 500)) {
      // Skip as this is likely part of a selection action
      return;
    }
    
    // Only handle if we have content
    if (audioBuffer && !isRecording) {
      // Simple tap always plays/pauses
      if (isLooping) {
        stopCurrentLoop();
      } else {
        // If no selection, play entire buffer
        if (selectionStart === selectionEnd) {
          playLoopSelection(0, audioBuffer.duration);
        } else {
          // Ensure selection is valid
          const safeStart = Math.max(0, Math.min(selectionStart, audioBuffer.duration - 0.01));
          const safeEnd = Math.max(safeStart + 0.01, Math.min(selectionEnd, audioBuffer.duration));
          
          // Play current selection
          playLoopSelection(safeStart, safeEnd);
        }
      }
      
      // Ensure audio context is running
      startAudioContext();
    }
  }, { passive: true });

  const button = document.createElement("button");
  button.id = "record-button";
  button.className = "record-button";
  button.onclick = toggleRecording;

  const hud = document.createElement("div");
  hud.id = "hud";
  hud.className = "hud";
  
  // Create audio device dropdown
  const deviceDropdown = document.createElement("div");
  deviceDropdown.className = "audio-device-dropdown";
  
  const select = document.createElement("select");
  select.id = "audio-device-select";
  select.addEventListener("change", handleDeviceChange);
  
  deviceDropdown.appendChild(select);
  
  // Create input VU meter
  const vuMeter = document.createElement("div");
  vuMeter.className = "vu-meter";
  
  const vuMeterLevel = document.createElement("div");
  vuMeterLevel.className = "vu-meter-level";
  
  vuMeter.appendChild(vuMeterLevel);
  
  // Create output VU meter
  const outputVuMeter = document.createElement("div");
  outputVuMeter.className = "output-vu-meter";
  
  const outputVuMeterLevel = document.createElement("div");
  outputVuMeterLevel.className = "output-vu-meter-level";
  
  outputVuMeter.appendChild(outputVuMeterLevel);

  app.appendChild(waveformDiv);
  app.appendChild(button);
  app.appendChild(hud);
  app.appendChild(deviceDropdown);
  app.appendChild(vuMeter);
  app.appendChild(outputVuMeter);
  document.body.appendChild(app);
  
  // Initialize audio devices
  getAudioInputDevices();
  
  // Request permissions and setup VU meter
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      setupAudioAnalyser();
      // Also setup output analyzer
      setupOutputAnalyser();
    })
    .catch(err => {
      console.error("❌ Initial microphone access error:", err);
    });
}

// Listen for device changes (plugging/unplugging microphones)
navigator.mediaDevices.addEventListener('devicechange', getAudioInputDevices);

// Wait until DOM is ready
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", handleResize);

// Modified toggleRecording to handle looping
async function toggleRecording() {
  // Stop any existing loop when starting a new recording
  if (!isRecording) {
    stopCurrentLoop();
  }
  
  isRecording = !isRecording;
  updateButtonState();

  if (isRecording) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("❌ getUserMedia not supported on this device.");
      alert(
        "❌ Microphone access is not supported on this device. Please use Safari on iOS with HTTPS."
      );
      return;
    }

    try {
      // Required for iOS: Ensure a user gesture first
      await startAudioContext();

      // Clear previous waveform if exists
      if (document.getElementById('waveform')) {
        document.getElementById('waveform').innerHTML = '';
      }
      
      // Cancel previous animation frame if exists
      if (liveRecordingVisualizer) {
        cancelAnimationFrame(liveRecordingVisualizer);
      }

      // Request microphone access using selected device
      const constraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      liveRecordingStream = stream;
      
      // Setup live visualization
      setupLiveWaveformVisualizer();

      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          // Stop live visualization when recording stops
          if (liveRecordingVisualizer) {
            cancelAnimationFrame(liveRecordingVisualizer);
            liveRecordingVisualizer = null;
          }
          
          // Hide live waveform canvas
          const liveCanvas = document.querySelector('.live-waveform');
          if (liveCanvas) {
            liveCanvas.style.display = 'none';
          }
          
          const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

          // Ensure Blob is correctly converted to an ArrayBuffer
          const reader = new FileReader();
          reader.readAsArrayBuffer(audioBlob);

          reader.onloadend = async () => {
            try {
              const arrayBuffer = reader.result; // Get the ArrayBuffer from FileReader
              audioBuffer = await Tone.getContext().rawContext.decodeAudioData(
                arrayBuffer
              );
              visualizeWaveform(audioBlob);
            } catch (decodeError) {
              console.error("❌ Error decoding audio data:", decodeError);
            }
          };
        } catch (err) {
          console.error("❌ Error handling audio Blob:", err);
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("❌ Error accessing microphone:", err);
      alert(
        "❌ Microphone access denied. Go to Settings > Safari > Enable Microphone."
      );
    }
  } else if (mediaRecorder) {
    mediaRecorder.stop();
  }
}

// After the app is initialized, add this code
function setupMobileOptimizations() {
  if (deviceDetection.isMobile() || deviceDetection.isTablet()) {
    console.log("📱 Mobile or tablet device detected, applying optimizations");
    
    // Apply class to body for CSS targeting
    document.body.classList.add('mobile-optimized');
    
    // Disable all zooming gestures
    const disableZoom = (event) => {
      // Prevent default only if it's a zoom gesture (multiple touches)
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
        console.log("🚫 Zoom gesture prevented");
        return false;
      }
    };
    
    // Add event listeners to prevent zoom
    document.addEventListener('touchstart', disableZoom, { passive: false });
    document.addEventListener('touchmove', disableZoom, { passive: false });
    
    // Block all gesture events more aggressively
    document.addEventListener('gesturestart', function(e) {
      e.preventDefault();
      console.log("🚫 Gesture prevented");
      return false;
    }, { passive: false });
    
    document.addEventListener('gesturechange', function(e) {
      e.preventDefault();
      return false;
    }, { passive: false });
    
    document.addEventListener('gestureend', function(e) {
      e.preventDefault();
      return false;
    }, { passive: false });
    
    // For Safari, add specific double-touch prevention
    document.addEventListener('touchend', function(e) {
      const now = Date.now();
      const DOUBLE_TAP_THRESHOLD = 300;
      
      if (typeof lastTouchEnd === 'undefined') {
        lastTouchEnd = now;
        return;
      }
      
      // Prevent double tap to zoom
      if (now - lastTouchEnd <= DOUBLE_TAP_THRESHOLD) {
        e.preventDefault();
      }
      
      lastTouchEnd = now;
    }, { passive: false });
    
    // Prevent default touch behaviors that interfere with the app
    document.addEventListener('touchmove', function(e) {
      // More aggressive prevention - stop all default touch move behaviors
      e.preventDefault();
    }, { passive: false });
    
    // Prevent browser navigation gestures on the waveform
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.addEventListener('touchstart', function(e) {
        e.preventDefault();
      }, { passive: false });
    }
    
    // Apply to waveform specifically
    const waveformDiv = document.querySelector('.waveform');
    if (waveformDiv) {
      waveformDiv.addEventListener('touchmove', function(e) {
        e.preventDefault();
      }, { passive: false });
      
      waveformDiv.addEventListener('gesturestart', function(e) {
        e.preventDefault();
      }, { passive: false });
    }
    
    // Add viewport meta tag to prevent scaling/zooming - failsafe if not in HTML
    let metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) {
      metaViewport = document.createElement('meta');
      metaViewport.setAttribute('name', 'viewport');
      document.head.appendChild(metaViewport);
    }
    metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    
    // Add specific iOS/Android class to body for CSS targeting
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      document.body.classList.add('ios-device');
    } else if (/Android/i.test(navigator.userAgent)) {
      document.body.classList.add('android-device');
    }
    
    // Make buttons larger on mobile
    document.querySelectorAll('button').forEach(button => {
      button.classList.add('mobile-button');
    });
    
    console.log("✅ Mobile optimizations applied - zoom disabled");
  }
}

// Call this after initializing your app
setupMobileOptimizations();

export { visualizeWaveform, toggleRecording, startAudioContext };

function setupTouchInteractions() {
  if (!deviceDetection.isMobile() && !deviceDetection.isTablet()) {
    return; // Only apply touch optimizations on mobile/tablet devices
  }
  
  console.log("📱 Setting up touch interactions for mobile/tablet");
  
  const waveformContainer = document.querySelector('.waveform');
  if (!waveformContainer) {
    console.warn("⚠️ Waveform container not found for touch setup");
    return;
  }
  
  // Create selection markers
  let startMarker = document.createElement('div');
  startMarker.className = 'selection-marker start-line';
  startMarker.style.display = 'none';
  
  let endMarker = document.createElement('div');
  endMarker.className = 'selection-marker end-line';
  endMarker.style.display = 'none';
  
  // Add markers to the DOM
  document.body.appendChild(startMarker);
  document.body.appendChild(endMarker);
  
  // Touch state variables
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let lastTapTime = 0; // For double-tap detection
  let activeTouches = {}; // Track active touches by identifier
  let selectionInProgress = false;
  let selectionStartTime = null;
  let selectionEndTime = null;
  
  // Show tutorial hint if user hasn't seen it yet
  if (!localStorage.getItem('touchSelectionHintShown')) {
    showTouchSelectionHint();
    localStorage.setItem('touchSelectionHintShown', 'true');
  }
  
  // Handle touch start
  waveformContainer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartTime = Date.now();
    
    // Store each touch that starts
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      activeTouches[touch.identifier] = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: touchStartTime
      };
    }
    
    // If we now have exactly one touch active
    if (Object.keys(activeTouches).length === 1) {
      const touchId = Object.keys(activeTouches)[0];
      const touch = activeTouches[touchId];
      touchStartX = touch.startX;
      touchStartY = touch.startY;
      
      // Single touch could be the start of a selection or a tap
      if (audioBuffer) {
        // Calculate position in audio timeline
        const rect = waveformContainer.getBoundingClientRect();
        const relativeX = (touchStartX - rect.left) / rect.width;
        selectionStartTime = relativeX * audioBuffer.duration;
        selectionInProgress = true;
        
        // Initially both start and end are the same
        selectionStart = selectionStartTime;
        selectionEnd = selectionStartTime;
        updateHUD();
        
        // Show the start marker
        startMarker.style.display = 'block';
        startMarker.style.left = `${touchStartX}px`;
        
        console.log("👆 Touch start - potential selection start at:", selectionStartTime);
      }
    }
    // If we now have two touches active, this is a multi-touch selection
    else if (Object.keys(activeTouches).length === 2) {
      console.log("👉👆 Two-finger selection started");
      
      // The first finger position remains as selection start
      // No need to change selectionStartTime as it's already set
      
      // Get the second finger position for selection end
      const touchIds = Object.keys(activeTouches);
      const secondTouchId = touchIds[1]; // The newest touch
      const secondTouch = activeTouches[secondTouchId];
      
      if (audioBuffer) {
        const rect = waveformContainer.getBoundingClientRect();
        const relativeX = (secondTouch.currentX - rect.left) / rect.width;
        selectionEndTime = Math.max(0, Math.min(relativeX * audioBuffer.duration, audioBuffer.duration));
        
        // Update selection with the two finger positions
        selectionStart = Math.min(selectionStartTime, selectionEndTime);
        selectionEnd = Math.max(selectionStartTime, selectionEndTime);
        updateHUD();
        
        // Show both markers
        endMarker.style.display = 'block';
        endMarker.style.left = `${secondTouch.currentX}px`;
        
        // Visually update the selection
        if (window.waveformInstance) {
          ee.emit('select', selectionStart, selectionEnd);
        }
      }
    }
  }, { passive: false });
  
  // Handle touch move
  waveformContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    
    // Update positions for all changed touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (activeTouches[touch.identifier]) {
        activeTouches[touch.identifier].currentX = touch.clientX;
        activeTouches[touch.identifier].currentY = touch.clientY;
      }
    }
    
    // If we have one active touch and selection has started
    if (Object.keys(activeTouches).length === 1 && selectionInProgress) {
      const touchId = Object.keys(activeTouches)[0];
      const touch = activeTouches[touchId];
      
      // Update selection end based on current touch position
      if (audioBuffer) {
        const rect = waveformContainer.getBoundingClientRect();
        const relativeX = (touch.currentX - rect.left) / rect.width;
        selectionEndTime = Math.max(0, Math.min(relativeX * audioBuffer.duration, audioBuffer.duration));
        
        // Update selection with ordered start/end times
        selectionStart = Math.min(selectionStartTime, selectionEndTime);
        selectionEnd = Math.max(selectionStartTime, selectionEndTime);
        updateHUD();
        
        // Update marker positions
        startMarker.style.left = `${touch.startX}px`;
        endMarker.style.display = 'block';
        endMarker.style.left = `${touch.currentX}px`;
        
        // Visually update the selection
        if (window.waveformInstance) {
          ee.emit('select', selectionStart, selectionEnd);
        }
      }
    }
    // If we have two active touches
    else if (Object.keys(activeTouches).length === 2) {
      // Get the touch positions
      const touchIds = Object.keys(activeTouches);
      const firstTouch = activeTouches[touchIds[0]];
      const secondTouch = activeTouches[touchIds[1]];
      
      if (audioBuffer) {
        const rect = waveformContainer.getBoundingClientRect();
        
        // Get positions for both touches
        const firstRelativeX = (firstTouch.currentX - rect.left) / rect.width;
        const secondRelativeX = (secondTouch.currentX - rect.left) / rect.width;
        
        // Convert to audio time positions
        const firstTime = Math.max(0, Math.min(firstRelativeX * audioBuffer.duration, audioBuffer.duration));
        const secondTime = Math.max(0, Math.min(secondRelativeX * audioBuffer.duration, audioBuffer.duration));
        
        // Update selection times (ordered)
        selectionStart = Math.min(firstTime, secondTime);
        selectionEnd = Math.max(firstTime, secondTime);
        updateHUD();
        
        // Update markers
        if (firstTime < secondTime) {
          startMarker.style.left = `${firstTouch.currentX}px`;
          endMarker.style.left = `${secondTouch.currentX}px`;
        } else {
          startMarker.style.left = `${secondTouch.currentX}px`;
          endMarker.style.left = `${firstTouch.currentX}px`;
        }
        startMarker.style.display = 'block';
        endMarker.style.display = 'block';
        
        // Visually update the selection
        if (window.waveformInstance) {
          ee.emit('select', selectionStart, selectionEnd);
        }
      }
    }
  }, { passive: false });
  
  // Handle touch end
  waveformContainer.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touchEndTime = Date.now();
    
    // Remove ended touches from our tracking
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      delete activeTouches[touch.identifier];
    }
    
    // If we still have active touches, maintain markers
    if (Object.keys(activeTouches).length > 0) {
      // Keep markers visible
    } 
    // No more touches active - handle selection completion
    else {
      // If this was a quick tap without much movement
      const touchDuration = touchEndTime - touchStartTime;
      const touchMoved = Math.abs(e.changedTouches[0].clientX - touchStartX) > 20 || 
                         Math.abs(e.changedTouches[0].clientY - touchStartY) > 20;
      
      if (!touchMoved && touchDuration < 300) {
        // Check for double-tap
        const timeSinceLastTap = touchEndTime - lastTapTime;
        
        if (timeSinceLastTap < 300) {
          // Double-tap detected - toggle fullscreen
          console.log("👆👆 Double-tap detected - toggling fullscreen");
          toggleFullscreen();
          lastTapTime = 0; // Reset to prevent triple tap detection
          
          // Hide markers
          startMarker.style.display = 'none';
          endMarker.style.display = 'none';
        } else {
          // Single tap - toggle play/pause
          console.log("👆 Single tap detected - toggling playback");
          if (audioBuffer) {
            if (isLooping) {
              stopCurrentLoop();
            } else {
              // Play either selection or entire buffer
              if (selectionStart < selectionEnd && selectionEnd - selectionStart > 0.01) {
                playLoopSelection(selectionStart, selectionEnd);
              } else {
                playLoopSelection(0, audioBuffer.duration);
                
                // Hide markers since we're playing the whole file
                startMarker.style.display = 'none';
                endMarker.style.display = 'none';
              }
            }
          }
          
          lastTapTime = touchEndTime;
        }
      } 
      // If there's a valid selection after interaction
      else if (selectionStart < selectionEnd && selectionEnd - selectionStart > 0.01) {
        console.log("✅ Selection completed:", selectionStart, selectionEnd);
        
        // Keep markers visible for the selection
        
        // Auto-play the selection
        playLoopSelection(selectionStart, selectionEnd);
      } else {
        // Hide markers if selection is too small
        startMarker.style.display = 'none';
        endMarker.style.display = 'none';
      }
      
      // Reset selection state
      selectionInProgress = false;
    }
    
    updateHUD();
  }, { passive: false });
  
  // Handle touch cancel
  waveformContainer.addEventListener('touchcancel', (e) => {
    // Reset all touch tracking on cancel
    activeTouches = {};
    selectionInProgress = false;
    
    // Hide markers
    startMarker.style.display = 'none';
    endMarker.style.display = 'none';
  }, { passive: false });
  
  // Function to show tutorial hint
  function showTouchSelectionHint() {
    const hint = document.createElement('div');
    hint.className = 'touch-selection-hint';
    hint.innerHTML = `
      <strong>Multi-touch Selection:</strong><br>
      • Use one finger to mark in/out points<br>
      • Use two fingers to select start and end points<br>
      • Double-tap for fullscreen
    `;
    document.body.appendChild(hint);
    
    // Remove hint after animation completes
    setTimeout(() => {
      if (hint.parentNode) {
        document.body.removeChild(hint);
      }
    }, 6000);
  }
}

// Enhance the toggleFullscreen function
function toggleFullscreen() {
  console.log("🔍 Toggling fullscreen mode");
  
  // Create or update fullscreen indicator
  let indicator = document.querySelector('.fullscreen-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'fullscreen-indicator';
    document.body.appendChild(indicator);
  }
  
  // Check if we're in fullscreen already
  const isCurrentlyFullscreen = !!(document.fullscreenElement || 
                                 document.webkitFullscreenElement || 
                                 document.mozFullScreenElement || 
                                 document.msFullscreenElement);
  
  if (!isCurrentlyFullscreen) {
    // Request fullscreen on the appropriate element
    const appElement = document.getElementById('app') || document.documentElement;
    
    try {
      if (appElement.requestFullscreen) {
        appElement.requestFullscreen();
      } else if (appElement.webkitRequestFullscreen) { // Safari
        appElement.webkitRequestFullscreen();
      } else if (appElement.mozRequestFullScreen) { // Firefox
        appElement.mozRequestFullScreen();
      } else if (appElement.msRequestFullscreen) { // IE/Edge
        appElement.msRequestFullscreen();
      }
      
      console.log("🔍 Entering fullscreen mode");
      
      // Add fullscreen styling
      document.body.classList.add('fullscreen-mode');
      
      // Update indicator with exit fullscreen icon
      indicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
        </svg>
      `;
      
      // Show and update the indicator
      indicator.style.display = 'flex';
      
    } catch (err) {
      console.error("❌ Error entering fullscreen:", err);
    }
  } else {
    // Exit fullscreen
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
      }
      
      console.log("🔍 Exiting fullscreen mode");
      
      // Remove fullscreen styling
      document.body.classList.remove('fullscreen-mode');
      
      // Update indicator with enter fullscreen icon
      indicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
        </svg>
      `;
    } catch (err) {
      console.error("❌ Error exiting fullscreen:", err);
    }
  }
  
  // Show a hint about double-tap for new users (only if localStorage indicates first use)
  if (!localStorage.getItem('doubleTapHintShown')) {
    const hint = document.createElement('div');
    hint.className = 'double-tap-hint';
    hint.textContent = isCurrentlyFullscreen ? 'Double-tap to exit fullscreen' : 'Double-tap anywhere to enter fullscreen';
    document.body.appendChild(hint);
    
    // Remove hint after animation completes
    setTimeout(() => {
      if (hint.parentNode) {
        document.body.removeChild(hint);
      }
    }, 5000);
    
    // Mark as shown in localStorage
    localStorage.setItem('doubleTapHintShown', 'true');
  }
}

// Listen for fullscreen change events
document.addEventListener('fullscreenchange', updateFullscreenIndicator);
document.addEventListener('webkitfullscreenchange', updateFullscreenIndicator);
document.addEventListener('mozfullscreenchange', updateFullscreenIndicator);
document.addEventListener('MSFullscreenChange', updateFullscreenIndicator);

// Update the fullscreen indicator when fullscreen state changes
function updateFullscreenIndicator() {
  const isFullscreen = !!(document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement || 
                        document.msFullscreenElement);
  
  let indicator = document.querySelector('.fullscreen-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'fullscreen-indicator';
    document.body.appendChild(indicator);
  }
  
  // Update indicator appearance based on fullscreen state
  if (isFullscreen) {
    document.body.classList.add('fullscreen-mode');
    indicator.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
      </svg>
    `;
  } else {
    document.body.classList.remove('fullscreen-mode');
    indicator.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
      </svg>
    `;
  }
}

// Initialize all event listeners 
function initializeEventListeners() {
  console.log("📣 Setting up event listeners");

  // Add keyboard listener for space bar to toggle playback
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault(); // Prevent page scroll
      if (audioBuffer) {
        if (isLooping) {
          stopCurrentLoop();
        } else {
          // If no selection, play entire buffer
          if (selectionStart === selectionEnd) {
            playLoopSelection(0, audioBuffer.duration);
          } else {
            // Ensure selection is valid
            const safeStart = Math.max(0, Math.min(selectionStart, audioBuffer.duration - 0.01));
            const safeEnd = Math.max(safeStart + 0.01, Math.min(selectionEnd, audioBuffer.duration));
            
            // Play current selection with safe values
            playLoopSelection(safeStart, safeEnd);
          }
        }
      }
    }
  }, { passive: false });
  
  // Add strong unlock events for iOS, Android, etc.
  ["touchstart", "touchend", "mousedown", "mouseup", "click"].forEach(eventType => {
    document.body.addEventListener(eventType, function unlockAudio() {
      // Force Tone.js and Web Audio to start
      Tone.start();
      startAudioContext();
      console.log(`🔓 Audio unlocked via ${eventType}`);
      
      // Remove all these listeners once unlocked
      ["touchstart", "touchend", "mousedown", "mouseup", "click"].forEach(e => {
        document.body.removeEventListener(e, unlockAudio);
      });
    }, { once: true, passive: true });
  });
  
  // Setup fullscreen change listeners
  document.addEventListener('fullscreenchange', updateFullscreenIndicator);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIndicator);
  document.addEventListener('mozfullscreenchange', updateFullscreenIndicator);
  document.addEventListener('MSFullscreenChange', updateFullscreenIndicator);
  
  // File drop area event listeners
  const dropArea = document.getElementById('drop-area');
  if (dropArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', handleDrop, false);
  }
  
  // File input change event
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleFiles, false);
  }
}


