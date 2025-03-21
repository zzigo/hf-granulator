# HF Granulator

A minimalist granular audio processor with a clean heads-up display (HUD) interface.

## Features

- Record audio directly from any connected input device
- Visualize waveforms in real-time
- Select and loop portions of audio
- Automatic looping of selected regions
- Clean, minimal UI with transparent HUD display
- VU meter visualization for input and output levels
- Full-width waveform visualization
- Mobile-friendly with touch gesture support

## Usage

1. Select an audio input device from the dropdown menu
2. Click the record button to start/stop recording
3. After recording, the waveform will appear
4. Click and drag to select a portion of the audio
5. Selected portions automatically play in a loop
6. Press spacebar to stop/start playback
7. Double-click to play from a specific position

## Technical Details

Built with:
- Vanilla JavaScript
- Tone.js for audio processing
- WaveformPlaylist for waveform visualization
- Web Audio API

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## License

MIT 