// Latency compensation per source type (milliseconds).
// Tracks start playback this many ms early so the recorded audio aligns with the grid.
export const LATENCY = {
  file:  0,
  synth: 50,
  mic:   100,
};
