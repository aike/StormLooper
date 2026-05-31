// Latency compensation per source type (milliseconds).
// Tracks start playback this many ms early so the recorded audio aligns with the grid.
export const LATENCY = {
  file:  0,
  synth: 50,
  mic:   100,
};

// Master volume initial value (0–1).
export const MASTER_VOL = 0.85;

// Master dynamics compressor settings.
export const COMPRESSOR = {
  threshold: -6,    // dB
  knee:       3,    // dB
  ratio:      4,    // compression ratio
  attack:     0.005, // seconds
  release:    0.15,  // seconds
};

// Master delay default parameters.
export const DELAY = {
  timeMs:   350,  // delay time in milliseconds (100–500)
  feedback: 0.4,  // feedback gain (0–1)
  wet:      1.0,  // wet output gain (0–1)
};

// App background colors — applied as CSS custom properties (--bg … --bg4).
export const APP_BG = {
  bg:  '#111',
  bg2: '#1c1c1c',
  bg3: '#242424',
  bg4: '#2e2e2e',
};

// Track circle — waveform fill color per source type.
// 'muted' is used when the track is muted or in the ready (stopped) state.
export const TRACK_COLORS = {
  mic:   '#2860cc',
  synth: '#cc0088',
  file:  '#aabbdd',
  muted: '#444444',
};

// Track circle — dark background fill per source type.
export const TRACK_BG = {
  mic:   '#0d1520',
  synth: '#110d22',
  file:  '#0d1520',
};

// Progress ring colors.
export const RING_COLORS = {
  bg:        '#1e1e1e',  // ring track (always visible)
  recording: '#da1111',
  pending:   '#ed3cb5',
  playing:   '#202090',
};

// Track circle border glow per state.
// 'ring' is the solid outline color; 'glow' is the diffuse halo color.
export const CIRCLE_STATE = {
  playing:   { ring: '#421dbc', glow: 'rgba(100, 100, 255, 1.0)'  },
  selected:  { ring: '#afd3ff', glow: 'rgba(230, 240, 255, 1.0)' },
  recording: { ring: '#da1111', glow: 'rgba(255, 68, 68, 1.0)' },
};
