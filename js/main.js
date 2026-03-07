/* ============================================================
   main.js — Game entry point & rAF loop
   ============================================================ */

// ----- Global state -----
const state = {
  currentEra:  1,
  currentWave: 1,
  phase:       'prep',   // 'prep' | 'wave' | 'gameover'
};

let canvas, ctx;
let lastTimestamp = 0;
let assetsReady   = false;

function _showError(e) {
  let el = document.getElementById('_dbg_error');
  if (!el) {
    el = document.createElement('div');
    el.id = '_dbg_error';
    el.style.cssText = 'position:fixed;top:0;left:0;background:red;color:#fff;font:14px monospace;padding:8px;z-index:9999;max-width:100%;white-space:pre-wrap;';
    document.body.appendChild(el);
  }
  el.textContent = String(e);
}

// ----- Viewport scaling -----
function scaleGame() {
  const wrapper = document.getElementById('game-wrapper');
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const left  = Math.floor((window.innerWidth  - 1920 * scale) / 2);
  const top   = Math.floor((window.innerHeight - 1080 * scale) / 2);
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.left      = `${left}px`;
  wrapper.style.top       = `${top}px`;
}

// ----- Init -----
function init() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');
  scaleGame();
  window.addEventListener('resize', scaleGame);

  Renderer.init(ctx);
  Town.init(state.currentEra);
  UI.init();
  TownBuildingsPanel.init();
  HousingPanel.init();
  SupplyOverlay.init();

  Events.on('test', d => console.log('[Events] received:', d));
  Events.emit('test', { message: 'Event bus OK', state });

  // Wave complete — advance counter or era
  Events.on('wave:complete', () => {
    if (state.currentWave >= 5) {
      // Era complete
      Events.emit('era:advance', { era: state.currentEra });

      if (state.currentEra >= 5) {
        // Win condition
        state.phase = 'gameover';
        UI.update(state);
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        return;
      }

      state.currentEra++;
      state.currentWave = 1;
      Town.reset(state.currentEra);
      Abilities.reset();
      Barricades.setEra(state.currentEra);

      // Load new era assets then show advancement overlay
      Assets.loadEra(state.currentEra).then(() => {
        EraAdvancementOverlay.show(state.currentEra, () => {
          PeopleArrivalPopup.show(state.currentEra, () => {
            state.phase = 'prep';
            UI.update(state);
          });
        });
      });
    } else {
      state.currentWave++;
      PeopleArrivalPopup.show(state.currentEra, () => {
        state.phase = 'prep';
        UI.update(state);
      });
    }
  });

  // Enemy killed — award gold reward
  Events.on('enemy:killed', ({ goldReward }) => Resources.addGold(goldReward));

  // Game over — brief pause then redirect to home page
  Events.on('game:over', () => {
    state.phase = 'gameover';
    UI.update(state);
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
  });

  // Start game immediately; load sprites in background (circle fallback renders until ready)
  assetsReady = true;
  UI.enableStartButton();
  Assets.loadEra(1);

  requestAnimationFrame(loop);
}

// ----- Main loop -----
function loop(timestamp) {
  const delta = Math.min(timestamp - lastTimestamp, 100);
  lastTimestamp = timestamp;

  try { update(delta); } catch(e) { console.error('[update] crash:', e); _showError(e); }
  try { render(); } catch(e) { console.error('[render] crash:', e); _showError(e); }

  requestAnimationFrame(loop);
}

// ----- Update -----
function update(delta) {
  if (!assetsReady || state.phase === 'gameover') return;

  Resources.update(delta);
  Waves.update(delta);
  Enemies.update(delta);
  Barricades.update(delta);
  Towers.update(delta);
  if (typeof Supply !== 'undefined') Supply.update();
  Abilities.update(delta);
}

// ----- Render -----
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  Renderer.drawZones();
  Renderer.drawPath();
  Renderer.drawGrid();
  Renderer.drawBarricades();
  Renderer.drawTowers();
  Renderer.drawBuildHighlight();
  Renderer.drawEnemies();

  UI.renderHUD();
}

// ----- Boot -----
window.addEventListener('DOMContentLoaded', init);
