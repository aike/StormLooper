export class Metronome {
  constructor(audioEngine) {
    this.ctx        = audioEngine.ctx;
    this.masterGain = audioEngine.masterGain;
    this._active    = false;
    this._gen       = 0;
    this._transport = null;
    this._nextBeatTime = null;
  }

  start(transport) {
    this._active = false; // stop any previous chain
    this._transport = transport;
    transport.ensureRunning();
    this._gen++;
    this._active = true;
    this._nextBeatTime = transport.getNextBoundaryTime(transport.beatDuration);
    this._scheduleNext(this._gen);
  }

  stop() {
    this._active = false;
    this._transport = null;
    this._nextBeatTime = null;
  }

  _scheduleNext(gen) {
    if (!this._active || gen !== this._gen) return;
    const t   = this._transport;
    const now = this.ctx.currentTime;
    const win = t._lookahead + 0.1;

    while (this._nextBeatTime < now + win) {
      // Beat index: 0 = beat 1 (downbeat), 1-3 = other beats
      const beatIndex = Math.round(
        (this._nextBeatTime - t.startTime) / t.beatDuration
      ) % 4;
      this._click(this._nextBeatTime, beatIndex === 0);
      this._nextBeatTime += t.beatDuration;
    }

    t.scheduleAt(this._nextBeatTime - t._lookahead, () => {
      this._scheduleNext(gen);
    });
  }

  _click(time, isDownbeat) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = isDownbeat ? 1000 : 600;

    env.gain.setValueAtTime(0.18, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.018);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.022);
    osc.onended = () => {
      try { osc.disconnect(); env.disconnect(); } catch (_) {}
    };
  }
}
