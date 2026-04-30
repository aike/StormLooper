export class Recorder {
  constructor(audioEngine) {
    this.engine = audioEngine;
    this.mediaRecorder = null;
    this.chunks = [];
    this.recording = false;

    this._micStream  = null;
    this._micSource  = null;
    this._monitorGain = null;
    this._recordDest = null;
    this._synthSource = null;

    this._pendingTimer  = null;   // setTimeout: fires at countdown bar start
    this._pendingTimer2 = null;   // setTimeout: fires at actual recording start
    this.onCountdownBar   = null; // callback(barAudioTime) fired when countdown bar begins
    this.onRecordingStart = null; // callback fired when recording actually begins
  }

  // ── Beat-aligned mic recording ──────────────────────────────────────────
  // Returns a Promise that resolves when recording has started (at beat 1).
  // Call stop() to end recording and receive the AudioBuffer.
  async startMicAligned(transport, monitor = false, deviceId = null) {
    const audioConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (deviceId) audioConstraints.deviceId = { exact: deviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    const ctx = this.engine.ctx;
    await this.engine.resume();

    this._micStream = stream;
    this._micSource = ctx.createMediaStreamSource(stream);

    if (monitor) {
      this._monitorGain = ctx.createGain();
      this._monitorGain.gain.value = 0.4;
      this._micSource.connect(this._monitorGain);
      this._monitorGain.connect(this.engine.masterGain);
    }

    this._recordDest = ctx.createMediaStreamDestination();
    this._micSource.connect(this._recordDest);

    return this._waitForRecordStart(transport);
  }

  // ── Beat-aligned synth recording ─────────────────────────────────────────
  startSynthAligned(synthOutputNode, transport) {
    const ctx = this.engine.ctx;
    this._recordDest = ctx.createMediaStreamDestination();
    this._synthSource = synthOutputNode;
    synthOutputNode.connect(this._recordDest);

    return this._waitForRecordStart(transport);
  }

  // Wait one countdown bar (metronome), then start MediaRecorder at the following bar.
  _waitForRecordStart(transport) {
    const ctx            = this.engine.ctx;
    const now            = ctx.currentTime;
    const countdownStart = transport.getNextBarTime();       // bar where metronome plays
    const recordStart    = countdownStart + transport.barDuration; // bar where recording begins

    return new Promise((resolve) => {
      this._pendingTimer = setTimeout(() => {
        this._pendingTimer = null;
        if (this.onCountdownBar) this.onCountdownBar(countdownStart);
      }, Math.max(0, (countdownStart - now) * 1000));

      this._pendingTimer2 = setTimeout(() => {
        this._pendingTimer2 = null;
        this._startMediaRecorder(this._recordDest.stream);
        if (this.onRecordingStart) this.onRecordingStart();
        resolve();
      }, Math.max(0, (recordStart - now) * 1000));
    });
  }

  _startMediaRecorder(stream) {
    this.chunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

    this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(100);
    this.recording = true;
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (this._pendingTimer || this._pendingTimer2) {
        clearTimeout(this._pendingTimer);
        clearTimeout(this._pendingTimer2);
        this._pendingTimer = this._pendingTimer2 = null;
        this._cleanup();
        resolve(null);
        return;
      }
      if (!this.mediaRecorder || !this.recording) {
        this._cleanup();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
          const ab = await blob.arrayBuffer();
          const buffer = await this.engine.ctx.decodeAudioData(ab);
          this._cleanup();
          resolve(buffer);
        } catch (err) {
          this._cleanup();
          reject(err);
        }
      };
      this.mediaRecorder.stop();
      this.recording = false;
    });
  }

  cancel() {
    if (this._pendingTimer)  { clearTimeout(this._pendingTimer);  this._pendingTimer  = null; }
    if (this._pendingTimer2) { clearTimeout(this._pendingTimer2); this._pendingTimer2 = null; }
    if (this.mediaRecorder && this.recording) {
      this.mediaRecorder.onstop = null;
      try { this.mediaRecorder.stop(); } catch (_) {}
      this.recording = false;
    }
    this._cleanup();
  }

  _cleanup() {
    if (this._micSource)   { try { this._micSource.disconnect();    } catch (_) {} this._micSource = null; }
    if (this._monitorGain) { try { this._monitorGain.disconnect();  } catch (_) {} this._monitorGain = null; }
    if (this._micStream)   { this._micStream.getTracks().forEach(t => t.stop()); this._micStream = null; }
    if (this._synthSource && this._recordDest) {
      try { this._synthSource.disconnect(this._recordDest); } catch (_) {}
      this._synthSource = null;
    }
    this._recordDest = null;
  }
}
