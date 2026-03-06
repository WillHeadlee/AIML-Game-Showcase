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

// ----- Demo sprite state (replaced by entity system in later steps) -----
const demo = {
  boarFrame:   0,
  boarElapsed: 0,
  boarX:       80,       // canvas px — walks left→right across defense zone
  boarY:       400,
  boarSpeed:   60,       // px/sec
};

let assetsReady = false;

// ----- Init -----
function init() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  Renderer.init(ctx);

  // Event bus smoke test
  Events.on('test', d => console.log('[Events] received:', d));
  Events.emit('test', { message: 'Event bus OK', state });

  // Boar is a tiny sprite sheet — loads near-instantly.
  // All other entity assets are loaded on demand by the enemy/tower systems.
  Assets.load('boar').then(() => { assetsReady = true; });

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
  if (!assetsReady) return;

  // Advance boar animation frame
  const boarEntry = Assets.getAnim('boar', 'walk');
  if (boarEntry) {
    demo.boarElapsed += delta;
    const frameDur = 1000 / boarEntry.meta.fps;
    while (demo.boarElapsed >= frameDur) {
      demo.boarFrame   = (demo.boarFrame + 1) % boarEntry.meta.frames;
      demo.boarElapsed -= frameDur;
    }
  }

  // Walk across defense zone, loop back
  demo.boarX += demo.boarSpeed * (delta / 1000);
  if (demo.boarX > 940) demo.boarX = -96;
}

// ----- Render -----
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  Renderer.drawZones();
  Renderer.drawGrid();

  // Demo boar — 96×96 px (3 grid cells; keeps pixel art readable)
  if (assetsReady) {
    const boarEntry = Assets.getAnim('boar', 'walk');
    Renderer.drawSprite(boarEntry, demo.boarFrame, demo.boarX, demo.boarY, 96, 96);
  }

  Renderer.drawWall(); // wall drawn last so it overlaps sprites that cross it

  // Debug: state overlay
  ctx.fillStyle = 'rgba(255,215,0,0.7)';
  ctx.font = '14px monospace';
  ctx.fillText(`Era ${state.currentEra}  |  Wave ${state.currentWave}  |  Phase: ${state.phase}`, 12, 20);

  if (!assetsReady) {
    ctx.fillStyle = 'rgba(255,215,0,0.4)';
    ctx.fillText('Loading assets...', 12, 44);
  }
}

// ----- Boot -----
window.addEventListener('DOMContentLoaded', init);
