export class Synth {
  constructor(audioEngine) {
    this.engine = audioEngine;
    this.type = 'sine';
    this.attack = 0.01;
    this.decay = 0.15;
    this.sustain = 0.6;
    this.release = 0.4;
    this.octave = 4;

    this.outputGain = audioEngine.ctx.createGain();
    this.outputGain.gain.value = 0.75;
    this.outputGain.connect(audioEngine.masterGain);

    this.activeNotes = new Map();
  }

  noteOn(freq) {
    if (this.activeNotes.has(freq)) return;
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = this.type;
    osc.frequency.value = freq;

    // Slight detune for richness on sawtooth/square
    if (this.type === 'sawtooth' || this.type === 'square') {
      const osc2 = ctx.createOscillator();
      const env2 = ctx.createGain();
      osc2.type = this.type;
      osc2.frequency.value = freq;
      osc2.detune.value = 5;
      env2.gain.value = 0.4;
      osc2.connect(env2);
      env2.connect(env);
      osc2.start(now);
      this.activeNotes.set(freq, { osc, env, osc2, env2 });
    } else {
      this.activeNotes.set(freq, { osc, env });
    }

    osc.connect(env);
    env.connect(this.outputGain);

    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + this.attack);
    env.gain.linearRampToValueAtTime(this.sustain, now + this.attack + this.decay);

    osc.start(now);
  }

  noteOff(freq) {
    const note = this.activeNotes.get(freq);
    if (!note) return;
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    const end = now + this.release;

    note.env.gain.cancelScheduledValues(now);
    note.env.gain.setValueAtTime(note.env.gain.value, now);
    note.env.gain.linearRampToValueAtTime(0, end);
    note.osc.stop(end + 0.05);

    if (note.osc2) {
      note.env2.gain.cancelScheduledValues(now);
      note.env2.gain.setValueAtTime(note.env2.gain.value, now);
      note.env2.gain.linearRampToValueAtTime(0, end);
      note.osc2.stop(end + 0.05);
    }

    this.activeNotes.delete(freq);
  }

  allNotesOff() {
    for (const [freq] of this.activeNotes) this.noteOff(freq);
  }

  noteFreq(note, octave) {
    const notes = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const semitone = notes[note];
    // MIDI note: C4=60, A4=69 → (octave+1)*12 + semitone
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}
