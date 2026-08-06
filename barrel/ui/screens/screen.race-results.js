// barrel/ui/screens/screen.race-results.js — Enhanced Race Results Screen (Cycle 26)
// Podium-style layout with animated entrance, lap times, and race stats

export async function mount(root, payload, ctx) {
  const engine = window.__engine;
  const raceData = payload || {};
  const totalTime = raceData.timeMs ? raceData.timeMs / 1000 : 0;
  const position = raceData.position || 1;
  const totalLaps = raceData.lapsCompleted || 3;
  const lapTimes = raceData.lapTimes || generateFakeLapTimes(totalLaps, totalTime);
  
  // Calculate best lap
  let bestLapIdx = 0;
  let bestLapTime = Infinity;
  lapTimes.forEach((t, i) => { if (t < bestLapTime) { bestLapTime = t; bestLapIdx = i; } });
  
  // Create screen
  const screen = document.createElement('div');
  screen.className = 'race-results-screen';
  screen.innerHTML = `
    <style>
      .race-results-screen {
        position: fixed; inset: 0; z-index: 200;
        display: flex; align-items: center; justify-content: center;
        background: rgba(5, 6, 10, 0.92);
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        color: #fff;
        animation: rrSlideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        overflow-y: auto;
      }
      @keyframes rrSlideUp {
        from { opacity: 0; transform: translateY(60px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .rr-container {
        max-width: 600px; width: 90%; padding: 40px 0;
        animation: rrFadeIn 0.8s ease 0.2s both;
      }
      @keyframes rrFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .rr-header {
        text-align: center; margin-bottom: 32px;
      }
      .rr-title {
        font-size: 14px; font-weight: 700; letter-spacing: 4px;
        text-transform: uppercase; color: rgba(255,255,255,0.4);
        margin-bottom: 8px;
      }
      .rr-position {
        font-size: 96px; font-weight: 900; line-height: 1;
        font-family: 'Bebas Neue', Impact, sans-serif;
        animation: rrPositionPulse 2s ease-in-out infinite;
      }
      @keyframes rrPositionPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.03); }
      }
      .rr-position.pos-1 { color: #ffd700; text-shadow: 0 0 40px rgba(255,215,0,0.5), 0 0 80px rgba(255,215,0,0.2); }
      .rr-position.pos-2 { color: #c0c0c0; text-shadow: 0 0 40px rgba(192,192,192,0.5); }
      .rr-position.pos-3 { color: #cd7f32; text-shadow: 0 0 40px rgba(205,127,50,0.5); }
      .rr-position.pos-other { color: rgba(255,255,255,0.7); }
      .rr-suffix { font-size: 36px; vertical-align: super; }
      .rr-subtitle {
        font-size: 16px; font-weight: 600; letter-spacing: 2px;
        text-transform: uppercase; color: rgba(255,255,255,0.5);
        margin-top: 8px;
      }
      .rr-time-display {
        text-align: center; margin-bottom: 32px;
        padding: 20px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
      }
      .rr-time-label {
        font-size: 11px; font-weight: 700; letter-spacing: 2px;
        text-transform: uppercase; color: rgba(255,255,255,0.3);
        margin-bottom: 8px;
      }
      .rr-time-value {
        font-size: 42px; font-weight: 800;
        font-family: 'Bebas Neue', monospace;
        color: #00e5ff;
        text-shadow: 0 0 20px rgba(0,229,255,0.3);
      }
      .rr-lap-times {
        margin-bottom: 32px;
      }
      .rr-lap-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 16px; margin-bottom: 8px;
        font-size: 11px; font-weight: 700; letter-spacing: 2px;
        text-transform: uppercase; color: rgba(255,255,255,0.3);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .rr-lap-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 16px;
        background: rgba(255,255,255,0.02);
        border-radius: 8px;
        margin-bottom: 4px;
        transition: background 0.2s ease;
        animation: rrLapRowIn 0.4s ease both;
      }
      .rr-lap-row:hover { background: rgba(255,255,255,0.05); }
      .rr-lap-row.best {
        background: linear-gradient(90deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02));
        border: 1px solid rgba(255,215,0,0.15);
      }
      @keyframes rrLapRowIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
      .rr-lap-num { font-weight: 600; font-size: 14px; color: rgba(255,255,255,0.6); }
      .rr-lap-num.best { color: #ffd700; }
      .rr-lap-time { font-family: 'Bebas Neue', monospace; font-size: 20px; font-weight: 700; }
      .rr-lap-time.best { color: #ffd700; text-shadow: 0 0 12px rgba(255,215,0,0.4); }
      .rr-lap-badge {
        font-size: 10px; font-weight: 700; padding: 2px 8px;
        background: rgba(255,215,0,0.15); color: #ffd700;
        border-radius: 4px; letter-spacing: 1px;
      }
      .rr-actions {
        display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
      }
      .rr-btn {
        padding: 14px 32px; border-radius: 10px; border: none;
        font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700;
        letter-spacing: 1px; text-transform: uppercase;
        cursor: pointer; transition: all 0.3s ease;
        min-height: 48px;
      }
      .rr-btn-primary {
        background: linear-gradient(135deg, #ff4d2e, #ff8c00);
        color: #fff; box-shadow: 0 4px 20px rgba(255,77,46,0.3);
      }
      .rr-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(255,77,46,0.4); }
      .rr-btn-secondary {
        background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .rr-btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; transform: translateY(-2px); }
    </style>
    <div class="rr-container">
      <div class="rr-header">
        <div class="rr-title">RACE COMPLETE</div>
        <div class="rr-position pos-${Math.min(position, 4)}">
          ${position}<span class="rr-suffix">${ordinalSuffix(position)}</span>
        </div>
        <div class="rr-subtitle">
          ${position === 1 ? 'VICTORY!' : position <= 3 ? 'PODIUM FINISH' : 'KEEP PUSHING!'}
        </div>
      </div>
      
      <div class="rr-time-display">
        <div class="rr-time-label">Total Race Time</div>
        <div class="rr-time-value" id="rr-total-time">00:00.00</div>
      </div>
      
      <div class="rr-lap-times">
        <div class="rr-lap-header">
          <span>Lap</span><span>Time</span><span></span>
        </div>
        ${lapTimes.map((t, i) => `
          <div class="rr-lap-row ${i === bestLapIdx ? 'best' : ''}" style="animation-delay: ${i * 0.1}s">
            <span class="rr-lap-num ${i === bestLapIdx ? 'best' : ''}">LAP ${i + 1}</span>
            <span class="rr-lap-time ${i === bestLapIdx ? 'best' : ''}">${formatTime(t)}</span>
            ${i === bestLapIdx ? '<span class="rr-lap-badge">BEST</span>' : '<span></span>'}
          </div>
        `).join('')}
      </div>
      
      <div class="rr-actions">
        <button class="rr-btn rr-btn-primary" id="rr-race-again">Race Again</button>
        <button class="rr-btn rr-btn-secondary" id="rr-back-menu">Back to Menu</button>
      </div>
    </div>
  `;
  
  root.appendChild(screen);
  
  // Animated counter for total time
  const timeEl = screen.querySelector('#rr-total-time');
  if (timeEl && totalTime > 0) {
    animateCounter(timeEl, totalTime, 1500);
  }
  
  // Button handlers
  screen.querySelector('#rr-race-again').addEventListener('click', () => {
    screen.remove();
    // Hide any remaining HUD
    const hud = document.getElementById('game-hud-root');
    if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
    const oldHud = document.getElementById('game-hud');
    if (oldHud) { oldHud.classList.remove('visible', 'hud-visible'); oldHud.style.opacity = '0'; }
    // Re-mount race scene
    if (window.__raceScene) {
      window.__raceScene.reset();
      if (window.__engine && window.__engine.scenes) {
        window.__engine.scenes.transition(
          { id: 'race-scene', module: window.__raceScene, type: '3d' },
          raceData
        );
      }
    }
  });
  
  screen.querySelector('#rr-back-menu').addEventListener('click', () => {
    screen.remove();
    const hud = document.getElementById('game-hud-root');
    if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
    const oldHud = document.getElementById('game-hud');
    if (oldHud) { oldHud.classList.remove('visible', 'hud-visible'); oldHud.style.opacity = '0'; }
    if (window.__uiRouter) window.__uiRouter.popToRoot();
    const uiShell = document.getElementById('ui-shell');
    if (uiShell) uiShell.style.display = '';
    if (window.__raceScene) window.__raceScene.unmount();
  });
}

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '--:--.--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

function animateCounter(el, target, duration) {
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatTime(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function generateFakeLapTimes(laps, totalTime) {
  const times = [];
  let remaining = totalTime || 90;
  for (let i = 0; i < laps; i++) {
    const base = remaining / (laps - i);
    const variation = (Math.random() - 0.3) * 4;
    const t = Math.max(5, base + variation);
    times.push(t);
    remaining -= t;
  }
  return times;
}

export async function unmount(root) {
  const screen = root.querySelector('.race-results-screen');
  if (screen) screen.remove();
}

export default { mount, unmount };
