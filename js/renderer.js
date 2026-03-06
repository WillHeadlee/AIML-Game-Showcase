/* ============================================================
   renderer.js — Map drawing: zones, grid, wall
   ============================================================ */

const Renderer = (() => {
  let ctx;

  function init(context) {
    ctx = context;
  }

  // ----- Zone backgrounds -----
  function drawZones() {
    const wallX = Map.WALL_COL * Map.CELL; // pixel x = 960

    // Defense zone — dark forest green tint
    ctx.fillStyle = '#0b160b';
    ctx.fillRect(0, 0, wallX, 1080);

    // Settlement zone — dark amber tint
    ctx.fillStyle = '#140f05';
    ctx.fillRect(wallX, 0, 1920 - wallX, 1080);
  }

  // ----- Grid cells -----
  function drawGrid() {
    for (let gy = 0; gy < Map.ROWS; gy++) {
      for (let gx = 0; gx < Map.COLS; gx++) {
        const cell = Map.getCell(gx, gy);
        const px = gx * Map.CELL;
        const py = gy * Map.CELL;

        switch (cell.state) {
          case 'open':
            ctx.fillStyle = 'rgba(255,255,255,0.025)';
            ctx.fillRect(px, py, Map.CELL, Map.CELL);
            ctx.strokeStyle = 'rgba(255,255,255,0.045)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px + 0.5, py + 0.5, Map.CELL - 1, Map.CELL - 1);
            break;
          case 'path':
            ctx.fillStyle = 'rgba(200,150,70,0.14)';
            ctx.fillRect(px, py, Map.CELL, Map.CELL);
            break;
          case 'wall':
            ctx.fillStyle = 'rgba(100,80,50,0.25)';
            ctx.fillRect(px, py, Map.CELL, Map.CELL);
            break;
          case 'blocked':
            // Settlement zone — no grid lines drawn
            break;
        }
      }
    }
  }

  // ----- Center dividing wall -----
  function drawWall() {
    const wallX = Map.WALL_COL * Map.CELL; // 960

    // Stone wall body with gradient depth
    const grad = ctx.createLinearGradient(wallX - 4, 0, wallX + 16, 0);
    grad.addColorStop(0,   'rgba(0,0,0,0.7)');
    grad.addColorStop(0.3, 'rgba(70,55,35,0.95)');
    grad.addColorStop(0.55,'rgba(110,88,55,0.95)');
    grad.addColorStop(0.75,'rgba(90,70,42,0.9)');
    grad.addColorStop(1,   'rgba(0,0,0,0.5)');

    ctx.fillStyle = grad;
    ctx.fillRect(wallX - 4, 0, 20, 1080);

    // Top-edge highlight (lit from above-left)
    ctx.strokeStyle = 'rgba(220,190,120,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wallX + 12, 0);
    ctx.lineTo(wallX + 12, 1080);
    ctx.stroke();

    // Shadow cast onto defense zone
    const shadow = ctx.createLinearGradient(wallX - 20, 0, wallX - 4, 0);
    shadow.addColorStop(0, 'rgba(0,0,0,0)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = shadow;
    ctx.fillRect(wallX - 20, 0, 16, 1080);
  }

  // ----- Sprite drawing -----
  //
  // animEntry  — object returned by Assets.getAnim(key, animName)
  // frameIndex — which frame to show (caller manages timing)
  // x, y       — canvas pixel top-left of bounding box
  // w, h       — draw size in pixels
  //
  // For sprite sheets  : clips one frame from the sheet and draws it.
  // For frame sequences: draws the indexed image scaled to (w, h).
  //
  function drawSprite(animEntry, frameIndex, x, y, w, h) {
    if (!animEntry) return;
    const { image, images, meta } = animEntry;

    if (meta.type === 'sheet') {
      if (!image?.complete) return;
      const fi = frameIndex % meta.frames;
      ctx.imageSmoothingEnabled = false; // keep pixel art crisp
      ctx.drawImage(
        image,
        fi * meta.fw,  meta.dir * meta.fh,   // src x, y
        meta.fw,       meta.fh,               // src w, h
        x, y, w, h                            // dest
      );
      ctx.imageSmoothingEnabled = true;
    } else {
      if (!images) return;
      const fi  = frameIndex % images.length;
      const img = images[fi];
      if (img?.complete) ctx.drawImage(img, x, y, w, h);
    }
  }

  return { init, drawZones, drawGrid, drawWall, drawSprite };
})();
