/* ============================================================
   main.js — Game entry point & rAF loop
   ============================================================ */

// ----- Global state -----
const state = {
  currentEra:  1,
  currentWave: 1,
  phase:       'prep',   // 'prep' | 'wave' | 'gameover'
};

// ----- Canvas / context -----
let canvas, ctx;

// ----- Timing -----
let lastTimestamp = 0;

let assetsReady = false;

// ----- Init -----
function init() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  Renderer.init(ctx);
  Town.init(state.currentEra);
  UI.init();
  TownBuildingsPanel.init();
  HousingPanel.init();
  SupplyOverlay.init();

  // Event bus smoke test
  Events.on('test', d => console.log('[Events] received:', d));
  Events.emit('test', { message: 'Event bus OK', state });

  // Wave complete — advance counter, show people arrival popup, then enter prep
  Events.on('wave:complete', () => {
    if (state.currentWave >= 5) {
      Events.emit('era:advance', { era: state.currentEra });
      console.log(`[Main] era:advance — era ${state.currentEra} complete`);
      state.currentWave = 1;
      // Actual era transition implemented in a later step
    } else {
      state.currentWave++;
    }
    // Show arrival popup; prep phase begins only after the player clicks Done
    PeopleArrivalPopup.show(state.currentEra, () => {
      state.phase = 'prep';
      UI.update(state);
    });
  });

  // Enemy killed — award gold reward
  Events.on('enemy:killed', ({ goldReward }) => Resources.addGold(goldReward));

  // Game over — brief pause then redirect to home page
  Events.on('game:over', () => {
    state.phase = 'gameover';
    UI.update(state);
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
  });

  // Load Era 1 assets; unlock the Start Wave button when ready
  Assets.loadEra(1).then(() => {
    assetsReady = true;
    UI.enableStartButton();
  });

  requestAnimationFrame(loop);
}

// ----- Main loop -----
function loop(timestamp) {
  const delta = Math.min(timestamp - lastTimestamp, 100); // clamp large gaps
  lastTimestamp = timestamp;

  update(delta);
  render();

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
  Supply.update();
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
  Renderer.drawWall(); // drawn last so it overlaps sprites crossing the wall

  UI.renderHUD(); // keeps town health bar in sync every frame
}

// ----- Boot -----
window.addEventListener('DOMContentLoaded', init);
