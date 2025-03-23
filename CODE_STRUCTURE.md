# Hyperphone Granulator - Code Structure

This document provides a detailed explanation of the Hyperphone Granulator codebase structure, design principles, and key components.

## Overall Architecture

The Hyperphone Granulator is built as a single-file web application (`index.html`) containing HTML, CSS, and JavaScript. This design choice was made to ensure portability, ease of deployment, and elimination of external dependencies.

The application follows a modular approach within a single file, with clearly defined sections:

```mermaid
graph TD
    A[HTML Structure] --> B[CSS Styling]
    B --> C[JavaScript Code]
    C --> D[Event Handlers]
    C --> E[Audio Processing]
    C --> F[Visualization]
    C --> G[UI Components]
```

## Code Modules

### 1. Global Variables and Initialization

```javascript
// Global variables for audio context, buffer, recorder, etc.
let audioContext = null, audioBuffer = null, mediaRecorder = null;
// Variables for recording and playback state
let isRecording = false, isPlaying = false, selectedRegion = { start: 0, end: 0 };
// Additional state variables for UI and interactions
```

This section defines all global variables and state management objects used throughout the application.

### 2. UI Initialization

```javascript
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Initialize canvas, Web Audio API, and UI components
  // Set up event listeners for user interactions
}
```

The initialization function sets up the audio context, creates necessary audio nodes, binds event listeners, and prepares the canvas for visualization.

### 3. Audio Recording and Processing

```javascript
async function startRecording() {
  // Request microphone access
  // Create MediaRecorder and start capturing audio
}

function stopRecording() {
  // Stop recording and process captured audio
}

async function processAudioBlob(blob) {
  // Decode audio data and apply processing
  // Draw waveform and update UI
}
```

This module handles capturing audio from the microphone, converting it to usable audio data, and applying any necessary processing (such as noise reduction).

### 4. Noise Reduction

```javascript
async function calibrateNoise() {
  // Record ambient noise for calibration
}

async function processNoiseProfile(chunks) {
  // Process recorded noise data to create a noise profile
}

function computeNoiseSpectrum(buffer) {
  // Compute frequency spectrum of noise
}

async function denoiseAudio(buffer, noiseProfile) {
  // Apply spectral subtraction noise reduction
}
```

The noise reduction system creates a profile of ambient noise and uses spectral subtraction to remove it from recordings.

### 5. Visualization

```javascript
function drawWaveform() {
  // Render audio waveform on canvas
}

function drawSpectrogram() {
  // Generate and display spectrogram for frequency visualization
}

function drawVuMeter() {
  // Display real-time volume level
}
```

Visualization functions convert audio data into visual representations, including time-domain waveforms and frequency-domain spectrograms.

### 6. Region Selection and Playback

```javascript
function handleCanvasClick(e) {
  // Process mouse/touch interactions for region selection
}

function drawRegion() {
  // Create and display the selected region with handles
}

function playSelection() {
  // Play the selected region with looping
}
```

These functions manage the creation and manipulation of playback regions, including the UI elements for selection and the audio playback logic.

### 7. Effect Processing

```javascript
// FreeVerb implementation
class FreeverbNode extends AudioWorkletProcessor {
  // Implement Schroeder's reverb algorithm
}

function createConvolver() {
  // Fallback reverb using ConvolverNode
}

function makeDistortionCurve(amount) {
  // Create custom distortion curve
}
```

The effects processing section implements various audio effects, including the FreeVerb reverb algorithm and distortion processing.

### 8. Touch and Gesture Handling

```javascript
function handleTouchStart(e) {
  // Process touch interactions based on finger count
}

function handleTouchMove(e) {
  // Handle multi-touch gestures for parameter control
}

function handleTouchEnd(e) {
  // Clean up after touch interactions
}
```

This module manages touch interactions, allowing for rich gesture-based control of various parameters.

### 9. Signal Processing Utilities

```javascript
function fft(real, imag) {
  // Fast Fourier Transform implementation
}

function ifft(real, imag) {
  // Inverse Fast Fourier Transform
}
```

Utility functions for spectral analysis and synthesis, used in noise reduction and spectrogram generation.

## Audio Signal Flow

The audio signal flow in the application follows this path:

```mermaid
flowchart TD
    Mic[Microphone] --> MSS[MediaStreamSource]
    MSS --> IA[InputAnalyser]
    
    subgraph "Processing Stage"
        AB[AudioBuffer] --> NR[Noise Reduction]
        NR --> PS[Playback Source]
    end
    
    subgraph "Effect Chain"
        PS --> PA[PlaybackAnalyser]
        PS --> DG[DistortionGain]
        DG --> Dist[Distortion]
        Dist --> Gain[Gain]
    end
    
    subgraph "Reverb Path"
        Gain --> DryG[DryGain]
        Gain --> RN[ReverbNode]
        RN --> WetG[WetGain]
    end
    
    DryG --> OG[OutputGain]
    WetG --> OG
    OG --> Dest[Destination/Speakers]
```

## Web Audio API Node Graph

```mermaid
graph TB
    AI[AudioInput] --> InputA[InputAnalyser]
    InputA --> LPF[LowPassFilter]
    LPF --> HPF[HighPassFilter]
    HPF --> Split{Split Path}
    Split --> DryGain
    Split --> ReverbNode
    ReverbNode --> WetGain
    DryGain --> OutG[OutputGain]
    WetGain --> OutG
    OutG --> Dest[Destination]
    
    classDef input fill:#f96;
    classDef filter fill:#9cf;
    classDef effect fill:#c9f;
    classDef output fill:#9f9;
    
    class AI input;
    class LPF,HPF filter;
    class ReverbNode effect;
    class Dest output;
```

## State Diagram for Application Workflow

```mermaid
stateDiagram-v2
    [*] --> Idle: Initialize
    Idle --> Recording: Press Space/Record Button
    Recording --> Processing: Press Space/Record Button
    Processing --> Ready: Audio Decoded
    Ready --> RegionStart: First Click
    RegionStart --> RegionComplete: Second Click
    RegionComplete --> Playing: Autoplay
    Playing --> Ready: End Playback
    Playing --> Idle: Clear Selection
    Ready --> Idle: Clear Selection
    Idle --> NoiseCalibrating: Press N
    NoiseCalibrating --> NoiseEnabled: Calibration Complete
    NoiseEnabled --> NoiseDisabled: Toggle Noise (N)
    NoiseDisabled --> NoiseEnabled: Toggle Noise (N)
    NoiseDisabled --> NoiseCalibrating: Recalibrate
```

## Responsive Design

The application uses CSS media queries and relative sizing to ensure functionality across different screen sizes:

```css
@media (max-width: 768px) {
  .record-button { width: 80px; height: 80px; bottom: 30px; }
  .status, .mode-indicator, .noise-indicator { font-size: 14px; }
}
```

## Key Browser APIs Used

1. **Web Audio API**: Core audio processing capabilities
2. **Canvas API**: Visualization of audio data
3. **MediaRecorder API**: Capture audio from microphone
4. **TouchEvents API**: Handle multi-touch interactions
5. **FullScreen API**: Enable full-screen mode
6. **AudioWorklet API**: Implement custom audio processing (FreeVerb)

## Performance Considerations

- RequestAnimationFrame for efficient rendering
- Canvas optimization for smooth visualization
- Audio buffer management to prevent memory leaks
- Touch event optimization for mobile performance 