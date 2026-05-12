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
    this._gridCanvas      = null;
    this._vfxCanvas       = null;
    this._vfxRaf          = null;

    this._globalDots          = [];
    this._barCounterEl        = null;
    this._tapTimes            = [];
    this._lastSelectedDeviceId = null;
  }

  build(root) {
    root.appendChild(this._makeHeader());
    root.appendChild(this._makeTransportBar());

    const layout = el('div', 'main-layout');

    const left = el('div', '');
    left.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
    left.appendChild(this._makeToolbar());

    this._tracksContainer = el('div', 'tracks-panel');

    this._vfxCanvas = document.createElement('canvas');
    this._vfxCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this._tracksContainer.appendChild(this._vfxCanvas);

    this._gridCanvas = document.createElement('canvas');
    this._gridCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this._tracksContainer.appendChild(this._gridCanvas);

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

    requestAnimationFrame(() => this._drawGrid());
    new ResizeObserver(() => { this._drawGrid(); this._repositionAllTracks(); }).observe(this._tracksContainer);
    this._startVFX();
  }

  // ── Header ────────────────────────────────────────────────────────────────
  _makeHeader() {
    const hdr = el('div', 'header');
    const titles = el('div', '');
    titles.innerHTML = `<img src="logo.svg" alt="StormLooper" style="height:26px;display:block;"><div class="header-subtitle">Web Audio Looper application</div>`;
    hdr.appendChild(titles);
    hdr.appendChild(el('div', 'header-spacer'));

    const delaySection = el('div', 'master-section');
    const delayLabel = el('span', 'master-label'); delayLabel.textContent = 'DELAY';
    const delaySlider = document.createElement('input');
    delaySlider.type = 'range'; delaySlider.min = '100'; delaySlider.max = '500';
    delaySlider.step = '1'; delaySlider.value = '250';
    delaySlider.style.width = '80px';
    const delayValEl = el('span', '');
    delayValEl.style.cssText = 'font-size:10px;color:var(--text-dim);min-width:40px;text-align:right';
    delayValEl.textContent = '250ms';
    delaySlider.addEventListener('input', () => {
      const v = parseInt(delaySlider.value);
      this.engine.setDelayTime(v);
      delayValEl.textContent = v + 'ms';
    });
    delaySection.append(delayLabel, delaySlider, delayValEl);
    hdr.appendChild(delaySection);

    const filterSection = el('div', 'master-section');
    const filterLabel = el('span', 'master-label'); filterLabel.textContent = 'FILTER';
    const filterSlider = document.createElement('input');
    filterSlider.type = 'range'; filterSlider.min = '-1'; filterSlider.max = '1';
    filterSlider.step = '0.01'; filterSlider.value = '0';
    filterSlider.style.cssText = 'width:80px;--knob-fill:var(--cyan)';
    filterSlider.className = 'master-filter-slider';
    const filterValEl = el('span', '');
    filterValEl.style.cssText = 'font-size:10px;color:var(--text-dim);min-width:64px;text-align:right';
    filterValEl.textContent = 'FLAT';
    filterSlider.addEventListener('input', () => {
      const v = parseFloat(filterSlider.value);
      this.engine.setMasterFilter(v);
      if (v === 0) {
        filterValEl.textContent = 'FLAT';
        filterValEl.style.color = 'var(--text-dim)';
      } else if (v < 0) {
        const freq = 20000 * Math.pow(20 / 20000, Math.abs(v));
        filterValEl.textContent = 'LPF ' + _fmtHz(freq);
        filterValEl.style.color = 'var(--blue-bright)';
      } else {
        const freq = 20 * Math.pow(20000 / 20, v);
        filterValEl.textContent = 'HPF ' + _fmtHz(freq);
        filterValEl.style.color = 'var(--amber-bright)';
      }
    });
    filterSection.append(filterLabel, filterSlider, filterValEl);
    hdr.appendChild(filterSection);

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
    bar.append(
      btn('＋ Add Track', 'btn btn-blue',  () => this._addTrack()),
      this._stopAllBtn,
      btn('✕ Clear All', 'btn btn-danger', () => this._clearAll()),
    );
    return bar;
  }


  _showEmptyState() {
    const div = el('div', 'tracks-empty');
    const icon = el('div', 'tracks-empty-icon'); icon.textContent = '🎵';
    const msg1 = el('div', ''); msg1.textContent = 'Add a track to start looping';
    const msg2 = el('div', ''); msg2.textContent = 'Record from mic, play the synth, or load a WAV file';
    msg2.style.cssText = 'font-size:11px;color:#555';
    div.append(icon, msg1, msg2);
    this._tracksContainer.appendChild(div);
  }

  // ── Grid background ───────────────────────────────────────────────────────
  _drawGrid() {
    const canvas = this._gridCanvas;
    if (!canvas) return;
    const cW = this._tracksContainer.clientWidth;
    const cH = this._tracksContainer.clientHeight;
    if (!cW || !cH) return;
    canvas.width  = cW;
    canvas.height = cH;

    const G      = canvas.getContext('2d');
    const rangeH = Math.max(1, cH - CIRCLE_D);

    G.font = '10px Segoe UI, system-ui, sans-serif';

    // ── Horizontal dB lines ──
    for (const db of [0, -6, -12, -18, -24, -36]) {
      const vol  = db === 0 ? 1 : Math.pow(10, db / 20);
      const y    = (1 - vol) * rangeH + CIRCLE_D / 2;
      const dim  = db === 0;

      G.save();
      G.strokeStyle = dim ? 'rgba(160,210,255,0.75)' : 'rgba(200,220,255,0.38)';
      G.lineWidth   = dim ? 1.5 : 1;
      if (!dim) G.setLineDash([4, 5]);
      G.beginPath(); G.moveTo(0, y); G.lineTo(cW, y); G.stroke();
      G.restore();

      G.fillStyle    = dim ? 'rgba(200,230,255,0.92)' : 'rgba(210,225,255,0.70)';
      G.textAlign    = 'left';
      G.textBaseline = 'bottom';
      G.fillText(db === 0 ? '0 dB' : `${db} dB`, 6, y - 2);
    }

    // ── Center vertical line ──
    const cx = cW / 2;
    G.save();
    G.strokeStyle = 'rgba(180,210,255,0.45)';
    G.lineWidth   = 1;
    G.setLineDash([4, 5]);
    G.beginPath(); G.moveTo(cx, 0); G.lineTo(cx, cH); G.stroke();
    G.restore();

    // ── Pan / center labels ──
    G.fillStyle    = 'rgba(210,225,255,0.82)';
    G.textBaseline = 'top';

    G.textAlign = 'left';
    G.fillText('L', 6, 6);

    G.textAlign = 'center';
    G.fillText('CENTER', cx, 6);

    G.textAlign = 'right';
    G.fillText('R', cW - 6, 6);
  }

  // ── Reposition all track circles from vol/pan ─────────────────────────────
  _repositionAllTracks() {
    const cW = this._tracksContainer.clientWidth;
    const cH = this._tracksContainer.clientHeight;
    if (!cW || !cH) return;
    const rangeW = Math.max(1, cW - CIRCLE_D);
    const rangeH = Math.max(1, cH - CIRCLE_D);

    for (const track of this.tracks) {
      const ui = this._trackUIs.get(track.id);
      if (!ui) continue;
      const left = Math.max(0, Math.min(cW - CIRCLE_D, ((track.pan + 1) / 2) * rangeW));
      const top  = Math.max(0, Math.min(cH - CIRCLE_D, (1 - track.volume) * rangeH));
      ui.card.style.left = left + 'px';
      ui.card.style.top  = top  + 'px';
    }
  }

  // ── VFX background animation ──────────────────────────────────────────────
  _startVFX() {
    const canvas = this._vfxCanvas;
    let W = 0, H = 0, t = 0;

    // Slow-drifting color blobs — organic ambient light
    const blobs = [
      { cx: 0.30, cy: 0.40, ax: 0.22, ay: 0.18, fx: 1.10, fy: 0.83, ph: 0.00, r: 0.32, hue: 200 },
      { cx: 0.70, cy: 0.60, ax: 0.18, ay: 0.24, fx: 0.73, fy: 1.31, ph: 1.20, r: 0.28, hue: 260 },
      { cx: 0.50, cy: 0.28, ax: 0.26, ay: 0.16, fx: 0.51, fy: 1.70, ph: 2.40, r: 0.25, hue: 180 },
      { cx: 0.22, cy: 0.72, ax: 0.16, ay: 0.22, fx: 1.47, fy: 0.61, ph: 3.60, r: 0.30, hue: 220 },
      { cx: 0.78, cy: 0.25, ax: 0.20, ay: 0.20, fx: 0.89, fy: 1.13, ph: 4.80, r: 0.22, hue: 290 },
      { cx: 0.50, cy: 0.80, ax: 0.24, ay: 0.14, fx: 1.33, fy: 0.53, ph: 0.70, r: 0.26, hue: 160 },
    ];

    // Lissajous figures — slowly evolving parametric traces
    const figures = [
      { a: 3, b: 2, sx: 0.28, sy: 0.20, speed: 0.55, ph: 0.00, hue: 200 },
      { a: 5, b: 4, sx: 0.22, sy: 0.28, speed: 0.37, ph: 0.50, hue: 260 },
      { a: 2, b: 3, sx: 0.25, sy: 0.22, speed: 0.43, ph: 1.00, hue: 180 },
    ];

    const draw = () => {
      this._vfxRaf = requestAnimationFrame(draw);

      const cW = this._tracksContainer.clientWidth;
      const cH = this._tracksContainer.clientHeight;
      if (!cW || !cH) return;

      if (cW !== W || cH !== H) {
        canvas.width  = W = cW;
        canvas.height = H = cH;
      }

      t += 0.005;
      const G = canvas.getContext('2d');
      G.clearRect(0, 0, W, H);

      for (const b of blobs) {
        const bx  = (b.cx + Math.sin(t * b.fx + b.ph) * b.ax) * W;
        const by  = (b.cy + Math.cos(t * b.fy + b.ph * 0.7) * b.ay) * H;
        const br  = b.r * Math.min(W, H);
        const hue = (b.hue + t * 10) % 360;
        const grd = G.createRadialGradient(bx, by, 0, bx, by, br);
        grd.addColorStop(0,   `hsla(${hue}, 95%, 62%, 0.14)`); // FVX center color
        grd.addColorStop(0.5, `hsla(${hue}, 85%, 52%, 0.08)`); // FVX mid color
        grd.addColorStop(1,   `hsla(${hue}, 80%, 48%, 0)`);
        G.beginPath();
        G.arc(bx, by, br, 0, Math.PI * 2);
        G.fillStyle = grd;
        G.fill();
      }

      const fcx = W / 2, fcy = H / 2;
      for (const f of figures) {
        const rx  = f.sx * W;
        const ry  = f.sy * H;
        const hue = (f.hue + t * 8) % 360;
        G.beginPath();
        for (let i = 0; i <= 512; i++) {
          const θ = (i / 512) * Math.PI * 2;
          const x = fcx + Math.sin(f.a * θ + t * f.speed + f.ph) * rx;
          const y = fcy + Math.sin(f.b * θ) * ry;
          i === 0 ? G.moveTo(x, y) : G.lineTo(x, y);
        }
        G.strokeStyle = `hsla(${hue}, 95%, 72%, 0.1)`; // Lissajous curve color
        G.lineWidth   = 2;
        G.stroke();
      }
    };

    draw();
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
      devRow: null, devSel: null, selectedDeviceId: null,
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

    const onStart = (clientX, clientY) => {
      dragging  = true;
      moved     = false;
      startX    = clientX;
      startY    = clientY;
      const cr  = circle.getBoundingClientRect();
      const pr  = this._tracksContainer.getBoundingClientRect();
      startLeft = cr.left - pr.left;
      startTop  = cr.top  - pr.top;
    };

    const onMove = (clientX, clientY) => {
      if (!dragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
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

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) this._selectTrack(track);
    };

    // ── Mouse ──
    circle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      onStart(e.clientX, e.clientY);
    });
    const onMouseMove = (e) => onMove(e.clientX, e.clientY);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onEnd);

    // ── Touch ──
    circle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length > 0) onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    document.addEventListener('touchmove',   onTouchMove, { passive: false });
    document.addEventListener('touchend',    onEnd);
    document.addEventListener('touchcancel', onEnd);

    ui._dragCleanup = () => {
      document.removeEventListener('mousemove',   onMouseMove);
      document.removeEventListener('mouseup',     onEnd);
      document.removeEventListener('touchmove',   onTouchMove);
      document.removeEventListener('touchend',    onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }

  // ── Circle canvas drawing ─────────────────────────────────────────────────
  _drawTrackCircle(track, ui, fraction = 0) {
    const G  = ui.canvas.getContext('2d');
    const cx = CIRCLE_D / 2, cy = CIRCLE_D / 2;

    G.clearRect(0, 0, CIRCLE_D, CIRCLE_D);

    const src = ui.selectedSource;
    const BG  = { mic: '#0d1520', synth: '#110d22', file: '#0d1520' }[src] ?? '#141414';
    const CLR = track.state === 'ready'
      ? '#444444'
      : ({ mic: '#2860cc', synth: '#cc0088', file: '#aabbdd' }[src] ?? '#2a3a4a');

    // Background fill
    G.beginPath(); G.arc(cx, cy, 80, 0, Math.PI * 2);
    G.fillStyle = BG; G.fill();

    // Waveform ring: maps each angular position to the buffer sample that plays
    // there, accounting for LENGTH (span) and TIMING (phase shift / seek).
    const s = ui._waveformSamples;
    if (s && track.buffer) {
      const N    = s.length;
      const span = track.scheduler
        ? track.scheduler.getLoopSpan()
        : track.computeLoopSpan(this.transport);

      if (span) {
        const bufDur    = track.buffer.duration;
        const beatDur   = this.transport.beatDuration;
        const timing    = track.timing;
        const spanBeats = Math.max(1, Math.round(span / beatDur));

        // Mirror _scheduleOnce: compute phase parameters
        let timingOffset = 0; // seconds before head plays (positive timing)
        let seekSec      = 0; // seconds seeked into buffer (negative timing)
        let tailStart    = 0; // buffer position where looping tail begins
        if (timing > 0) {
          const delayBeats = ((timing % spanBeats) + spanBeats) % spanBeats;
          timingOffset = delayBeats * beatDur;
          const rem = timingOffset % bufDur;
          tailStart = rem < 1e-9 ? 0 : bufDur - rem;
        } else if (timing < 0) {
          const seekBeats = Math.abs(timing % spanBeats);
          seekSec = seekBeats === 0 ? 0 : (seekBeats * beatDur) % bufDur;
        }

        G.beginPath();
        for (let i = 0; i <= N; i++) {
          const time = (i / N) * span; // loop time in seconds
          let amp = 0;
          if (timing >= 0) {
            if (time < timingOffset) {
              // Tail zone: buffer loops from tailStart
              amp = s[Math.min(N - 1, Math.floor(((tailStart + time) % bufDur) / bufDur * N))];
            } else if (time < timingOffset + bufDur) {
              // Head zone: buffer from position 0
              amp = s[Math.min(N - 1, Math.floor((time - timingOffset) / bufDur * N))];
            }
            // else silence
          } else {
            // Negative timing: seeked playback
            const bufPos = seekSec + time;
            if (bufPos < bufDur) {
              amp = s[Math.min(N - 1, Math.floor(bufPos / bufDur * N))];
            }
            // else silence
          }
          const a = (i / N) * Math.PI * 2 - Math.PI / 2;
          const r = 48 + amp * 28;
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
    }

    // Center fill over inner area
    G.beginPath(); G.arc(cx, cy, 44, 0, Math.PI * 2);
    G.fillStyle = BG; G.fill();

    // Track ID
    G.fillStyle = '#666';
    G.font = 'bold 36px Segoe UI, system-ui, sans-serif';
    G.textAlign = 'center'; G.textBaseline = 'middle';
    G.fillText(`${track.id}`, cx, cy);

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
      G.strokeStyle = '#202090'; G.lineWidth = 10; G.stroke();
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
        if (s.id === 'mic') this._refreshMicDevices(ui);
        else if (ui.devRow) ui.devRow.style.display = 'none';
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

    // ── Length selector ──
    const lenRow = el('div', 'props-section');
    const lenLabel = el('div', 'props-label'); lenLabel.textContent = 'LENGTH';
    const lenSel = document.createElement('select');
    lenSel.style.flex = '1';
    [
      { value: '1beat',  label: '1 Beat'  },
      { value: '2beats', label: '2 Beats' },
      { value: '1bar',   label: '1 Bar'   },
      { value: '2bars',  label: '2 Bars'  },
      { value: '4bars',  label: '4 Bars'  },
      { value: '8bars',  label: '8 Bars'  },
      { value: '16bars', label: '16 Bars' },
      { value: 'auto',   label: 'Auto'    },
    ].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value; o.textContent = opt.label;
      lenSel.appendChild(o);
    });
    lenSel.value = track.lengthMode;
    lenSel.addEventListener('change', () => {
      track.lengthMode = lenSel.value;
      if (track.scheduler) track.scheduler.reschedule();
      this._drawTrackCircle(track, ui, 0);
    });
    lenRow.append(lenLabel, lenSel);
    wrap.appendChild(lenRow);

    // ── Timing number box ──
    const timingRow = el('div', 'props-section');
    const timingLabel = el('div', 'props-label'); timingLabel.textContent = 'TIMING';
    const timingBox = el('div', 'num-box');
    const applyTiming = (v) => {
      track.timing = Math.max(-64, Math.min(64, Math.round(v)));
      timingNum.textContent = track.timing;
      if (track.scheduler) track.scheduler.reschedule();
      this._drawTrackCircle(track, ui, 0);
    };
    const timingDown = btn('◀', 'btn btn-default btn-icon btn-sm', () => applyTiming(track.timing - 1));
    const timingNum = el('span', 'num-value');
    timingNum.textContent = track.timing;
    timingNum.contentEditable = 'true';
    timingNum.spellcheck = false;
    timingNum.addEventListener('blur', () => {
      const v = parseInt(timingNum.textContent);
      if (!isNaN(v)) applyTiming(v);
      timingNum.textContent = track.timing;
    });
    timingNum.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')     { e.preventDefault(); timingNum.blur(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); applyTiming(track.timing + 1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); applyTiming(track.timing - 1); }
    });
    const timingUp = btn('▶', 'btn btn-default btn-icon btn-sm', () => applyTiming(track.timing + 1));
    timingBox.append(timingDown, timingNum, timingUp);
    timingRow.append(timingLabel, timingBox);
    wrap.appendChild(timingRow);

    // ── Delay Send ──
    const sendRow = el('div', 'props-section');
    const sendLabel = el('div', 'props-label'); sendLabel.textContent = 'DELAY SND';
    const sendSl = document.createElement('input');
    sendSl.type = 'range'; sendSl.min = '0'; sendSl.max = '1'; sendSl.step = '0.01'; sendSl.value = '0';
    const sendValEl = el('span', '');
    sendValEl.style.cssText = 'font-size:10px;color:var(--text-dim);min-width:32px;text-align:right';
    sendValEl.textContent = '0%';
    sendSl.addEventListener('input', () => {
      const v = parseFloat(sendSl.value);
      track.setSend(v);
      sendValEl.textContent = Math.round(v * 100) + '%';
      sendValEl.style.color = v > 0 ? 'var(--purple)' : 'var(--text-dim)';
    });
    sendRow.append(sendLabel, sendSl, sendValEl);
    wrap.appendChild(sendRow);

    // ── Device selector (MIC only, shown when multiple inputs are available) ──
    const devRow = el('div', 'props-section');
    devRow.style.display = 'none';
    const devLabel = el('div', 'props-label'); devLabel.textContent = 'INPUT';
    const devSel = document.createElement('select');
    devSel.style.flex = '1';
    devRow.append(devLabel, devSel);
    wrap.appendChild(devRow);

    ui.badge         = badge;
    ui.recBtn        = recBtn;
    ui.playToggleBtn = playToggleBtn;
    ui.nameSpan      = nameSpan;
    ui.srcSel        = srcSel;
    ui.devRow        = devRow;
    ui.devSel        = devSel;

    this._refreshMicDevices(ui);

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

  async _refreshMicDevices(ui) {
    if (!ui.devRow || ui.selectedSource !== 'mic') return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs  = devices.filter(d => d.kind === 'audioinput');
      if (inputs.length <= 1) {
        ui.devRow.style.display = 'none';
        ui.selectedDeviceId     = inputs[0]?.deviceId ?? null;
        return;
      }
      const prev = ui.selectedDeviceId ?? this._lastSelectedDeviceId;
      ui.devSel.innerHTML = '';
      inputs.forEach((d, i) => {
        const opt       = document.createElement('option');
        opt.value       = d.deviceId;
        opt.textContent = d.label || `Input ${i + 1}`;
        ui.devSel.appendChild(opt);
      });
      if (prev) ui.devSel.value = prev;
      ui.selectedDeviceId  = ui.devSel.value || null;
      ui.devSel.onchange   = () => {
        ui.selectedDeviceId        = ui.devSel.value || null;
        this._lastSelectedDeviceId = ui.selectedDeviceId;
      };
      ui.devRow.style.display = '';
    } catch (_) {}
  }

  // If the recording ends within 0.5 beats of the next bar boundary, trim to the
  // previous bar end. Returns the (possibly trimmed) buffer.
  _maybeTrimToBar(buffer) {
    const barDur       = this.transport.barDuration;
    const beatDur      = this.transport.beatDuration;
    const bufDur       = buffer.duration;
    const completeBars = Math.floor(bufDur / barDur);
    const remainder    = bufDur - completeBars * barDur; // time past the last bar boundary

    if (completeBars === 0 || remainder <= 0 || remainder > 0.5 * beatDur) return buffer;

    const newLength = Math.round(completeBars * barDur * buffer.sampleRate);
    const newBuf    = this.engine.ctx.createBuffer(
      buffer.numberOfChannels, newLength, buffer.sampleRate
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      newBuf.getChannelData(ch).set(buffer.getChannelData(ch).subarray(0, newLength));
    }
    return newBuf;
  }

  // ── Record Handler ────────────────────────────────────────────────────────
  async _handleRecord(track, getSource, ui) {
    await this.engine.resume();

    if (this.recordingTrack === track) {
      try {
        const buffer = await this.recorder.stop();
        if (buffer) {
          track.setBuffer(this._maybeTrimToBar(buffer));
          ui._waveformSamples = track.getWaveformSamples(WAVE_N);
          ui.lockedSource = ui.selectedSource;
          this._applySourceLock(ui);
          track.startLooping(this.transport, this.transport.getNextBarTime());
          this.toast(`${track.name} — 録音完了、再生開始`, 'success');
          this._refreshMicDevices(ui); // labels now available after permission granted
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

    this.recorder.onCountdownBar = (barTime) => {
      this._metronome.playOneBar(this.transport, barTime);
    };

    this.recorder.onRecordingStart = () => {
      track.state = 'recording';
      track.recordStartBarTime = this.transport.ctx.currentTime;
      this._refreshTrackState(track, ui);
      ui.recBtn.innerHTML = '⏹ STOP REC';
    };

    try {
      if (source === 'mic') {
        await this.recorder.startMicAligned(this.transport, false, ui.selectedDeviceId);
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
        if (ui.devRow) ui.devRow.style.display = 'none';
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
      playToggleBtn.className = track.state === 'ready' ? 'btn btn-blue active' : 'btn btn-default';
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

    const filterGrid = el('div', 'synth-controls');

    const cutGroup = el('div', 'ctrl-group');
    const cutLabel = el('div', 'ctrl-label'); cutLabel.textContent = 'LPF CUTOFF';
    const cutRow = el('div', 'ctrl-row');
    const cutSl = document.createElement('input');
    cutSl.type = 'range'; cutSl.min = 20; cutSl.max = 20000; cutSl.step = 1; cutSl.value = 8000;
    const cutVal = el('span', 'ctrl-value'); cutVal.textContent = '8000 Hz';
    cutSl.addEventListener('input', () => {
      this.synth.filter.frequency.value = parseFloat(cutSl.value);
      cutVal.textContent = parseFloat(cutSl.value) >= 1000
        ? (parseFloat(cutSl.value) / 1000).toFixed(1) + ' kHz'
        : Math.round(cutSl.value) + ' Hz';
    });
    cutRow.append(cutSl, cutVal);
    cutGroup.append(cutLabel, cutRow);

    const resGroup = el('div', 'ctrl-group');
    const resLabel = el('div', 'ctrl-label'); resLabel.textContent = 'RESONANCE';
    const resRow = el('div', 'ctrl-row');
    const resSl = document.createElement('input');
    resSl.type = 'range'; resSl.min = 0.1; resSl.max = 20; resSl.step = 0.1; resSl.value = 1;
    const resVal = el('span', 'ctrl-value'); resVal.textContent = '1.0';
    resSl.addEventListener('input', () => {
      this.synth.filter.Q.value = parseFloat(resSl.value);
      resVal.textContent = parseFloat(resSl.value).toFixed(1);
    });
    resRow.append(resSl, resVal);
    resGroup.append(resLabel, resRow);

    filterGrid.append(cutGroup, resGroup);
    body.appendChild(filterGrid);

    const svGroup = el('div', 'ctrl-group');
    const svLabel = el('div', 'ctrl-label'); svLabel.textContent = 'SYNTH VOLUME';
    const svRow = el('div', 'ctrl-row');
    const svSl = document.createElement('input');
    svSl.type = 'range'; svSl.min = 0; svSl.max = 1; svSl.step = 0.01; svSl.value = 0.5;
    const svVal = el('span', 'ctrl-value'); svVal.textContent = '50%';
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

      // 0-9: toggle MUTE on tracks 1-10 (0 → track 10)
      if (e.key >= '0' && e.key <= '9') {
        const idx   = e.key === '0' ? 9 : parseInt(e.key) - 1;
        const track = this.tracks[idx];
        if (track) {
          const ui = this._trackUIs.get(track.id);
          if (track.state === 'playing') {
            track.stop();
          } else if (track.buffer) {
            this.transport.ensureRunning();
            track.startLooping(this.transport, this.transport.getNextBarTime());
          }
          if (ui) this._refreshTrackState(track, ui);
        }
        return;
      }

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

function _fmtHz(freq) {
  return freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : Math.round(freq) + 'Hz';
}
