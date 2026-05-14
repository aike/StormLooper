// Demo configuration — loaded when URL contains ?demo=1
// WAV files must be placed under ./wav/ on the server.
// All fields are optional; omit to keep defaults.

export const DEMO_CONFIG = {
  bpm:          135,
  masterVol:    0.85,
  masterFilter: 0,      // -1 (LPF max) … 0 (flat) … +1 (HPF max)
  delayTime:    250,    // ms

  tracks: [
    {
      file:    './wav/808_Kick_oneshot.wav',
      name:    'Kick',
      volume:  0.9,
      pan:     0,
      length:  '1beat',
      timing:  0,
      send:    0,
      muted:   false,
    },
    {
      file:    './wav/808_135_CCOC_16x4.wav',
      name:    'Hi-hat',
      volume:  0.6,
      pan:     0.3,
      length:  '1beat',
      timing:  0,
      send:    0,
      muted:   false,
    },
    {
      file:    './wav/SynthSeq_135_A.wav',
      name:    'Synth A',
      volume:  0.8,
      pan:    -0.2,
      length:  '2bars',
      timing:  0,
      send:    0,
      muted:   true,
    },
    {
      file:    './wav/SynthSeq_135_D.wav',
      name:    'Synth D',
      volume:  0.8,
      pan:     0.2,
      length:  '2bars',
      timing:  0,
      send:    0.2,
      muted:   false,
    },
  ],
};
