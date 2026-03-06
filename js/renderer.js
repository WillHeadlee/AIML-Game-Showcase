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

  // ----- Path corridor -----
  // Draws the enemy path as a 160px-wide dirt corridor (Era 1 style).
  // Call this BEFORE drawGrid so grid lines render on top.
  function drawPath() {
    const len = Path.calculateTotalLength();
    if (!len) return;

    // Sample spline at 5px intervals for a smooth stroke
    const pts = [];
    for (let d = 0; d <= len; d += 5) {
      pts.push(Path.getPositionAtDistance(d));
    }

    const stroke = (width, style) => {
      ctx.lineWidth   = width;
      ctx.strokeStyle = style;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // Dark outer edge
    stroke(168, 'rgba(15, 8, 0, 0.55)');
    // Dirt base — Era 1 earthy brown
    stroke(160, '#6b4e27');
    // Subtle lighter center highlight
    stroke(90,  'rgba(155, 115, 55, 0.35)');

    ctx.restore();
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
            // Corridor drawn by drawPath(); just add a faint grid overlay
            ctx.strokeStyle = 'rgba(255,200,100,0.08)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px + 0.5, py + 0.5, Map.CELL - 1, Map.CELL - 1);
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

  // ----- Enemies -----
  // Draws all active enemies, each rotated to face direction of travel.
  function drawEnemies() {
    for (const e of Enemies.getAll()) {
      const pos     = e.getPosition();
      const tangent = e.getFacing();
      const angle   = Math.atan2(tangent.y, tangent.x);

      const animEntry = Assets.getAnim(e.spriteKey, 'walk');

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      if (animEntry) {
        drawSprite(animEntry, e.frameIndex, -e.drawW / 2, -e.drawH / 2, e.drawW, e.drawH);
      } else {
        // Colored circle while assets load
        ctx.fillStyle = '#e04444';
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(e.drawW, e.drawH) / 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Health bar — screen-space (not rotated)
      if (e.health < e.maxHealth) {
        const barW = e.drawW, barH = 4;
        const barX = pos.x - barW / 2;
        const barY = pos.y - e.drawH / 2 - 8;
        ctx.fillStyle = '#400';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#3f0';
        ctx.fillRect(barX, barY, barW * (e.health / e.maxHealth), barH);
      }
    }
  }

  // ----- Towers -----
  // Tower type colours used for placeholder rendering (no idle sprite available).
  const TOWER_COLORS = {
    club:        '#b03020',
    rockThrower: '#6a7030',
    spear:       '#205880',
  };

  function drawTowers() {
    for (const t of Towers.getAll()) {
      const px = t.gx * Map.CELL;
      const py = t.gy * Map.CELL;
      const cx = px + Map.CELL / 2;
      const cy = py + Map.CELL / 2;
      const r  = Map.CELL / 2 - 4;

      // Attack flash ring — bright pulse that fades over 0.15 s
      if (t.attackFlash > 0) {
        const alpha = (t.attackFlash / 0.15).toFixed(2);
        ctx.strokeStyle = `rgba(255,220,80,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Attack animation sprite — clipped to circular bounding area
      const animEntry = t.attacking ? Assets.getAnim(t.spriteKey, 'attack') : null;
      if (animEntry) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        drawSprite(animEntry, t.frameIndex, px + 4, py + 4, Map.CELL - 8, Map.CELL - 8);
        ctx.restore();

        // Border over sprite
        ctx.strokeStyle = 'rgba(255,220,140,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Placeholder circle (no target / assets not ready)
        ctx.fillStyle = TOWER_COLORS[t.type] ?? '#555';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,220,140,0.75)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${Map.CELL * 0.38}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.label[0], cx, cy);
      }

      // Dormant overlay — semi-transparent grey when no people assigned
      if (t.staffingRatio === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,200,200,0.7)';
        ctx.font = `bold ${Map.CELL * 0.3}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Z', cx, cy);
      }
    }
  }

  // ----- Barricades -----
  // Draws all placed barricades as horizontal wooden planks with an optional HP bar.
  function drawBarricades() {
    for (const b of Barricades.getAll()) {
      const px = b.gx * Map.CELL;
      const py = b.gy * Map.CELL;
      const cy = py + Map.CELL / 2;

      // Main plank body
      ctx.fillStyle = '#7a4820';
      ctx.fillRect(px + 3, cy - 7, Map.CELL - 6, 14);

      // Wood grain highlight
      ctx.fillStyle = 'rgba(200,150,80,0.25)';
      ctx.fillRect(px + 3, cy - 7, Map.CELL - 6, 5);

      // Border
      ctx.strokeStyle = 'rgba(210,155,70,0.8)';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(px + 3, cy - 7, Map.CELL - 6, 14);

      // HP bar — shown only when damaged
      if (b.hp < b.maxHp) {
        const barW = Map.CELL - 6;
        const barX = px + 3;
        const barY = py + 3;
        ctx.fillStyle = '#400';
        ctx.fillRect(barX, barY, barW, 3);
        ctx.fillStyle = '#fa0';
        ctx.fillRect(barX, barY, barW * (b.hp / b.maxHp), 3);
      }
    }
  }

  // ----- Build highlight -----
  // Draws a green (valid) or red (invalid) highlight over the hovered grid cell.
  function drawBuildHighlight() {
    const { buildMode, hoverCell, selectedType } = UI.getBuildState();
    if (!buildMode || !hoverCell) return;

    const { gx, gy } = hoverCell;
    const valid = selectedType === 'barricade'
      ? Barricades.isValid(gx, gy)
      : Towers.isValid(gx, gy);
    const px = gx * Map.CELL;
    const py = gy * Map.CELL;

    ctx.fillStyle   = valid ? 'rgba(0,220,80,0.28)'  : 'rgba(220,40,40,0.28)';
    ctx.strokeStyle = valid ? 'rgba(0,220,80,0.85)'  : 'rgba(220,40,40,0.85)';
    ctx.lineWidth   = 2;
    ctx.fillRect(px, py, Map.CELL, Map.CELL);
    ctx.strokeRect(px + 1, py + 1, Map.CELL - 2, Map.CELL - 2);
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

  return { init, drawZones, drawPath, drawGrid, drawBarricades, drawTowers, drawBuildHighlight, drawEnemies, drawWall, drawSprite };
})();
