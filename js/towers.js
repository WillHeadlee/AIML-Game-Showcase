/* ============================================================
   towers.js — Tower definitions, placement, combat, and management
   ============================================================ */

const Towers = (() => {

  // ----- Tower definitions -----
  // rangeTiles: attack radius in grid tiles (1 tile = 40px)
  // attackSpeed: seconds between attacks
  // aoe: false = single-target, true = damages all enemies in range
  // cost: resource amounts deducted on placement
  const DEFS = {
    club:        { era:1, damage:20, attackSpeed:1.0, rangeTiles:2, aoe:false, spriteKey:'clubMan',  label:'Club',         cost:{ bone: 5, wood:  3 }, peopleRequired:1 },
    rockThrower: { era:1, damage:14, attackSpeed:2.2, rangeTiles:4, aoe:false, spriteKey:'stoneMan', label:'Rock Thrower', cost:{ bone: 8, wood:  5 }, peopleRequired:1 },
    spear:       { era:1, damage:30, attackSpeed:2.8, rangeTiles:6, aoe:false, spriteKey:'spearMan', label:'Spear',        cost:{ bone:10, wood:  8 }, peopleRequired:1 },
  };

  let nextTowerId = 0;

  let towers = [];

  // ----- Tower class -----
  class Tower {
    constructor(type, gx, gy) {
      const def = DEFS[type];
      if (!def) throw new Error(`[Towers] unknown type: ${type}`);

      this.id             = `tower_${nextTowerId++}`;
      this.type           = type;
      this.gx             = gx;
      this.gy             = gy;
      this.damage         = def.damage;
      this.attackSpeed    = def.attackSpeed;
      this.rangePx        = def.rangeTiles * Map.CELL;
      this.aoe            = def.aoe;
      this.spriteKey      = def.spriteKey;
      this.label          = def.label;
      this.peopleRequired = def.peopleRequired ?? 1;

      // Center pixel position used for range checks
      const center = Map.gridToPixel(gx, gy);
      this.cx = center.x;
      this.cy = center.y;

      // Animation state
      this.frameIndex   = 0;
      this.frameElapsed = 0;
      this.attacking    = false;

      // attackTimer: seconds until next shot is allowed (starts at 0 so towers fire immediately)
      this.attackTimer = 0;
      // attackFlash: seconds remaining on the muzzle-flash visual (decays to 0)
      this.attackFlash = 0;
    }

    // staffingRatio: 0.0 (dormant) – 1.0 (fully staffed)
    get staffingRatio() {
      const assigned = People.getAssigned(this.id);
      return this.peopleRequired > 0 ? Math.min(1, assigned / this.peopleRequired) : 1;
    }

    // ----- update(dt, enemies) -----
    // Called each frame. Handles cooldown, targeting, and animation.
    update(dt, enemies) {
      // Dormant — no people assigned; do nothing
      if (this.staffingRatio === 0) {
        this.attacking = false;
        return;
      }

      // Decay attack flash visual
      if (this.attackFlash > 0) {
        this.attackFlash = Math.max(0, this.attackFlash - dt / 1000);
      }

      // Advance attack animation frames while attacking
      if (this.attacking) {
        const animEntry = Assets.getAnim(this.spriteKey, 'attack');
        if (animEntry) {
          const frameDur = 1000 / animEntry.meta.fps;
          this.frameElapsed += dt;
          while (this.frameElapsed >= frameDur) {
            this.frameIndex++;
            this.frameElapsed -= frameDur;
          }
          // Determine total frame count (sheet uses meta.frames; sequences use images.length)
          const frameCount = animEntry.meta.type === 'sheet'
            ? animEntry.meta.frames
            : (animEntry.images?.length ?? 1);
          this.frameIndex %= frameCount;
        }
      }

      // Count down attack cooldown
      this.attackTimer -= dt / 1000;
      if (this.attackTimer > 0) return;

      // Choose targeting mode
      if (this.aoe) {
        this._fireAoE(enemies);
      } else {
        this._fireSingleTarget(enemies);
      }
    }

    // ----- Single-target: nearest enemy in range -----
    _fireSingleTarget(enemies) {
      let nearest     = null;
      let nearestDist = Infinity;

      for (const e of enemies) {
        if (e.dead || e.reached) continue;
        const pos  = e.getPosition();
        const dx   = pos.x - this.cx;
        const dy   = pos.y - this.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= this.rangePx && dist < nearestDist) {
          nearest     = e;
          nearestDist = dist;
        }
      }

      if (!nearest) {
        this.attacking = false;
        return;
      }

      nearest.takeDamage(this.damage * this.staffingRatio);
      this._onFire();
    }

    // ----- AoE: all enemies within range -----
    // Interface prepared for future era towers; no Era 1 tower uses this path.
    _fireAoE(enemies) {
      let hit = false;

      for (const e of enemies) {
        if (e.dead || e.reached) continue;
        const pos = e.getPosition();
        const dx  = pos.x - this.cx;
        const dy  = pos.y - this.cy;
        if (Math.sqrt(dx * dx + dy * dy) <= this.rangePx) {
          e.takeDamage(this.damage * this.staffingRatio);
          hit = true;
        }
      }

      if (hit) {
        this._onFire();
      } else {
        this.attacking = false;
      }
    }

    // ----- Shared post-fire state -----
    _onFire() {
      this.attackTimer  = this.attackSpeed;
      this.attackFlash  = 0.15;
      this.attacking    = true;
      this.frameIndex   = 0;
      this.frameElapsed = 0;
    }
  }

  // ----- Module-level update -----
  // Called each frame from main.js; drives all placed towers.
  function update(dt) {
    const enemies = Enemies.getAll();
    for (const t of towers) {
      t.update(dt, enemies);
    }
  }

  // ----- Placement validation -----
  // Valid: defense zone, adjacent to path, not on path, not occupied.
  function isValid(gx, gy) {
    const cell = Map.getCell(gx, gy);
    if (!cell) return false;
    if (!Map.isDefenseZone(gx)) return false;
    if (cell.state !== 'open') return false;
    return Map.isAdjacentToPath(gx, gy);
  }

  // place(type, gx, gy) — place a tower on the grid.
  // Returns: 'ok' | 'invalid' | 'insufficient'
  function place(type, gx, gy) {
    if (!isValid(gx, gy)) return 'invalid';
    const cost = DEFS[type]?.cost ?? {};
    if (!Resources.canAfford(cost)) return 'insufficient';
    Resources.spendResources(cost);
    towers.push(new Tower(type, gx, gy));
    Map.setCell(gx, gy, 'tower');
    return 'ok';
  }

  function getAll() { return towers; }

  // getAt(gx, gy) — returns the tower at the given grid cell, or null.
  function getAt(gx, gy) {
    return towers.find(t => t.gx === gx && t.gy === gy) ?? null;
  }

  // demolish(tower) — returns assigned people to pool, removes tower, frees cell.
  function demolish(tower) {
    const count = People.getAssigned(tower.id);
    for (let i = 0; i < count; i++) People.removeFromTower(tower.id);
    towers = towers.filter(t => t !== tower);
    Map.setCell(tower.gx, tower.gy, 'open');
  }

  function clear() { towers = []; }

  return { DEFS, isValid, place, update, getAll, getAt, demolish, clear };
})();
