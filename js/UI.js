import { LoopTrack } from './LoopTrack.js';
import { Recorder } from './Recorder.js';
import { Metronome } from './Metronome.js';

const CIRCLE_D = 192;  // circle diameter px
const WAVE_N   = 360;  // waveform sample count (1 per degree)

export class UI {
  constructor(audioEngine, synth, transport) {
    this.engine    = audioEngine;
    this.synth     = synth;
    this.transport = transport;
    this.recorder  = new Recorder(audioEngine);

    this.tracks          = [];
    this.recordingTrack  = null;
    this._trackUIs       = new Map();
    this._tracksContainer = null;
    this._toastContainer  = null;
    this._selectedTrack   = null;
    this._propertiesBody  = null;
    this._stopAllBtn      = null;
    this._savedPlayingIds = null;
    this._synthPanel      = null;
    this._metronome       = new Metronome(audioEngine);
    this._metroBtn        = null;

    this._globalDots   = [];
    this._barCounterEl = null;
    this._tapTimes     = [];
  }

  build(root) {
    root.appendChild(this._makeHeader());
    root.appendChild(this._makeTransportBar());

    const layout = el('div', 'main-layout');

    const left = el('div', '');
    left.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
    left.appendChild(this._makeToolbar());

    this._tracksContainer = el('div', 'tracks-panel');
    this._showEmptyState();
    left.appendChild(this._tracksContainer);

    layout.appendChild(left);

    const rightPanel = el('div', 'right-panel');
    rightPanel.appendChild(this._makePropertiesPanel());
    this._synthPanel = this._makeSynthPanel();
    this._synthPanel.style.display = 'none';
    rightPanel.appendChild(this._synthPanel);
    layout.appendChild(rightPanel);

    root.appendChild(layout);

    this._toastContainer = el('div', 'toast-container');
    document.body.appendChild(this._toastContainer);

    this.transport.onTick(info => this._onGlobalTick(info));
    this._bindKeyboard();
  }

  // ── Header ────────────────────────────────────────────────────────────────
  _makeHeader() {
    const hdr = el('div', 'header');
    const titles = el('div', '');
    titles.innerHTML = `<div class="header-title">StormLooper</div><div class="header-subtitle">Web Audio Looper application</div>`;
    hdr.appendChild(titles);
    hdr.appendChild(el('div', 'header-spacer'));

    const master = el('div', 'master-section');
    master.innerHTML = `
      <span class="master-label">MASTER VOL</span>
      <input type="range" id="master-vol" min="0" max="1" step="0.01" value="0.85" style="width:80px">
      <span id="master-vol-val" style="font-size:10px;color:var(--text-dim);min-width:30px">85%</span>
    `;
    master.querySelector('#master-vol').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.engine.setMasterVolume(v);
      master.querySelector('#master-vol-val').textContent = Math.round(v * 100) + '%';
    });
    hdr.appendChild(master);
    return hdr;
  }

  // ── Transport Bar ─────────────────────────────────────────────────────────
  _makeTransportBar() {
    const bar = el('div', 'transport-bar stopped');
    bar.id = 'transport-bar';

    const bpmGroup = el('div', 'bpm-group');
    const bpmLabel = el('span', 'bpm-label'); bpmLabel.textContent = 'BPM';
    bpmGroup.appendChild(bpmLabel);

    const bpmDisplay = el('div', 'bpm-display');

    const bpmDown = btn('◀', 'btn btn-default btn-icon btn-sm', () => {
      this.transport.setBPM(this.transport.bpm - 1); this._updateBpmDisplay(bpmVal);
    });
    bpmDown.addEventListener('click', (e) => {
      if (e.shiftKey) { this.transport.setBPM(this.transport.bpm - 10); this._updateBpmDisplay(bpmVal); }
    });

    const bpmVal = el('span', 'bpm-value');
    bpmVal.textContent = this.transport.bpm;
    bpmVal.contentEditable = 'true';
    bpmVal.spellcheck = false;
    bpmVal.addEventListener('blur', () => {
      const v = parseInt(bpmVal.textContent);
      if (!isNaN(v)) this.transport.setBPM(v);
      bpmVal.textContent = this.transport.bpm;
    });
    bpmVal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); bpmVal.blur(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); this.transport.setBPM(this.transport.bpm + 1); this._updateBpmDisplay(bpmVal); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.transport.setBPM(this.transport.bpm - 1); this._updateBpmDisplay(bpmVal); }
    });

    const bpmUp = btn('▶', 'btn btn-default btn-icon btn-sm', () => {
      this.transport.setBPM(this.transport.bpm + 1); this._updateBpmDisplay(bpmVal);
    });
    bpmUp.addEventListener('click', (e) => {
      if (e.shiftKey) { this.transport.setBPM(this.transport.bpm + 10); this._updateBpmDisplay(bpmVal); }
    });

    const tapBtn = el('button', 'tap-btn');
    tapBtn.textContent = 'TAP';
    tapBtn.addEventListener('click', () => this._tapTempo(bpmVal));

    bpmDisplay.append(bpmDown, bpmVal, bpmUp, tapBtn);
    bpmGroup.appendChild(bpmDisplay);

    const beatSec = el('div', 'beat-display');
    const dots = el('div', 'beat-dots');
    this._globalDots = [];
    for (let i = 0; i < 4; i++) {
      const d = el('div', i === 0 ? 'beat-dot beat-1' : 'beat-dot');
      d.title = `Beat ${i + 1}`;
      dots.appendChild(d);
      this._globalDots.push(d);
    }
    this._barCounterEl = el('span', 'bar-counter');
    this._barCounterEl.textContent = 'Bar --';
    beatSec.append(dots, this._barCounterEl);

    bar.append(bpmGroup, beatSec);
    return bar;
  }

  _updateBpmDisplay(el) { el.textContent = this.transport.bpm; }

  _tapTempo(bpmEl) {
    const now = performance.now();
    this._tapTimes.push(now);
    this._tapTimes = this._tapTimes.filter(t => now - t < 3000).slice(-8);
    if (this._tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this._tapTimes.length; i++)
        intervals.push(this._tapTimes[i] - this._tapTimes[i - 1]);
      const avg = intervals.reduce((a, b) => a + b) / intervals.length;
      this.transport.setBPM(Math.round(60000 / avg));
      bpmEl.textContent = this.transport.bpm;
    }
  }

  // ── Global tick ───────────────────────────────────────────────────────────
  _onGlobalTick(info) {
    const bar = document.getElementById('transport-bar');
    if (bar) bar.classList.toggle('stopped', !info.running);
    for (let i = 0; i < 4; i++)
      this._globalDots[i]?.classList.toggle('active', info.running && info.beat === i);
    if (this._barCounterEl)
      this._barCounterEl.textContent = info.running ? `Bar ${info.bar + 1}` : 'Bar --';
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────
  _makeToolbar() {
    const bar = el('div', 'toolbar');
    this._stopAllBtn = btn('⏹ Stop All', 'btn btn-default', () => this._toggleStopStart());
    this._metroBtn   = btn('METRO', 'btn btn-default', () => this._toggleMetro());
    bar.append(
      btn('＋ Add Track', 'btn btn-blue',  () => this._addTrack()),
      this._stopAllBtn,
      btn('✕ Clear All', 'btn btn-danger', () => this._clearAll()),
      this._metroBtn,
    );
    return bar;
  }

  _toggleMetro() {
    if (this._metronome._active) {
      this._metronome.stop();
      this._metroBtn.className = 'btn btn-default';
    } else {
      this._metronome.start(this.transport);
      this._metroBtn.className = 'btn btn-amber active';
    }
  }

  _showEmptyState() {
    this._tracksContainer.innerHTML = `
      <div class="tracks-empty">
        <div class="tracks-empty-icon">🎵</div>
        <div>Add a track to start looping</div>
        <div style="font-size:11px;color:#555">Record from mic, play the synth, or load a WAV file</div>
      </div>`;
  }

  // ── Properties Panel ──────────────────────────────────────────────────────
  _makePropertiesPanel() {
    const panel = el('div', 'properties-panel');
    const title = el('div', 'panel-title'); title.textContent = 'PROPERTIES';
    panel.appendChild(title);
    this._propertiesBody = el('div', 'properties-body');
    this._showNoSelection();
    panel.appendChild(this._propertiesBody);
    return panel;
  }

  _showNoSelection() {
    this._propertiesBody.innerHTML = '';
    this._updateSynthVisibility();
  }

  _selectTrack(track) {
    if (this._selectedTrack === track) return;

    if (this._selectedTrack) {
      const prevUI = this._trackUIs.get(this._selectedTrack.id);
      if (prevUI) prevUI.card.classList.remove('selected');
    }

    this._selectedTrack = track;
    const ui = this._trackUIs.get(track.id);
    if (!ui) return;

    ui.card.classList.add('selected');
    this._propertiesBody.innerHTML = '';
    this._propertiesBody.appendChild(ui._controlsEl);
    this._updateSynthVisibility();
  }

  // ── Track management ──────────────────────────────────────────────────────
  _addTrack() {
    const empty = this._tracksContainer.querySelector('.tracks-empty');
    if (empty) empty.remove();

    const track = new LoopTrack(this.engine);
    this.tracks.push(track);
    const ui = this._makeTrackUI(track);
    this._tracksContainer.appendChild(ui.card);
    this._trackUIs.set(track.id, ui);

    // Position circle based on initial vol/pan, after layout renders
    const idx = this.tracks.length - 1;
    requestAnimationFrame(() => {
      const cW     = this._tracksContainer.clientWidth  || 500;
      const cH     = this._tracksContainer.clientHeight || 300;
      const rangeW = Math.max(1, cW - CIRCLE_D);
      const rangeH = Math.max(1, cH - CIRCLE_D);
      const left = Math.max(0, Math.min(cW - CIRCLE_D,
        ((track.pan + 1) / 2) * rangeW + idx * 24));
      const top = Math.max(0, Math.min(cH - CIRCLE_D,
        (1 - track.volume) * rangeH + idx * 24));
      ui.card.style.left = left + 'px';
      ui.card.style.top  = top  + 'px';
    });

    this._selectTrack(track);
  }

  _removeTrack(track) {
    const wasSelected = this._selectedTrack === track;
    if (wasSelected) {
      this._selectedTrack = null;
      this._propertiesBody.innerHTML = '';
    }
    if (this.recordingTrack === track) {
      this.recorder.cancel();
      this.recordingTrack = null;
    }
    track.dispose();
    this.tracks = this.tracks.filter(t => t.id !== track.id);
    const ui = this._trackUIs.get(track.id);
    if (ui) {
      if (ui._unsubTick)    ui._unsubTick();
      if (ui._dragCleanup) ui._dragCleanup();
      ui.card.remove();
      this._trackUIs.delete(track.id);
    }
    if (this.tracks.length === 0) {
      this._showEmptyState();
      this._showNoSelection();
    } else if (wasSelected) {
      this._selectTrack(this.tracks[this.tracks.length - 1]);
    }
  }

  _toggleStopStart() {
    if (this._savedPlayingIds === null) this._stopAll();
    else                                this._startAll();
  }

  _stopAll() {
    this._savedPlayingIds = new Set(
      this.tracks.filter(t => t.state === 'playing').map(t => t.id)
    );
    this.tracks.forEach(t => t.stop());
    this._trackUIs.forEach((ui, id) => {
      const t = this.tracks.find(x => x.id === id);
      if (t) this._refreshTrackState(t, ui);
    });
    this._stopAllBtn.innerHTML = '▶ Start All';
    this._stopAllBtn.className = 'btn btn-green';
  }

  _startAll() {
    this.transport.ensureRunning();
    const startTime = this.transport.getNextBarTime();
    this.tracks.forEach(t => {
      if (this._savedPlayingIds.has(t.id) && t.buffer)
        t.startLooping(this.transport, startTime);
    });
    this._trackUIs.forEach((ui, id) => {
      const t = this.tracks.find(x => x.id === id);
      if (t) this._refreshTrackState(t, ui);
    });
    this._savedPlayingIds = null;
    this._stopAllBtn.innerHTML = '⏹ Stop All';
    this._stopAllBtn.className = 'btn btn-default';
  }

  _clearAll() {
    if (!confirm('全トラックを削除しますか?')) return;
    [...this.tracks].forEach(t => this._removeTrack(t));
    this._savedPlayingIds = null;
    this._stopAllBtn.innerHTML = '⏹ Stop All';
    this._stopAllBtn.className = 'btn btn-default';
  }

  // ── Track circle ──────────────────────────────────────────────────────────
  _makeTrackUI(track) {
    const circle = el('div', 'track-circle');

    const canvas = document.createElement('canvas');
    canvas.width  = CIRCLE_D;
    canvas.height = CIRCLE_D;
    circle.appendChild(canvas);

    const ui = {
      card: circle,
      canvas,
      selectedSource:   'mic',
      _controlsEl:      null,
      _waveformSamples: null,
      _dragCleanup:     null,
      badge: null, recBtn: null, playToggleBtn: null, nameSpan: null, srcSel: null,
      lockedSource: null,
    };

    this._drawTrackCircle(track, ui, 0);
    this._makeDraggable(circle, track, ui);

    ui._controlsEl = this._makeTrackControls(track, ui);
    ui._unsubTick  = this.transport.onTick(() => this._onTrackTick(track, ui));

    return ui;
  }

  // ── Drag mechanics (position → vol/pan) ───────────────────────────────────
  _makeDraggable(circle, track, ui) {
    let dragging = false, moved = false;
    let startX, startY, startLeft, startTop;

    circle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      moved    = false;
      startX   = e.clientX;
      startY   = e.clientY;
      const cr = circle.getBoundingClientRect();
      const pr = this._tracksContainer.getBoundingClientRect();
      startLeft = cr.left - pr.left;
      startTop  = cr.top  - pr.top;
    });

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

      const cW = this._tracksContainer.clientWidth;
      const cH = this._tracksContainer.clientHeight;
      const left = Math.max(0, Math.min(cW - CIRCLE_D, startLeft + dx));
      const top  = Math.max(0, Math.min(cH - CIRCLE_D, startTop  + dy));
      circle.style.left = left + 'px';
      circle.style.top  = top  + 'px';

      const rangeW = Math.max(1, cW - CIRCLE_D);
      const rangeH = Math.max(1, cH - CIRCLE_D);
      track.setPan(Math.max(-1, Math.min(1, (left / rangeW) * 2 - 1)));
      track.setVolume(Math.max(0, Math.min(1, 1 - top / rangeH)));
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) this._selectTrack(track);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    ui._dragCleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }

  // ── Circle canvas drawing ─────────────────────────────────────────────────
  _drawTrackCircle(track, ui, fraction = 0) {
    const G  = ui.canvas.getContext('2d');
    const cx = CIRCLE_D / 2, cy = CIRCLE_D / 2;

    G.clearRect(0, 0, CIRCLE_D, CIRCLE_D);

    const src = ui.selectedSource;
    const BG  = { mic: '#0d1520', synth: '#130d20', file: '#1a1508' }[src] ?? '#141414';
    const CLR = { mic: '#1e4488', synth: '#6622aa', file: '#996600' }[src] ?? '#2a3a4a';

    // Background fill
    G.beginPath(); G.arc(cx, cy, 80, 0, Math.PI * 2);
    G.fillStyle = BG; G.fill();

    // Waveform ring (evenodd donut: outer = waveform path, inner = circle at r=48)
    const s = ui._waveformSamples;
    if (s) {
      const N = s.length;
      G.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const r = 48 + s[i % N] * 28;
        if (i === 0) G.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else         G.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      G.closePath();
      G.arc(cx, cy, 48, 0, Math.PI * 2); // inner hole
      G.fillStyle = CLR;
      G.globalAlpha = 0.75;
      G.fill('evenodd');
      G.globalAlpha = 1;
    }

    // Center fill over inner area
    G.beginPath(); G.arc(cx, cy, 44, 0, Math.PI * 2);
    G.fillStyle = BG; G.fill();

    // Track ID
    G.fillStyle = '#666';
    G.font = 'bold 22px Segoe UI, system-ui, sans-serif';
    G.textAlign = 'center'; G.textBaseline = 'middle';
    G.fillText(`#${track.id}`, cx, cy);

    // Progress ring — background
    G.beginPath(); G.arc(cx, cy, 86, 0, Math.PI * 2);
    G.strokeStyle = '#1e1e1e'; G.lineWidth = 10; G.stroke();

    // Progress ring — state arc
    const startA = -Math.PI / 2;
    if (track.state === 'recording') {
      G.beginPath(); G.arc(cx, cy, 86, 0, Math.PI * 2);
      G.strokeStyle = '#ff4444'; G.lineWidth = 10; G.stroke();
    } else if (track.state === 'pending') {
      G.beginPath(); G.arc(cx, cy, 86, 0, Math.PI * 2);
      G.strokeStyle = '#cc7700'; G.lineWidth = 10; G.stroke();
    } else if (track.state === 'playing' && fraction > 0) {
      G.beginPath();
      G.arc(cx, cy, 86, startA, startA + fraction * Math.PI * 2);
      G.strokeStyle = '#28b828'; G.lineWidth = 10; G.stroke();
    }
  }

  // ── Per-track tick ────────────────────────────────────────────────────────
  _onTrackTick(track, ui) {
    if (track.state !== 'playing' || !track.scheduler) return;
    const pos = track.scheduler.getPositionInfo();
    if (pos) this._drawTrackCircle(track, ui, pos.frac);
  }

  // ── Properties controls (without vol/pan) ────────────────────────────────
  _makeTrackControls(track, ui) {
    const wrap = el('div', 'track-props-content');

    // ── Header: num / name / badge / delete ──
    const headerRow = el('div', 'props-header-row');
    const numSpan = el('span', 'track-num'); numSpan.textContent = `#${track.id}`;
    const nameSpan = el('span', 'track-name');
    nameSpan.textContent = track.name;
    nameSpan.contentEditable = 'true';
    nameSpan.spellcheck = false;
    nameSpan.addEventListener('blur', () => { track.name = nameSpan.textContent.trim() || track.name; });
    const badge = el('span', 'track-state-badge badge-empty'); badge.textContent = 'EMPTY';
    const delBtn = btn('✕', 'btn btn-danger btn-icon btn-sm', () => this._removeTrack(track));
    headerRow.append(numSpan, nameSpan, badge, delBtn);
    wrap.appendChild(headerRow);

    // ── REC / MUTE ──
    const controls = el('div', 'props-section');
    const recBtn = btn('<span class="rec-dot"></span> REC', 'btn btn-red', async () => {
      if (ui.selectedSource === 'file') return;
      await this._handleRecord(track, () => ui.selectedSource, ui);
    });
    const playToggleBtn = btn('MUTE', 'btn btn-default', () => {
      if (track.state === 'playing') {
        track.stop();
      } else {
        if (!track.buffer) { this.toast('録音データがありません', 'error'); return; }
        this.transport.ensureRunning();
        track.startLooping(this.transport, this.transport.getNextBarTime());
      }
      this._refreshTrackState(track, ui);
    });
    controls.append(recBtn, playToggleBtn);
    wrap.appendChild(controls);

    // ── Source selector ──
    const srcRow = el('div', 'props-section');
    const srcLabel = el('div', 'props-label'); srcLabel.textContent = 'SOURCE';
    const srcSel = el('div', 'source-selector');
    [
      { id: 'mic',   label: '🎤 MIC'   },
      { id: 'synth', label: '🎹 SYNTH' },
    ].forEach(s => {
      const sb = el('button', 'source-btn' + (s.id === 'mic' ? ' active' : ''));
      sb.textContent = s.label;
      sb.dataset.source = s.id;
      sb.addEventListener('click', () => {
        if (this.recordingTrack) return;
        ui.selectedSource = s.id;
        srcSel.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
        sb.classList.add('active');
        this._updateTrackSourceColor(track, ui);
        this._updateSynthVisibility();
      });
      srcSel.appendChild(sb);
    });
    const fileSb = el('button', 'source-btn');
    fileSb.textContent = '📂 FILE';
    fileSb.dataset.source = 'file';
    fileSb.addEventListener('click', () => {
      if (this.recordingTrack) return;
      this._loadFile(track, ui);
    });
    srcSel.appendChild(fileSb);
    srcRow.append(srcLabel, srcSel);
    wrap.appendChild(srcRow);

    ui.badge         = badge;
    ui.recBtn        = recBtn;
    ui.playToggleBtn = playToggleBtn;
    ui.nameSpan      = nameSpan;
    ui.srcSel        = srcSel;

    return wrap;
  }

  _updateTrackSourceColor(track, ui) {
    this._drawTrackCircle(track, ui, 0);
  }

  _applySourceLock(ui) {
    if (!ui.srcSel) return;
    ui.srcSel.querySelectorAll('.source-btn').forEach(b => {
      b.disabled = ui.lockedSource !== null && b.dataset.source !== ui.lockedSource;
    });
  }

  _updateSynthVisibility() {
    if (!this._synthPanel) return;
    const ui = this._selectedTrack ? this._trackUIs.get(this._selectedTrack.id) : null;
    this._synthPanel.style.display = ui?.selectedSource === 'synth' ? '' : 'none';
  }

  // ── Record Handler ────────────────────────────────────────────────────────
  async _handleRecord(track, getSource, ui) {
    await this.engine.resume();

    if (this.recordingTrack === track) {
      try {
        const buffer = await this.recorder.stop();
        if (buffer) {
          track.setBuffer(buffer);
          ui._waveformSamples = track.getWaveformSamples(WAVE_N);
          ui.lockedSource = ui.selectedSource;
          this._applySourceLock(ui);
          track.startLooping(this.transport, this.transport.getNextBarTime());
          this.toast(`${track.name} — 録音完了、再生開始`, 'success');
        }
      } catch (err) {
        this.toast('録音に失敗: ' + err.message, 'error');
      }
      this.recordingTrack = null;
      this._refreshTrackState(track, ui);
      ui.recBtn.innerHTML = '<span class="rec-dot"></span> REC';
      ui.recBtn.classList.remove('active');
      return;
    }

    if (this.recordingTrack) {
      this.recorder.cancel();
      const prevUI = this._trackUIs.get(this.recordingTrack.id);
      if (prevUI) {
        prevUI.recBtn.innerHTML = '<span class="rec-dot"></span> REC';
        prevUI.recBtn.classList.remove('active');
        this.recordingTrack.state = this.recordingTrack.buffer ? 'ready' : 'empty';
        this._refreshTrackState(this.recordingTrack, prevUI);
      }
      this.recordingTrack = null;
    }

    const source = getSource();
    this.transport.ensureRunning();
    this.recordingTrack = track;
    track.state = 'pending';
    this._refreshTrackState(track, ui);
    ui.recBtn.innerHTML = '✕ CANCEL';
    ui.recBtn.classList.add('active');

    this.recorder.onRecordingStart = () => {
      track.state = 'recording';
      track.recordStartBarTime = this.transport.ctx.currentTime;
      this._refreshTrackState(track, ui);
      ui.recBtn.innerHTML = '⏹ STOP REC';
    };

    try {
      if (source === 'mic') {
        await this.recorder.startMicAligned(this.transport, false);
      } else {
        await this.recorder.startSynthAligned(this.synth.outputGain, this.transport);
      }
    } catch (err) {
      this.recordingTrack = null;
      track.state = track.buffer ? 'ready' : 'empty';
      this._refreshTrackState(track, ui);
      ui.recBtn.innerHTML = '<span class="rec-dot"></span> REC';
      ui.recBtn.classList.remove('active');
      this.toast('エラー: ' + err.message, 'error');
    }
  }

  async _loadFile(track, ui) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const buffer = await this.engine.loadFile(file);
        track.setBuffer(buffer);
        track.name = file.name.replace(/\.[^.]+$/, '');
        if (ui.nameSpan) ui.nameSpan.textContent = track.name;
        ui._waveformSamples = track.getWaveformSamples(WAVE_N);

        ui.selectedSource = 'file';
        ui.lockedSource   = 'file';
        if (ui.srcSel) ui.srcSel.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
        this._applySourceLock(ui);
        this._updateSynthVisibility();

        this.transport.ensureRunning();
        track.startLooping(this.transport, this.transport.getNextBarTime());
        this._refreshTrackState(track, ui);
        this.toast(`${track.name} — 読み込み完了、再生開始`, 'success');
      } catch (err) {
        this.toast('読み込み失敗: ' + err.message, 'error');
      }
    };
    input.click();
  }

  // ── Track State ───────────────────────────────────────────────────────────
  _refreshTrackState(track, ui) {
    const { badge, card, playToggleBtn } = ui;
    if (!badge) return;
    card.classList.remove('recording', 'playing');

    const stateMap = {
      empty:     ['badge-empty',   'EMPTY',    ''],
      pending:   ['badge-pending', '⏳ WAIT',  'recording'],
      recording: ['badge-rec',     '● REC',    'recording'],
      ready:     ['badge-ready',   'READY',    ''],
      playing:   ['badge-playing', '▶ PLAY',   'playing'],
    };
    const [cls, text, cardClass] = stateMap[track.state] ?? stateMap.empty;
    badge.className = `track-state-badge ${cls}`;
    badge.textContent = text;
    if (cardClass) card.classList.add(cardClass);

    if (playToggleBtn) {
      playToggleBtn.textContent = 'MUTE';
      playToggleBtn.className = track.state === 'ready' ? 'btn btn-amber active' : 'btn btn-default';
    }

    this._drawTrackCircle(track, ui, 0);
  }

  // ── Synth Panel ───────────────────────────────────────────────────────────
  _makeSynthPanel() {
    const panel = el('div', 'synth-panel');
    const title = el('div', 'panel-title'); title.textContent = 'SYNTHESIZER';
    panel.appendChild(title);

    const body = el('div', 'synth-body');

    const topGrid = el('div', 'synth-controls');

    const oscGroup = el('div', 'ctrl-group');
    const oscLabel = el('div', 'ctrl-label'); oscLabel.textContent = 'OSCILLATOR';
    const oscSel = document.createElement('select');
    ['sine', 'square', 'sawtooth', 'triangle'].forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t[0].toUpperCase() + t.slice(1);
      oscSel.appendChild(o);
    });
    oscSel.value = this.synth.type;
    oscSel.addEventListener('change', () => { this.synth.type = oscSel.value; });
    oscGroup.append(oscLabel, oscSel);

    const octGroup = el('div', 'ctrl-group');
    const octLabel = el('div', 'ctrl-label'); octLabel.textContent = 'OCTAVE';
    const octRow = el('div', 'ctrl-row');
    const octVal = el('span', 'ctrl-value'); octVal.textContent = this.synth.octave;
    octRow.append(
      btn('◀', 'btn btn-default btn-sm', () => { if (this.synth.octave > 1) { this.synth.octave--; octVal.textContent = this.synth.octave; this._rebuildKeys(); } }),
      octVal,
      btn('▶', 'btn btn-default btn-sm', () => { if (this.synth.octave < 8) { this.synth.octave++; octVal.textContent = this.synth.octave; this._rebuildKeys(); } }),
    );
    octGroup.append(octLabel, octRow);
    topGrid.append(oscGroup, octGroup);
    body.appendChild(topGrid);

    const adsrGrid = el('div', 'synth-controls');
    [
      { key: 'attack',  label: 'ATTACK',  min: 0.001, max: 2, step: 0.001, fmt: v => v.toFixed(3) + 's' },
      { key: 'decay',   label: 'DECAY',   min: 0.01,  max: 2, step: 0.01,  fmt: v => v.toFixed(2) + 's' },
      { key: 'sustain', label: 'SUSTAIN', min: 0,     max: 1, step: 0.01,  fmt: v => Math.round(v * 100) + '%' },
      { key: 'release', label: 'RELEASE', min: 0.01,  max: 4, step: 0.01,  fmt: v => v.toFixed(2) + 's' },
    ].forEach(p => {
      const g = el('div', 'ctrl-group');
      const lbl = el('div', 'ctrl-label'); lbl.textContent = p.label;
      const row = el('div', 'ctrl-row');
      const sl = document.createElement('input');
      sl.type = 'range'; sl.min = p.min; sl.max = p.max; sl.step = p.step; sl.value = this.synth[p.key];
      const val = el('span', 'ctrl-value'); val.textContent = p.fmt(this.synth[p.key]);
      sl.addEventListener('input', () => { this.synth[p.key] = parseFloat(sl.value); val.textContent = p.fmt(this.synth[p.key]); });
      row.append(sl, val);
      g.append(lbl, row);
      adsrGrid.appendChild(g);
    });
    body.appendChild(adsrGrid);

    const svGroup = el('div', 'ctrl-group');
    const svLabel = el('div', 'ctrl-label'); svLabel.textContent = 'SYNTH VOLUME';
    const svRow = el('div', 'ctrl-row');
    const svSl = document.createElement('input');
    svSl.type = 'range'; svSl.min = 0; svSl.max = 1; svSl.step = 0.01; svSl.value = 0.75;
    const svVal = el('span', 'ctrl-value'); svVal.textContent = '75%';
    svSl.addEventListener('input', () => {
      this.synth.outputGain.gain.value = parseFloat(svSl.value);
      svVal.textContent = Math.round(svSl.value * 100) + '%';
    });
    svRow.append(svSl, svVal);
    svGroup.append(svLabel, svRow);
    body.appendChild(svGroup);

    const kbLabel = el('div', 'ctrl-label');
    kbLabel.style.marginTop = '4px';
    kbLabel.textContent = 'KEYBOARD  (A–K = white keys, W E T Y U = black)';
    body.appendChild(kbLabel);

    this._keyboardWrap = el('div', 'keyboard-wrap');
    body.appendChild(this._keyboardWrap);
    this._buildKeyboard();

    panel.appendChild(body);
    return panel;
  }

  _buildKeyboard() {
    this._keyboardWrap.innerHTML = '';
    const kb = el('div', 'keyboard');
    const oct = this.synth.octave;
    const WHITE_W = 28;

    const notes = [
      { note: 'C',  black: false, kb: 'a' },
      { note: 'C#', black: true,  kb: 'w' },
      { note: 'D',  black: false, kb: 's' },
      { note: 'D#', black: true,  kb: 'e' },
      { note: 'E',  black: false, kb: 'd' },
      { note: 'F',  black: false, kb: 'f' },
      { note: 'F#', black: true,  kb: 't' },
      { note: 'G',  black: false, kb: 'g' },
      { note: 'G#', black: true,  kb: 'y' },
      { note: 'A',  black: false, kb: 'h' },
      { note: 'A#', black: true,  kb: 'u' },
      { note: 'B',  black: false, kb: 'j' },
      { note: 'C',  black: false, kb: 'k', oct: oct + 1 },
    ];

    this._keyMap = {};
    let whiteCount = 0;

    notes.forEach(n => {
      const freq = this.synth.noteFreq(n.note, n.oct ?? oct);
      if (n.kb) this._keyMap[n.kb] = freq;

      if (!n.black) {
        const k = el('div', 'key key-white');
        const lbl = el('span', 'key-label');
        lbl.textContent = `${n.note}${n.oct ?? oct}` + (n.kb ? ` [${n.kb}]` : '');
        k.appendChild(lbl);
        k.dataset.freq = freq;
        this._attachNoteEvents(k, freq);
        kb.appendChild(k);
        whiteCount++;
      } else {
        const k = el('div', 'key key-black');
        k.style.left = ((whiteCount - 1) * WHITE_W + WHITE_W - 9) + 'px';
        const lbl = el('span', 'key-label');
        lbl.textContent = n.kb ? `[${n.kb}]` : '';
        k.appendChild(lbl);
        k.dataset.freq = freq;
        this._attachNoteEvents(k, freq);
        kb.appendChild(k);
      }
    });

    this._keyboardWrap.appendChild(kb);
  }

  _rebuildKeys() { this._buildKeyboard(); }

  _attachNoteEvents(keyEl, freq) {
    keyEl.addEventListener('mousedown',  (e) => { e.preventDefault(); this.synth.noteOn(freq); keyEl.classList.add('pressed'); });
    keyEl.addEventListener('mouseup',         () => { this.synth.noteOff(freq); keyEl.classList.remove('pressed'); });
    keyEl.addEventListener('mouseleave',      () => { this.synth.noteOff(freq); keyEl.classList.remove('pressed'); });
    keyEl.addEventListener('touchstart', (e) => { e.preventDefault(); this.synth.noteOn(freq); keyEl.classList.add('pressed'); });
    keyEl.addEventListener('touchend',        () => { this.synth.noteOff(freq); keyEl.classList.remove('pressed'); });
  }

  _bindKeyboard() {
    const pressed = new Set();
    document.addEventListener('keydown', (e) => {
      // Space: REC toggle — works regardless of focus (except contentEditable)
      if (e.key === ' ' && !e.target.isContentEditable) {
        const track = this._selectedTrack;
        if (track) {
          const ui = this._trackUIs.get(track.id);
          if (ui && this._propertiesBody.contains(ui._controlsEl)) {
            e.preventDefault();
            ui.recBtn.click();
            return;
          }
        }
      }

      if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (!pressed.has(k) && this._keyMap?.[k]) {
        pressed.add(k);
        const freq = this._keyMap[k];
        this.synth.noteOn(freq);
        this._keyboardWrap?.querySelector(`[data-freq="${freq}"]`)?.classList.add('pressed');
      }
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      pressed.delete(k);
      if (this._keyMap?.[k]) {
        const freq = this._keyMap[k];
        this.synth.noteOff(freq);
        this._keyboardWrap?.querySelector(`[data-freq="${freq}"]`)?.classList.remove('pressed');
      }
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast(msg, type = '') {
    const t = el('div', 'toast' + (type ? ' ' + type : ''));
    t.textContent = msg;
    this._toastContainer.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function btn(html, className, onClick) {
  const b = document.createElement('button');
  b.className = className;
  b.innerHTML = html;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
