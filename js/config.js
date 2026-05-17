// Latency compensation per source type (milliseconds).
// Tracks start playback this many ms early so the recorded audio aligns with the grid.
export const LATENCY = {
  file:  0,
  synth: 50,
  mic:   100,
};

// Master delay default parameters.
export const DELAY = {
  timeMs:   350,  // delay time in milliseconds (100–500)
  feedback: 0.4,  // feedback gain (0–1)
  wet:      1.0,  // wet output gain (0–1)
};
