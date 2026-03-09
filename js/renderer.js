/* ============================================================
   renderer.js — Map drawing: zones, path, grid, wall, enemies, towers
   ============================================================ */

const Renderer = (() => {
  let ctx;
  let mapBg = null;

  function init(context) {
    ctx = context;
    mapBg = new Image();
    mapBg.src = 'assets/New map.png';
  }

  // ----- Era theme helpers -----
  const ERA_THEMES = {
    1: { defenseZone: '#0b160b', settlementZone: '#140f05', pathFill: '#6b4e27', pathHighlight: 'rgba(155,115,55,0.35)' },
    2: { defenseZone: '#0d0d14', settlementZone: '#0e0c14', pathFill: '#5a5065', pathHighlight: 'rgba(130,110,160,0.3)' },
    3: { defenseZone: '#091418', settlementZone: '#0a1209', pathFill: '#7a6a42', pathHighlight: 'rgba(160,140,80,0.35)' },
    4: { defenseZone: '#0c100a', settlementZone: '#0c0e08', pathFill: '#5a5030', pathHighlight: 'rgba(100,95,60,0.3)'  },
    5: { defenseZone: '#080b18', settlementZone: '#080d18', pathFill: '#1a3055', pathHighlight: 'rgba(60,120,220,0.3)' },
  };

  function _theme() { return ERA_THEMES[state.currentEra] ?? ERA_THEMES[1]; }

  // ----- Zone backgrounds -----
  function drawZones() {
    if (mapBg && mapBg.complete && mapBg.naturalWidth > 0) {
      ctx.drawImage(mapBg, 0, 0, 1920, 1080);
    } else {
      const wallX = GameMap.WALL_COL * GameMap.CELL;
      const theme = _theme();
      ctx.fillStyle = theme.defenseZone;
      ctx.fillRect(0, 0, wallX, 1080);
      ctx.fillStyle = theme.settlementZone;
      ctx.fillRect(wallX, 0, 1920 - wallX, 1080);
    }
  }

  // ----- Path corridor overlay -----
  function drawPath() {
    const total = Path.calculateTotalLength();
    const STEP  = 6;

    // Filled semi-transparent corridor
    ctx.beginPath();
    for (let d = 0; d <= total; d += STEP) {
      const pos = Path.getPositionAtDistance(d);
      const tan = Path.getTangentAtDistance(d);
      const nx  = -tan.y * 40, ny = tan.x * 40; // normal, 40px half-width
      if (d === 0) {
        ctx.moveTo(pos.x + nx, pos.y + ny);
      } else {
        ctx.lineTo(pos.x + nx, pos.y + ny);
      }
    }
    for (let d = total; d >= 0; d -= STEP) {
      const pos = Path.getPositionAtDistance(d);
      const tan = Path.getTangentAtDistance(d);
      const nx  = -tan.y * 40, ny = tan.x * 40;
      ctx.lineTo(pos.x - nx, pos.y - ny);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 200, 80, 0.18)';
    ctx.fill();

    // Centre line
    ctx.beginPath();
    for (let d = 0; d <= total; d += STEP) {
      const { x, y } = Path.getPositionAtDistance(d);
      d === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.7)';
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([14, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint dots
    for (const wp of Path.WAYPOINTS) {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 7, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(255, 220, 60, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }

  // ----- Grid cells -----
  function drawGrid() {
    for (let gy = 0; gy < GameMap.ROWS; gy++) {
      for (let gx = 0; gx < GameMap.COLS; gx++) {
        const cell = GameMap.getCell(gx, gy);
        const px = gx * GameMap.CELL;
        const py = gy * GameMap.CELL - 5;

        switch (cell.state) {
          case 'open':
            ctx.fillStyle = 'rgba(255,255,255,0.025)';
            ctx.fillRect(px, py, GameMap.CELL, GameMap.CELL);
            ctx.strokeStyle = 'rgba(255,255,255,0.045)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px + 0.5, py + 0.5, GameMap.CELL - 1, GameMap.CELL - 1);
            break;
          case 'path':
            // invisible — path is shown by the map image
            break;
          case 'wall':
            ctx.fillStyle = 'rgba(100,80,50,0.25)';
            ctx.fillRect(px, py, GameMap.CELL, GameMap.CELL);
            break;
          case 'blocked':
            break;
        }
      }
    }
  }

  // ----- Center dividing wall -----
  function drawWall() {
    const wallX = GameMap.WALL_COL * GameMap.CELL;

    const grad = ctx.createLinearGradient(wallX - 4, 0, wallX + 16, 0);
    grad.addColorStop(0,   'rgba(0,0,0,0.7)');
    grad.addColorStop(0.3, 'rgba(70,55,35,0.95)');
    grad.addColorStop(0.55,'rgba(110,88,55,0.95)');
    grad.addColorStop(0.75,'rgba(90,70,42,0.9)');
    grad.addColorStop(1,   'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(wallX - 4, 0, 20, 1080);

    ctx.strokeStyle = 'rgba(220,190,120,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wallX + 12, 0);
    ctx.lineTo(wallX + 12, 1080);
    ctx.stroke();

    const shadow = ctx.createLinearGradient(wallX - 20, 0, wallX - 4, 0);
    shadow.addColorStop(0, 'rgba(0,0,0,0)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = shadow;
    ctx.fillRect(wallX - 20, 0, 16, 1080);
  }

  // ----- Enemies -----
  function drawEnemies() {
    for (const e of Enemies.getAll()) {
      const pos     = e.getPosition();
      const tangent = e.getFacing();
      const angle   = Math.atan2(tangent.y, tangent.x);

      const animEntry = Assets.getAnim(e.spriteKey, 'walk');

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      const drawn = animEntry && drawSprite(animEntry, e.frameIndex, -e.drawW / 2, -e.drawH / 2, e.drawW, e.drawH);
      if (!drawn) {
        // Fallback colored circle (no sprite or image not yet loaded)
        ctx.fillStyle = _enemyColor(e.type);
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(e.drawW, e.drawH) / 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Health bar — visible for 4s after taking damage, fades out in last second
      if (e.damageTimer > 0 && e.health < e.maxHealth) {
        const barW = e.drawW * 0.9;
        const barX = pos.x - barW / 2;
        const barY = pos.y - e.drawH / 2 - 7;
        const pct  = e.health / e.maxHealth;
        ctx.globalAlpha = Math.min(1, e.damageTimer);
        ctx.fillStyle = '#200';
        ctx.fillRect(barX, barY, barW, 5);
        ctx.fillStyle = pct > 0.5 ? '#3d3' : pct > 0.25 ? '#fa0' : '#f22';
        ctx.fillRect(barX, barY, barW * pct, 5);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barW, 5);
        ctx.globalAlpha = 1;
      }
    }
  }

  const ENEMY_COLORS = {
    boar:'#c85050', sabreTooth:'#e08030', mastodon:'#909090',
    witch:'#9040c0', vampire:'#600030', ghost:'#c0c0ff',
    pirateSword:'#4060a0', pirateRifle:'#4080c0', pirateBomb:'#c04020',
    gruntZombie:'#507030', vombie:'#30a050', necroZombie:'#206040',
    laserAlien:'#00ddff', fortniteBart:'#ff8800', flyingSaucer:'#aaddff',
  };
  function _enemyColor(type) { return ENEMY_COLORS[type] ?? '#e04444'; }

  // ----- Towers -----
  const TOWER_COLORS = {
    club:'#8B4513', rockThrower:'#A0522D', spear:'#CD853F',
    sword:'#C0C0C0', cavalry:'#8B6914', crossbow:'#6B8E23',
    cutlass:'#DAA520', blunderbuss:'#8B4513', mortar:'#696969',
    rifleman:'#556B2F', machineGun:'#4A4A4A', artillery:'#8B7355',
    laserTurret:'#00CED1', railgun:'#4682B4', nukeStation:'#8B0000',
  };

  function drawTowers() {
    for (const t of Towers.getAll()) {
      const cx = t.cx;
      const cy = t.cy - 5;  // align with grid -5px shift
      const r  = GameMap.CELL * 0.44;

      const animEntry = Assets.getAnim(t.spriteKey, 'attack');

      if (t.attacking && animEntry) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        drawSprite(animEntry, t.frameIndex, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();

        ctx.strokeStyle = 'rgba(255,220,140,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = TOWER_COLORS[t.type] ?? '#555';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,220,140,0.75)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${GameMap.CELL * 0.38}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.label[0], cx, cy);
      }

      // Dormant overlay
      if (t.staffingRatio === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,200,200,0.7)';
        ctx.font = `bold ${GameMap.CELL * 0.3}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Z', cx, cy);
      }
    }
  }

  // ----- Barricades -----
  function drawBarricades() {
    for (const b of Barricades.getAll()) {
      const px = b.gx * GameMap.CELL;
      const py = b.gy * GameMap.CELL - 5;  // align with grid -5px shift
      const cy = py + GameMap.CELL / 2;

      ctx.fillStyle = '#7a4820';
      ctx.fillRect(px + 3, cy - 7, GameMap.CELL - 6, 14);
      ctx.fillStyle = 'rgba(200,150,80,0.25)';
      ctx.fillRect(px + 3, cy - 7, GameMap.CELL - 6, 5);
      ctx.strokeStyle = 'rgba(210,155,70,0.8)';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(px + 3, cy - 7, GameMap.CELL - 6, 14);

      if (b.hp < b.maxHp) {
        const barW = GameMap.CELL - 6;
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
  function drawBuildHighlight() {
    const { buildMode, hoverCell, selectedType } = UI.getBuildState();
    if (!buildMode || !hoverCell) return;

    const { gx, gy } = hoverCell;
    const valid = selectedType === 'barricade'
      ? Barricades.isValid(gx, gy)
      : Towers.isValid(gx, gy);
    const px = gx * GameMap.CELL;
    const py = gy * GameMap.CELL - 5;  // align with grid -5px shift

    ctx.fillStyle   = valid ? 'rgba(0,220,80,0.28)'  : 'rgba(220,40,40,0.28)';
    ctx.strokeStyle = valid ? 'rgba(0,220,80,0.85)'  : 'rgba(220,40,40,0.85)';
    ctx.lineWidth   = 2;
    ctx.fillRect(px, py, GameMap.CELL, GameMap.CELL);
    ctx.strokeRect(px + 1, py + 1, GameMap.CELL - 2, GameMap.CELL - 2);

    // Range preview circle for towers
    const towerDef = selectedType !== 'barricade' ? Towers.DEFS[selectedType] : null;
    if (towerDef) {
      const cx = gx * GameMap.CELL + GameMap.CELL / 2;
      const cy = gy * GameMap.CELL - 5 + GameMap.CELL / 2;
      const r  = towerDef.rangeTiles * GameMap.CELL;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle   = valid ? 'rgba(0,220,80,0.07)' : 'rgba(220,40,40,0.07)';
      ctx.fill();
      ctx.strokeStyle = valid ? 'rgba(0,220,80,0.5)'  : 'rgba(220,40,40,0.5)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ----- Sprite drawing — returns true if something was drawn -----
  function drawSprite(animEntry, frameIndex, x, y, w, h) {
    if (!animEntry) return false;
    const { image, images, meta } = animEntry;

    if (meta.type === 'sheet') {
      if (!image?.complete) return false;
      const fi = frameIndex % meta.frames;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, fi * meta.fw, meta.dir * meta.fh, meta.fw, meta.fh, x, y, w, h);
      ctx.imageSmoothingEnabled = true;
      return true;
    } else {
      if (!images) return false;
      const fi  = frameIndex % images.length;
      const img = images[fi];
      if (!img?.complete) return false;
      ctx.drawImage(img, x, y, w, h);
      return true;
    }
  }

  return { init, drawZones, drawPath, drawGrid, drawBarricades, drawTowers, drawBuildHighlight, drawEnemies, drawWall, drawSprite };
})();
