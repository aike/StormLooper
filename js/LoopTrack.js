let trackIdCounter = 1;

// ── Loop span calculation ──────────────────────────────────────────────────────
// mode: '1beat'|'2beats'|'1bar'|'2bars'|'4bars'|'8bars'|'16bars'|'auto'
function _computeSpan(mode, bufDur, beatDur, barDur) {
  switch (mode) {
    case '1beat':  return beatDur;
    case '2beats': return beatDur * 2;
    case '1bar':   return barDur;
    case '2bars':  return barDur * 2;
    case '4bars':  return barDur * 4;
    case '8bars':  return barDur * 8;
    case '16bars': return barDur * 16;
    case 'auto':
    default: {
      const beats = bufDur / beatDur;
      if (beats < 1.5) return beatDur;
      if (beats < 2.5) return beatDur * 2;
      return Math.max(barDur, Math.ceil(bufDur / barDur + 1e-6) * barDur);
    }
  }
}

// ── LoopScheduler ─────────────────────────────────────────────────────────────
// Manages bar-aligned, self-rescheduling playback of one LoopTrack.
class LoopScheduler {
  constructor(track, transport) {
    this.track = transport ? track : null;
    this.transport = transport;
    this._active = false;
    this._gen = 0;          // generation counter — invalidates stale callbacks
    this._sources = [];
    this._nextPlayTime = null;
  }

  start(startBarTime) {
    this._stopSources();
    this._gen++;
    this._active = true;
    this._nextPlayTime = startBarTime;
    this._scheduleLoop(this._gen);
  }

  stop() {
    this._active = false;
    this._stopSources();
  }

  reschedule() {
    if (!this._active) return;
    const next = this.transport.getNextBarTime();
    this._stopSources();
    this._gen++;
    this._nextPlayTime = next;
    this._scheduleLoop(this._gen);
  }

  getLoopSpan() {
    return _computeSpan(
      this.track.lengthMode,
      this.track.buffer.duration,
      this.transport.beatDuration,
      this.transport.barDuration
    );
  }

  // Position info for UI: fraction through loop (0-1), beat in bar (0-3), etc.
  getPositionInfo() {
    if (!this._active || this._nextPlayTime == null) return null;
    const now = this.transport.ctx.currentTime;
    const span = this.getLoopSpan();
    const beatDur = this.transport.beatDuration;
    const barDur  = this.transport.barDuration;
    const bufDur  = this.track.buffer.duration;

    // Most recent loop start (always <= now)
    let loopStart = this._nextPlayTime - span;
    while (loopStart > now) loopStart -= span;

    const elapsed  = now - loopStart;
    const frac     = Math.min(elapsed / span, 1);
    const inBuffer = elapsed < bufDur;

    // Global beat info from transport
    const info = this.transport.getBeatInfo();

    // Unit and position depend on loop span
    const spanBeats = span / beatDur;
    let unitLabel, stepInLoop, totalSteps;
    if (spanBeats < 1.5) {
      unitLabel   = 'Beat';
      stepInLoop  = 0;
      totalSteps  = 1;
    } else if (spanBeats < 2.5) {
      unitLabel   = 'Beat';
      stepInLoop  = Math.floor(elapsed / beatDur);
      totalSteps  = 2;
    } else {
      unitLabel   = 'Bar';
      stepInLoop  = Math.floor(elapsed / barDur);
      totalSteps  = Math.max(1, Math.round(span / barDur));
    }

    return { frac, inBuffer, unitLabel, stepInLoop, totalSteps, beat: info.beat, fraction: info.fraction };
  }

  _getLoopSpan() { return this.getLoopSpan(); }

  _scheduleLoop(gen) {
    if (!this._active || gen !== this._gen) return;
    const now = this.transport.ctx.currentTime;
    const span = this._getLoopSpan();
    const win  = this.transport._lookahead + 0.1;

    while (this._nextPlayTime < now + win) {
      this._scheduleOnce(this._nextPlayTime);
      this._nextPlayTime += span;
    }

    this.transport.scheduleAt(this._nextPlayTime - this.transport._lookahead, () => {
      this._scheduleLoop(gen);
    });
  }

  _scheduleOnce(startTime) {
    const ctx     = this.transport.ctx;
    const now     = ctx.currentTime;
    if (startTime < now - 0.05) return;

    const span      = this._getLoopSpan();
    const bufDur    = this.track.buffer.duration;
    const beatDur   = this.transport.beatDuration;
    const timing    = this.track.timing;
    const spanBeats = Math.max(1, Math.round(span / beatDur));

    // Place a buffer source: when=scheduled start, bufOffset=buffer read position,
    // stopAt=audio context time to stop, looping=wrap within [0,bufDur).
    // Adjusts bufOffset for late scheduling so audio stays in sync.
    const place = (when, bufOffset, stopAt, looping = false) => {
      if (stopAt - when < 1e-9) return;
      const t    = Math.max(when, now);
      if (t >= stopAt) return;
      const skip = t - when; // seconds already elapsed since scheduled start
      const s = ctx.createBufferSource();
      s.buffer = this.track.buffer;
      if (looping) {
        s.loop = true; s.loopStart = 0; s.loopEnd = bufDur;
        s.connect(this.track.gainNode);
        s.start(t, (bufOffset + skip) % bufDur);
      } else {
        s.connect(this.track.gainNode);
        s.start(t, bufOffset + skip);
      }
      s.stop(stopAt);
      this._sources.push(s);
      s.onended = () => {
        const i = this._sources.indexOf(s);
        if (i >= 0) this._sources.splice(i, 1);
        try { s.disconnect(); } catch (_) {}
      };
    };

    if (timing === 0) {
      place(startTime, 0, startTime + Math.min(bufDur, span));
      return;
    }

    if (timing > 0) {
      // Positive TIMING: delay the head by N beats; tail of buffer fills the gap.
      // delayBeats is wrapped to [0, spanBeats) so timing > span is handled.
      const delayBeats = ((timing % spanBeats) + spanBeats) % spanBeats;
      const delay      = delayBeats * beatDur;

      if (delay < 1e-9) {
        place(startTime, 0, startTime + Math.min(bufDur, span));
        return;
      }

      // Tail fragment: looping buffer starting at position (bufDur - delay%bufDur).
      // This guarantees the looping tail ends exactly at buffer position 0,
      // so the transition into the head fragment is seamless.
      const rem       = delay % bufDur;
      const tailStart = rem < 1e-9 ? 0 : bufDur - rem;
      place(startTime, tailStart, startTime + delay, true);

      // Head fragment: buffer from position 0 after the delay
      const headDur = Math.min(bufDur, span - delay);
      place(startTime + delay, 0, startTime + delay + headDur);

    } else {
      // Negative TIMING: seek |timing| beats into the buffer before playing.
      // seekBeats is wrapped to [0, spanBeats) using JS remainder (sign follows dividend).
      const seekBeats = Math.abs(timing % spanBeats);
      const seekSec   = seekBeats === 0 ? 0 : (seekBeats * beatDur) % bufDur;

      if (seekSec < 1e-9) {
        place(startTime, 0, startTime + Math.min(bufDur, span));
        return;
      }

      const playDur = Math.min(bufDur - seekSec, span);
      place(startTime, seekSec, startTime + playDur);
    }
  }

  _stopSources() {
    for (const src of this._sources) {
      try { src.stop(); }      catch (_) {}
      try { src.disconnect(); } catch (_) {}
    }
    this._sources = [];
  }
}

// ── LoopTrack ─────────────────────────────────────────────────────────────────
export class LoopTrack {
  constructor(audioEngine) {
    this.id = trackIdCounter++;
    this.engine = audioEngine;
    this.buffer = null;
    this.name = `Track ${this.id}`;
    this.state = 'empty'; // empty | pending | recording | ready | playing

    const ctx = audioEngine.ctx;
    this.gainNode = ctx.createGain();
    this.panNode  = ctx.createStereoPanner();
    this.gainNode.connect(this.panNode);
    this.panNode.connect(audioEngine.masterGain);

    this.volume     = 0.8;
    this.pan        = 0;
    this.muted      = false;
    this.lengthMode = '4bars';
    this.timing     = 0;
    this.gainNode.gain.value = this.volume;
    this.panNode.pan.value   = this.pan;

    this.scheduler = null;

    // Recording metadata
    this.recordStartBarTime = null;
  }

  setBuffer(buffer) {
    this.buffer = buffer;
    this.state = 'ready';
  }

  computeLoopSpan(transport) {
    if (!this.buffer) return null;
    return _computeSpan(this.lengthMode, this.buffer.duration, transport.beatDuration, transport.barDuration);
  }

  // Start bar-aligned looping via the scheduler
  startLooping(transport, startBarTime) {
    this.stopLooping();
    this.scheduler = new LoopScheduler(this, transport);
    this.scheduler.start(startBarTime);
    this.state = 'playing';
  }

  stopLooping() {
    if (this.scheduler) {
      this.scheduler.stop();
      this.scheduler = null;
    }
    if (this.buffer) this.state = 'ready';
    else this.state = 'empty';
  }

  // Convenience: stop=stop looping, clear=wipe buffer
  stop()  { this.stopLooping(); }
  clear() { this.stopLooping(); this.buffer = null; this.state = 'empty'; }

  setMute(muted) {
    this.muted = muted;
    this.gainNode.gain.value = muted ? 0 : this.volume;
  }

  setVolume(vol) {
    this.volume = vol;
    if (!this.muted) this.gainNode.gain.value = vol;
  }

  setPan(pan) {
    this.pan = pan;
    this.panNode.pan.value = pan;
  }

  dispose() {
    this.stopLooping();
    try { this.gainNode.disconnect(); } catch (_) {}
    try { this.panNode.disconnect();  } catch (_) {}
  }

  // Returns normalized Float32Array of peak amplitudes for radial waveform drawing.
  // Stereo buffers use the sum of both channels. Peak-normalizes so quiet sources remain visible.
  getWaveformSamples(count) {
    if (!this.buffer) return null;
    const ch0  = this.buffer.getChannelData(0);
    const ch1  = this.buffer.numberOfChannels > 1 ? this.buffer.getChannelData(1) : null;
    const step = Math.max(1, Math.floor(ch0.length / count));
    const out  = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let peak = 0;
      for (let j = 0; j < step; j++) {
        const idx = i * step + j;
        const v = ch1
          ? Math.abs(ch0[idx] ?? 0) + Math.abs(ch1[idx] ?? 0)
          : Math.abs(ch0[idx] ?? 0);
        if (v > peak) peak = v;
      }
      out[i] = peak;
    }
    const maxPeak = out.reduce((m, v) => v > m ? v : m, 0);
    if (maxPeak > 0) {
      const scale = 1 / maxPeak;
      for (let i = 0; i < count; i++) out[i] *= scale;
    }
    return out;
  }

  drawWaveform(canvas) {
    if (!canvas.width) canvas.width = canvas.clientWidth || 400;
    const ctx2d = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx2d.clearRect(0, 0, w, h);
    ctx2d.fillStyle = '#0d0d0d';
    ctx2d.fillRect(0, 0, w, h);

    if (!this.buffer) {
      ctx2d.fillStyle = '#333';
      ctx2d.font = '10px sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText('no audio', w / 2, h / 2 + 3);
      return;
    }

    const data = this.buffer.getChannelData(0);
    const step = Math.max(1, Math.ceil(data.length / w));
    const mid  = h / 2;

    ctx2d.strokeStyle = this.state === 'playing' ? '#44dd44' : '#4499ff';
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    for (let x = 0; x < w; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i++) {
        const s = data[x * step + i] ?? 0;
        if (s < min) min = s;
        if (s > max) max = s;
      }
      ctx2d.moveTo(x, mid + min * mid * 0.9);
      ctx2d.lineTo(x, mid + max * mid * 0.9);
    }
    ctx2d.stroke();
  }
}
