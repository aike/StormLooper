export class Transport {
  constructor(ctx) {
    this.ctx = ctx;
    this.bpm = 120;
    this.isRunning = false;
    this.startTime = null;   // audioCtx time when "beat 0" occurred

    this._lookahead = 0.15;  // schedule ahead by 150ms
    this._interval = 25;     // scheduler fires every 25ms
    this._timer = null;
    this._callbacks = [];    // {time, fn}
    this._tickListeners = new Set();
    this._rafId = null;
  }

  get beatDuration() { return 60 / this.bpm; }
  get barDuration()  { return this.beatDuration * 4; }

  ensureRunning() { if (!this.isRunning) this.start(); }

  start() {
    if (this.isRunning) return;
    this.startTime = this.ctx.currentTime;
    this.isRunning = true;
    this._runScheduler();
    this._runTick();
  }

  stop() {
    this.isRunning = false;
    clearInterval(this._timer);
    cancelAnimationFrame(this._rafId);
  }

  setBPM(bpm) {
    bpm = Math.max(20, Math.min(300, Math.round(bpm)));
    if (bpm === this.bpm) return;
    if (this.isRunning) {
      // Preserve fractional beat position when changing BPM
      const beatPos = this._beatFloat();
      this.bpm = bpm;
      this.startTime = this.ctx.currentTime - beatPos * this.beatDuration;
    } else {
      this.bpm = bpm;
    }
  }

  _beatFloat() {
    if (!this.isRunning) return 0;
    return Math.max(0, (this.ctx.currentTime - this.startTime) / this.beatDuration);
  }

  getBeatInfo() {
    if (!this.isRunning) return { beat: 0, bar: 0, fraction: 0, running: false };
    const t = this._beatFloat();
    return {
      running: true,
      beat: Math.floor(t) % 4,      // 0-3
      bar:  Math.floor(t / 4),
      fraction: t % 1,              // 0-1 position within beat
    };
  }

  // Quantized loop span for a buffer of given duration (mirrors LoopScheduler logic)
  computeLoopSpan(bufDur) {
    const beatDur = this.beatDuration;
    const barDur  = this.barDuration;
    const beats   = bufDur / beatDur;
    if (beats < 1.5) return beatDur;
    if (beats < 2.5) return beatDur * 2;
    return Math.max(barDur, Math.ceil(bufDur / barDur + 1e-6) * barDur);
  }

  // AudioCtx time of the start of the next bar (>= fromTime)
  getNextBarTime(fromTime) {
    return this.getNextBoundaryTime(this.barDuration, fromTime);
  }

  // AudioCtx time of the next boundary aligned to spanSeconds from transport startTime
  getNextBoundaryTime(spanSeconds, fromTime) {
    this.ensureRunning();
    const t = fromTime ?? this.ctx.currentTime;
    const elapsed = (t - this.startTime) / spanSeconds;
    return this.startTime + Math.ceil(elapsed + 1e-4) * spanSeconds;
  }

  // Schedule fn to be called when audioCtx time >= time (within lookahead)
  scheduleAt(time, fn) {
    this._callbacks.push({ time, fn });
  }

  // Register a callback for every animation frame (visual updates)
  onTick(fn) {
    this._tickListeners.add(fn);
    return () => this._tickListeners.delete(fn);
  }

  _runScheduler() {
    this._timer = setInterval(() => {
      if (!this.isRunning) return;
      const deadline = this.ctx.currentTime + this._lookahead;
      const fire = this._callbacks.filter(c => c.time <= deadline);
      this._callbacks = this._callbacks.filter(c => c.time > deadline);
      fire.forEach(c => c.fn(c.time));
    }, this._interval);
  }

  _runTick() {
    const tick = () => {
      if (!this.isRunning) return;
      const info = this.getBeatInfo();
      this._tickListeners.forEach(fn => fn(info));
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }
}
