export function injectStyles() {
  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #111;
      --bg2: #1c1c1c;
      --bg3: #242424;
      --bg4: #2e2e2e;
      --border: #3a3a3a;
      --text: #e0e0e0;
      --text-dim: #888;
      --red: #e03030;
      --red-bright: #ff4444;
      --green: #28b828;
      --green-bright: #44dd44;
      --amber: #d48000;
      --amber-bright: #ffaa00;
      --blue: #2878d0;
      --blue-bright: #4499ff;
      --cyan: #20a0a0;
      --purple: #8844cc;
      --knob-track: #333;
      --knob-fill: #4499ff;
    }

    html, body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      min-height: 100vh;
      overflow-x: hidden;
    }

    #app {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      background: #0d0d0d;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .header-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 2px;
      color: var(--amber-bright);
      text-transform: uppercase;
    }
    .header-subtitle {
      font-size: 11px;
      color: var(--text-dim);
      letter-spacing: 1px;
    }
    .header-spacer { flex: 1; }
    .master-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .master-label {
      font-size: 11px;
      color: var(--text-dim);
      letter-spacing: 1px;
    }
    .master-filter-slider {
      background: linear-gradient(to right, var(--knob-track) 50%, var(--knob-track) 50%);
      position: relative;
    }
    .master-filter-slider::-webkit-slider-thumb { background: var(--cyan); }
    .master-filter-slider:hover::-webkit-slider-thumb { background: #44dddd; }

    /* ── Main Layout ── */
    .main-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .tracks-panel {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    .right-panel {
      width: 320px;
      flex-shrink: 0;
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Toolbar ── */
    .toolbar {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg2);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 5px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      transition: filter 0.1s, transform 0.05s;
      user-select: none;
      white-space: nowrap;
    }
    .btn:hover { filter: brightness(1.15); }
    .btn:active { transform: scale(0.95); filter: brightness(0.9); }
    .btn:disabled { opacity: 0.35; cursor: default; pointer-events: none; }

    .btn-icon { padding: 5px 8px; min-width: 30px; }
    .btn-sm   { padding: 3px 8px; font-size: 11px; }

    .btn-default { background: var(--bg4); color: var(--text); border: 1px solid var(--border); }
    .btn-red    { background: var(--red); color: #fff; }
    .btn-red.active { background: var(--red-bright); box-shadow: 0 0 8px var(--red-bright); }
    .btn-green  { background: var(--green); color: #fff; }
    .btn-green.active { background: var(--green-bright); box-shadow: 0 0 8px var(--green-bright); }
    .btn-amber  { background: var(--amber); color: #fff; }
    .btn-amber.active { background: var(--amber-bright); box-shadow: 0 0 8px var(--amber-bright); }
    .btn-blue   { background: var(--blue); color: #fff; }
    .btn-blue.active  { background: var(--blue-bright); box-shadow: 0 0 8px var(--blue-bright); }
    .btn-purple { background: var(--purple); color: #fff; }
    .btn-danger { background: #5a1a1a; color: #ff6666; border: 1px solid #7a2a2a; }
    .btn-danger:hover { background: #7a1a1a; }

    /* ── Track Circle ── */
    .track-circle {
      position: absolute;
      width: 192px;
      height: 192px;
      border-radius: 50%;
      cursor: grab;
      user-select: none;
      touch-action: none;
      transition: box-shadow 0.15s;
      z-index: 1;
    }
    .track-circle:active { cursor: grabbing; }
    .track-circle.scene-recall { transition: box-shadow 0.15s, left 0.5s ease, top 0.5s ease; }
    .track-circle canvas { display: block; border-radius: 50%; }

    /* State / selection priority: playing < selected < recording */
    .track-circle.playing   { box-shadow: 0 0 0 2px rgba(0, 47, 255, 0.6); }
    .track-circle.selected  { box-shadow: 0 0 0 3px var(--blue-bright), 0 0 12px rgba(147, 196, 255, 0.6); }
    .track-circle.recording { box-shadow: 0 0 0 3px var(--red-bright),  0 0 14px rgba(255,68,68,0.45); }

    /* ── Properties Panel ── */
    .properties-panel {
      flex-shrink: 0;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      max-height: 52%;
      overflow: hidden;
    }
    .properties-body {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 0;
      overflow-y: auto;
      flex: 1;
    }
    .properties-empty {
      color: var(--text-dim);
      font-size: 12px;
      text-align: center;
      padding: 24px 0;
    }

    /* Properties content blocks */
    .track-props-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .props-header-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .props-section {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .props-label {
      font-size: 10px;
      color: var(--text-dim);
      letter-spacing: 0.5px;
      min-width: 52px;
    }
    /* ── Track name / num / badge ── */
    .track-num {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-dim);
      min-width: 24px;
    }
    .track-name {
      font-size: 12px;
      font-weight: 600;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .track-state-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .badge-empty    { background: #333; color: #666; }
    .badge-rec      { background: var(--red); color: #fff; animation: pulse 1s infinite; }
    .badge-ready    { background: #1a3a1a; color: var(--green); }
    .badge-playing  { background: #1a3a1a; color: var(--green-bright); animation: pulse 2s infinite; }
    .badge-pending  { background: #332200; color: var(--amber-bright); animation: pulse 0.5s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

    .track-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    /* ── Range Slider ── */
    input[type=range] {
      -webkit-appearance: none;
      appearance: none;
      flex: 1;
      height: 4px;
      background: var(--knob-track);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: var(--knob-fill);
      border-radius: 50%;
      border: 2px solid #0d0d0d;
      transition: background 0.1s;
    }
    input[type=range]:hover::-webkit-slider-thumb { background: #66bbff; }

    /* ── Source Selector ── */
    .source-selector {
      display: flex;
      gap: 4px;
    }
    .source-btn {
      padding: 3px 8px;
      font-size: 10px;
      border-radius: 3px;
      border: 1px solid var(--border);
      background: var(--bg4);
      color: var(--text-dim);
      cursor: pointer;
      transition: all 0.1s;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .source-btn.active {
      background: var(--blue);
      color: #fff;
      border-color: var(--blue-bright);
    }

    /* ── Empty State ── */
    .tracks-empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--text-dim);
      font-size: 13px;
      pointer-events: none;
    }
    .tracks-empty-icon { font-size: 48px; opacity: 0.3; }

    /* ── Synth Panel ── */
    .synth-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-dim);
      padding: 8px 12px;
      background: var(--bg3);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .synth-body {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      flex: 1;
    }

    .synth-controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .ctrl-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ctrl-label {
      font-size: 10px;
      color: var(--text-dim);
      letter-spacing: 0.5px;
    }
    .ctrl-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ctrl-value {
      font-size: 10px;
      color: var(--text);
      min-width: 32px;
      text-align: right;
    }

    select {
      background: var(--bg4);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 4px 6px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
      width: 100%;
    }
    select:focus { border-color: var(--blue); }

    /* ── Piano Keyboard ── */
    .keyboard-wrap {
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .keyboard {
      display: flex;
      position: relative;
      height: 100px;
      user-select: none;
      touch-action: none;
    }
    .key {
      position: relative;
      border: 1px solid #222;
      border-radius: 0 0 4px 4px;
      cursor: pointer;
      transition: background 0.05s;
    }
    .key-white {
      width: 28px;
      height: 100px;
      background: #ddd;
      z-index: 1;
      flex-shrink: 0;
    }
    .key-white:hover { background: #eee; }
    .key-white.pressed { background: #b0d8ff; }

    .key-black {
      width: 18px;
      height: 62px;
      background: #111;
      position: absolute;
      z-index: 2;
      border-color: #000;
      border-radius: 0 0 3px 3px;
    }
    .key-black:hover { background: #2a2a2a; }
    .key-black.pressed { background: #1a3a5a; }

    .key-label {
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 8px;
      color: #666;
      pointer-events: none;
    }
    .key-black .key-label { bottom: 3px; color: #555; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #555; }

    /* ── Recording indicator ── */
    .rec-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: var(--red-bright);
      border-radius: 50%;
      animation: pulse 0.8s infinite;
    }

    /* ── Toast ── */
    .toast-container {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 9999;
      pointer-events: none;
    }
    .toast {
      background: #333;
      color: var(--text);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .toast.show { opacity: 1; }
    .toast.error { background: #5a1a1a; color: var(--red-bright); }
    .toast.success { background: #1a3a1a; color: var(--green-bright); }

    /* ── Transport Bar ── */
    .transport-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 7px 14px;
      background: #0d0d0d;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    /* ── BPM Control ── */
    .bpm-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .bpm-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--text-dim);
    }
    .bpm-display {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .bpm-value {
      font-size: 22px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--blue-bright);
      min-width: 52px;
      text-align: center;
      cursor: pointer;
      border-bottom: 1px solid #444;
      padding: 0 4px;
    }
    .bpm-value:focus { outline: none; border-color: var(--blue-bright); }

    /* ── Compact number box (reused for TIMING etc.) ── */
    .num-box {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
    }
    .num-value {
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--blue-bright);
      min-width: 28px;
      text-align: center;
      cursor: text;
      border-bottom: 1px solid #444;
      padding: 0 4px;
      flex: 1;
    }
    .num-value:focus { outline: none; border-color: var(--blue-bright); }
    .tap-btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      background: #2a2a10;
      color: var(--amber);
      border: 1px solid #554;
      border-radius: 4px;
      cursor: pointer;
      letter-spacing: 0.5px;
      transition: background 0.05s, transform 0.05s;
    }
    .tap-btn:active { background: #443300; transform: scale(0.93); }

    /* ── Global Beat Display ── */
    .beat-display {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .beat-dots { display: flex; gap: 6px; }
    .beat-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #2a2a2a;
      border: 2px solid #3a3a3a;
      transition: background 0.04s, border-color 0.04s, transform 0.04s;
    }
    .beat-dot.active {
      background: var(--amber-bright);
      border-color: var(--amber-bright);
      box-shadow: 0 0 8px var(--amber-bright);
      transform: scale(1.25);
    }
    .beat-dot.beat-1 { width: 18px; height: 18px; }
    .beat-dot.beat-1.active {
      background: var(--red-bright);
      border-color: var(--red-bright);
      box-shadow: 0 0 10px var(--red-bright);
      transform: scale(1.3);
    }
    .bar-counter {
      font-size: 11px;
      color: var(--text-dim);
      font-variant-numeric: tabular-nums;
      min-width: 56px;
    }
    .transport-bar.stopped .beat-dot { opacity: 0.3; }

  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
