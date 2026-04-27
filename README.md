# StormLooper

A browser-based loop station inspired by the BOSS RC-505, built with vanilla JavaScript and the Web Audio API. No build step, no dependencies.

![StormLooper screenshot](https://placeholder)

## Features

- **Unlimited loop tracks** — add as many tracks as you need
- **Three input sources per track**
  - 🎤 **MIC** — record from any connected microphone
  - 🎹 **SYNTH** — record the built-in synthesizer while you play
  - 📂 **FILE** — load any audio file (WAV, MP3, OGG, …)
- **BPM clock** — set tempo with the +/− buttons, direct text input, or tap tempo
- **Beat-aligned recording** — pressing REC waits for the next bar's beat 1 before capturing audio
- **Bar-aligned playback** — loops always start at the next bar head after pressing PLAY or finishing a recording
- **Smart loop quantization** based on recorded length:
  | Buffer length | Loop interval |
  |---------------|---------------|
  | < 1.5 beats   | every 1 beat  |
  | 1.5 – 2.5 beats | every 2 beats |
  | > 2.5 beats   | rounded up to nearest bar |
- **Auto-play after recording** — the loop starts automatically once you stop recording
- **Per-track controls** — volume fader, stereo pan, play/stop toggle
- **Real-time position display** — progress bar and beat/bar counter per track
- **Global beat indicator** — 4-dot bar display with bar counter in the transport strip
- **Built-in synthesizer** — oscillator types (sine, square, sawtooth, triangle), ADSR envelope, octave selector, on-screen keyboard with PC keyboard support

## Requirements

- A modern browser with Web Audio API and ES Modules support (Chrome 80+, Firefox 75+, Safari 14+, Edge 80+)
- A local HTTP server (ES Modules cannot be loaded from `file://`)

## Getting Started

```bash
# Clone or download the project, then serve it with any static server.

# Option A — Node.js (npx, no install required)
npx serve .

# Option B — Python
python -m http.server 8080

# Option C — VS Code
# Install the "Live Server" extension, right-click index.html → Open with Live Server
```

Open `http://localhost:3000` (or whichever port your server uses) in your browser and click **START**.

## Usage

### Recording a loop

1. Click **＋ Add Track** to create a new track.
2. Select a source: **MIC**, **SYNTH**, or **FILE**.
   - **FILE** opens a file picker immediately — the loop starts playing once the file loads.
3. For MIC/SYNTH, click **REC**. The track badge shows `⏳ WAIT BEAT 1` while counting down to the next bar.
4. Recording begins automatically at beat 1. Play your part.
5. Click **REC** again (now labelled **STOP REC**) to finish. The loop starts playing from the next bar automatically.

### Playback controls

| Button | Behaviour |
|--------|-----------|
| **▶ PLAY** | Waits for the next bar head, then starts looping from the beginning |
| **⏹ STOP** | Stops immediately and resets the playback position to the start |

### BPM

- Use **◀ / ▶** to step ±1 BPM (hold Shift for ±10).
- Click the BPM number to type a value directly; confirm with Enter.
- Click **TAP** repeatedly to set tempo by feel (uses the average of the last 8 taps within 3 seconds).
- Changing BPM while loops are playing takes effect immediately.

### Keyboard Shortcuts

Shortcuts are active when focus is not inside a text field or select element.

#### Recording

| Key | Action |
|-----|--------|
| `Space` | Start REC on the selected track (or stop if already recording) |

Works regardless of where focus is, as long as the PROPERTIES panel is open. Exception: does not fire when editing a track name.

#### BPM

| Key / Gesture | Action |
|---|---|
| **↑** (BPM field focused) | BPM +1 |
| **↓** (BPM field focused) | BPM −1 |
| **Enter** (BPM field focused) | Confirm value |
| **Shift** + click ◀ | BPM −10 |
| **Shift** + click ▶ | BPM +10 |

#### Synthesizer — white keys

| Key | Note |
|-----|------|
| `A` | C |
| `S` | D |
| `D` | E |
| `F` | F |
| `G` | G |
| `H` | A |
| `J` | B |
| `K` | C (next octave) |

#### Synthesizer — black keys

| Key | Note |
|-----|------|
| `W` | C# |
| `E` | D# |
| `T` | F# |
| `Y` | G# |
| `U` | A# |

Keys can be held and released like a real keyboard — each key triggers note-on on press and note-off on release. Multiple keys can be held simultaneously.

## Project Structure

```
looper/
├── index.html          # Minimal shell — just mounts #app and loads main.js
└── js/
    ├── main.js         # Bootstrap: init overlay, AudioContext gate
    ├── styles.js       # All CSS injected as a <style> tag at runtime
    ├── AudioEngine.js  # AudioContext, master gain, dynamics compressor
    ├── Transport.js    # BPM clock, beat scheduler, bar/boundary helpers
    ├── LoopTrack.js    # Single loop: LoopScheduler (bar-aligned playback), waveform
    ├── Recorder.js     # Beat-aligned mic/synth recording via MediaRecorder
    ├── Synth.js        # Oscillator synth with ADSR envelope
    └── UI.js           # Entire DOM built in JavaScript; no HTML templates
```

The UI is generated entirely in JavaScript — `index.html` contains no markup beyond the `#app` mount point.

## Browser Permissions

Microphone access is requested the first time you press **REC** with the MIC source selected. The permission prompt is shown by the browser; no data is sent anywhere.

## License

MIT
