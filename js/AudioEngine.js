export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterFilter = null;
    this.compressor = null;
    this.delaySendInput = null;
    this.delayNode = null;
    this.feedbackGain = null;
    this.delayWetGain = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 3;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;

    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'allpass';

    // Delay: send input → delay → feedback loop + wet out → masterFilter
    this.delaySendInput = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.25;
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.4;
    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.value = 1;

    this.delaySendInput.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delaySendInput);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.masterFilter);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.masterFilter);
    this.masterFilter.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.initialized = true;
  }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }

  async loadFile(file) {
    await this.resume();
    const buf = await file.arrayBuffer();
    return this.ctx.decodeAudioData(buf);
  }

  setMasterVolume(val) {
    if (this.masterGain) this.masterGain.gain.value = val;
  }

  setDelayTime(ms) {
    if (this.delayNode) this.delayNode.delayTime.value = ms / 1000;
  }

  // val: -1 (LPF max) … 0 (flat) … +1 (HPF max)
  setMasterFilter(val) {
    if (!this.masterFilter) return;
    if (val === 0) {
      this.masterFilter.type = 'allpass';
      return;
    }
    if (val < 0) {
      // LPF: 0 → 20 000 Hz (flat), -1 → 20 Hz (max cut)
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 20000 * Math.pow(20 / 20000, Math.abs(val));
    } else {
      // HPF: 0 → 20 Hz (flat), +1 → 20 000 Hz (max cut)
      this.masterFilter.type = 'highpass';
      this.masterFilter.frequency.value = 20 * Math.pow(20000 / 20, val);
    }
  }
}
