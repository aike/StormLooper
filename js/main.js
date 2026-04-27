import { injectStyles  } from './styles.js';
import { AudioEngine  } from './AudioEngine.js';
import { Transport    } from './Transport.js';
import { Synth        } from './Synth.js';
import { UI           } from './UI.js';

injectStyles();

const engine    = new AudioEngine();
let ui          = null;

async function bootstrap() {
  await engine.init();

  const transport = new Transport(engine.ctx);
  const synth     = new Synth(engine);
  ui = new UI(engine, synth, transport);
  ui.build(document.getElementById('app'));
}

let started = false;
async function startOnce() {
  if (started) return;
  started = true;
  try {
    await bootstrap();
  } catch (err) {
    console.error('Bootstrap failed:', err);
    document.getElementById('app').innerHTML =
      `<div style="padding:40px;color:#f55;font-family:monospace">Failed to start: ${err.message}</div>`;
  }
}

// ── Start overlay ─────────────────────────────────────────────────────────
(function showOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:#111;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:16px;z-index:9999;
    font-family:'Segoe UI',system-ui,sans-serif;
  `;
  overlay.innerHTML = `
    <div style="font-size:48px">🎵</div>
    <div style="font-size:22px;font-weight:700;color:#ffaa00;letter-spacing:3px">WEB LOOPER</div>
    <div style="font-size:13px;color:#888">RC-505 Style · Web Audio API</div>
    <button id="start-btn" style="
      margin-top:8px;padding:14px 40px;font-size:16px;font-weight:700;
      background:#2878d0;color:#fff;border:none;border-radius:8px;cursor:pointer;
      letter-spacing:1px;transition:filter .15s;
    " onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter=''">
      ▶ START
    </button>
    <div style="font-size:11px;color:#555;margin-top:4px">クリックしてオーディオを有効化</div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#start-btn').addEventListener('click', async () => {
    overlay.querySelector('#start-btn').textContent = '読み込み中...';
    await startOnce();
    overlay.style.transition = 'opacity .4s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 400);
  });
})();
