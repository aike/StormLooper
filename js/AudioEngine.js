import { DELAY, MASTER_VOL, COMPRESSOR } from './config.js';

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
    this.compressor.threshold.value = COMPRESSOR.threshold;
    this.compressor.knee.value      = COMPRESSOR.knee;
    this.compressor.ratio.value     = COMPRESSOR.ratio;
    this.compressor.attack.value    = COMPRESSOR.attack;
    this.compressor.release.value   = COMPRESSOR.release;

    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'allpass';

    // Delay: send input → delay → feedback loop + wet out → masterFilter
    this.delaySendInput = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = DELAY.timeMs / 1000;
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = DELAY.feedback;
    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.value = DELAY.wet;

    this.delaySendInput.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delaySendInput);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.masterFilter);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = MASTER_VOL;
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

  async loadUrl(url) {
    await this.resume();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
    const buf = await resp.arrayBuffer();
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
      // LPF: 0 → 20000 Hz (flat), -1 → 100 Hz (max cut)
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.value = 20000 * Math.pow(100 / 20000, Math.abs(val));
    } else {
      // HPF: 0 → 20 Hz (flat), +1 → 5000 Hz (max cut)
      this.masterFilter.type = 'highpass';
      this.masterFilter.frequency.value = 20 * Math.pow(5000 / 20, val);
    }
  }
}
