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

  // Wave complete — advance counter or era
  Events.on('wave:complete', () => {
    if (state.currentWave >= 5) {
      // Era complete
      Events.emit('era:advance', { era: state.currentEra });

      if (state.currentEra >= 5) {
        // Win condition
        state.phase = 'gameover';
        UI.update(state);
        setTimeout(() => { window.location.href = 'game.html'; }, 2000);
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
    setTimeout(() => { window.location.href = 'game.html'; }, 1500);
  });

  // Start game immediately; load sprites in background (circle fallback renders until ready)
  assetsReady = true;
  UI.enableStartButton();
  Assets.loadEra(1);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      UI.closeAll();
      TownBuildingsPanel.close();
      HousingPanel.close();
    }
  });

  _initDevPanel();
  requestAnimationFrame(loop);
}

// ----- Dev Panel -----
function _initDevPanel() {
  const panel = document.createElement('div');
  panel.id = 'dev-panel';
  panel.style.cssText = `
    position: fixed; bottom: 12px; left: 12px; z-index: 9999;
    background: rgba(0,0,0,0.82); border: 1px solid #888;
    border-radius: 6px; padding: 8px 12px;
    font-family: monospace; font-size: 13px; color: #ccc;
    display: flex; align-items: center; gap: 8px;
    pointer-events: auto;
  `;

  const label = document.createElement('span');
  label.textContent = 'DEV Era:';
  panel.appendChild(label);

  for (let era = 1; era <= 5; era++) {
    const btn = document.createElement('button');
    btn.textContent = era;
    btn.dataset.era = era;
    btn.style.cssText = `
      padding: 3px 10px; font-family: monospace; font-size: 13px;
      background: #333; color: #ccc; border: 1px solid #666;
      border-radius: 3px; cursor: pointer;
    `;
    btn.addEventListener('click', () => _devSwitchEra(era));
    panel.appendChild(btn);
  }

  const sep = document.createElement('span');
  sep.textContent = '|';
  sep.style.color = '#555';
  panel.appendChild(sep);

  const fillBtn = document.createElement('button');
  fillBtn.textContent = 'Fill $';
  fillBtn.title = 'Max out gold and all resources';
  fillBtn.style.cssText = `
    padding: 3px 10px; font-family: monospace; font-size: 13px;
    background: #1a3a1a; color: #6f6; border: 1px solid #4a4;
    border-radius: 3px; cursor: pointer;
  `;
  fillBtn.addEventListener('click', () => { Resources.devFill(); UI.update(state); });
  panel.appendChild(fillBtn);

  document.body.appendChild(panel);
}

function _devSwitchEra(era) {
  if (era < 1 || era > 5) return;
  Enemies.clear();
  Towers.clear();
  Barricades.clear();
  state.currentEra  = era;
  state.currentWave = 1;
  state.phase       = 'prep';
  Town.reset(era);
  Abilities.reset();
  Barricades.setEra(era);
  Resources.devFill();
  Assets.loadEra(era).then(() => { UI.update(state); });
  UI.update(state);
}

// ----- Main loop -----
function loop(timestamp) {
  const delta = Math.min(timestamp - lastTimestamp, 100);
  lastTimestamp = timestamp;

  try { update(delta); } catch(e) { console.error('[update] crash:', e); }
  try { render(); } catch(e) { console.error('[render] crash:', e); }

  requestAnimationFrame(loop);
}

// ----- Update -----
function update(delta) {
  if (!assetsReady || state.phase === 'gameover') return;

  if (Waves.isActive()) Resources.update(delta);
  Waves.update(delta);
  Enemies.update(delta);
  Barricades.update(delta);
  Towers.update(delta);
  if (typeof Supply !== 'undefined') Supply.update(delta);
  Abilities.update(delta);
}

// ----- Render -----
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  Renderer.drawZones();
  Renderer.drawGrid();
  Renderer.drawWall();
  Renderer.drawBarricades();
  Renderer.drawTowers();
  Renderer.drawBuildHighlight();
  Renderer.drawEnemies();

  UI.renderHUD();
}

// ----- Boot -----
window.addEventListener('DOMContentLoaded', init);
