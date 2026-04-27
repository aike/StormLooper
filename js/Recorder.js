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

    this._pendingTimer = null;  // setTimeout handle for beat-aligned start
    this.onRecordingStart = null; // callback fired when recording actually begins
  }

  // ── Beat-aligned mic recording ──────────────────────────────────────────
  // Returns a Promise that resolves when recording has started (at beat 1).
  // Call stop() to end recording and receive the AudioBuffer.
  async startMicAligned(transport, monitor = false) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
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

    return this._waitForBeat1(transport);
  }

  // ── Beat-aligned synth recording ─────────────────────────────────────────
  startSynthAligned(synthOutputNode, transport) {
    const ctx = this.engine.ctx;
    this._recordDest = ctx.createMediaStreamDestination();
    this._synthSource = synthOutputNode;
    synthOutputNode.connect(this._recordDest);

    return this._waitForBeat1(transport);
  }

  // Wait until the next bar's beat 1 to start MediaRecorder
  _waitForBeat1(transport) {
    const nextBarTime = transport.getNextBarTime();
    const delayMs = Math.max(0, (nextBarTime - this.engine.ctx.currentTime) * 1000);

    return new Promise((resolve) => {
      this._pendingTimer = setTimeout(() => {
        this._pendingTimer = null;
        this._startMediaRecorder(this._recordDest.stream);
        if (this.onRecordingStart) this.onRecordingStart();
        resolve();
      }, delayMs);
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
      if (this._pendingTimer) {
        clearTimeout(this._pendingTimer);
        this._pendingTimer = null;
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
    if (this._pendingTimer) { clearTimeout(this._pendingTimer); this._pendingTimer = null; }
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
