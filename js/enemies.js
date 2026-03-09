/* ============================================================
   enemies.js — Enemy classes, movement, animation
   ============================================================ */

const Enemies = (() => {

  // ----- Enemy definitions -----
  // speedTiles: tiles per second (1 tile = GameMap.CELL px)
  // goldRange: [min, max] reward on kill (used in Step 9)
  const DEFS = {
    // Era 1 — Prehistoric
    boar:         { era:1, health:  50, speedTiles:2.8, townDamage: 15, spriteKey:'boar',           drawW: 40,  drawH: 40,  goldRange:[8,12]  },
    sabreTooth:   { era:1, health:  80, speedTiles:4.0, townDamage: 25, spriteKey:'saberToothTiger', drawW: 55,  drawH: 31,  goldRange:[8,12]  },
    mastodon:     { era:1, health: 280, speedTiles:1.0, townDamage: 80, spriteKey:'mammoth',          drawW: 90,  drawH: 53,  goldRange:[18,22] },

    // Era 2 — Medieval
    witch:        { era:2, health:  90, speedTiles:1.8, townDamage: 20, spriteKey:'witch',            drawW: 40,  drawH: 40,  goldRange:[8,12]  },
    vampire:      { era:2, health: 130, speedTiles:2.8, townDamage: 35, spriteKey:'vampire',          drawW: 40,  drawH: 40,  goldRange:[8,12]  },
    ghost:        { era:2, health: 160, speedTiles:1.0, townDamage: 50, spriteKey:'ghost',            drawW: 40,  drawH: 40,  goldRange:[18,22] },

    // Era 3 — Pirate
    pirateSword:  { era:3, health: 140, speedTiles:1.8, townDamage: 40, spriteKey:'pirateSword',      drawW: 40,  drawH: 40,  goldRange:[8,12]  },
    pirateRifle:  { era:3, health: 100, speedTiles:1.0, townDamage: 30, spriteKey:'pirateRifle',      drawW: 40,  drawH: 40,  goldRange:[8,12]  },
    pirateBomb:   { era:3, health: 180, speedTiles:1.8, townDamage: 70, spriteKey:'pirateBomb',       drawW: 40,  drawH: 40,  goldRange:[18,22] },

    // Era 4 — WW2 Zombies
    gruntZombie:  { era:4, health: 180, speedTiles:1.8, townDamage: 45, spriteKey:'gruntZombie',      drawW: 40,  drawH: 40,  goldRange:[8,12]  },
    vombie:       { era:4, health: 220, speedTiles:1.0, townDamage: 65, spriteKey:'vombie',           drawW: 40,  drawH: 40,  goldRange:[18,22] },
    necroZombie:  { era:4, health: 300, speedTiles:1.0, townDamage: 90, spriteKey:'necroZombie',      drawW: 40,  drawH: 40,  goldRange:[18,22] },

    // Era 5 — Sci-Fi
    laserAlien:   { era:5, health: 280, speedTiles:2.8, townDamage: 70, spriteKey:'laserAlien',       drawW: 40,  drawH: 40,  goldRange:[8,12]  },
    fortniteBart: { era:5, health: 350, speedTiles:1.8, townDamage:100, spriteKey:'fortniteBart',     drawW: 40,  drawH: 40,  goldRange:[18,22] },
    flyingSaucer: { era:5, health: 220, speedTiles:4.0, townDamage: 55, spriteKey:'flyingSaucer',     drawW: 40,  drawH: 40,  goldRange:[8,12]  },
  };

  // Active enemy list
  let enemies = [];

  // ----- Enemy class -----
  class Enemy {
    constructor(type) {
      const def = DEFS[type];
      if (!def) throw new Error(`[Enemies] unknown type: ${type}`);

      this.type       = type;
      this.health     = def.health;
      this.maxHealth  = def.health;
      this.speed      = def.speedTiles * GameMap.CELL;  // px/s
      this.townDamage = def.townDamage;
      this.spriteKey  = def.spriteKey;
      this.drawW      = def.drawW;
      this.drawH      = def.drawH;

      // Roll gold reward once on spawn (used in Step 9)
      const [lo, hi] = def.goldRange;
      this.goldReward = lo + Math.floor(Math.random() * (hi - lo + 1));

      // Path progress
      this.distance = 0;           // arc-length along spline (px)

      // Fixed random y offset — staggered position along the path (±10px)
      this.yOffset = (Math.random() * 2 - 1) * 10;

      // Animation
      this.frameIndex   = Math.floor(Math.random() * 20); // stagger frames
      this.frameElapsed = 0;

      // State flags
      this.dead    = false;
      this.reached = false;  // reached town end (despawn silently)

      // Health bar visibility timer (seconds remaining)
      this.damageTimer = 0;
    }

    // Tick the health bar visibility timer.
    updateDamageTimer(dt) {
      if (this.damageTimer > 0) this.damageTimer -= dt / 1000;
    }

    // Advance position along the spline and update wobble.
    // Speed is scaled by any nearby barricade's slowFactor.
    updatePosition(dt) {
      const pos  = this.getPosition();
      const mult = Barricades.getSpeedMultiplier(pos.x, pos.y);
      this.distance += this.speed * mult * (dt / 1000);

      if (this.distance >= Path.calculateTotalLength()) {
        this.reached = true;
      }
    }

    // Returns canvas pixel position {x, y} including fixed y offset.
    getPosition() {
      const pathPt = Path.getPositionAtDistance(this.distance);
      return {
        x: pathPt.x,
        y: pathPt.y + this.yOffset,
      };
    }

    // Returns unit direction vector {x, y} at current position.
    getFacing() {
      return Path.getTangentAtDistance(this.distance);
    }

    // Step animation frame forward.
    updateAnimation(dt) {
      const animEntry = Assets.getAnim(this.spriteKey, 'walk');
      if (!animEntry) return;
      const frameDur = 1000 / animEntry.meta.fps;
      this.frameElapsed += dt;
      while (this.frameElapsed >= frameDur) {
        this.frameIndex++;
        this.frameElapsed -= frameDur;
      }
    }

    // Called by tower combat (Step 8).
    takeDamage(n) {
      this.health -= n;
      this.damageTimer = 4;  // show health bar for 4 seconds after last hit
      if (this.health <= 0 && !this.dead) this.die();
    }

    // Mark dead and emit event (Step 8/9).
    die() {
      this.dead = true;
      Events.emit('enemy:killed', { goldReward: this.goldReward, type: this.type });
    }
  }

  // ----- Public API -----

  function spawn(type) {
    enemies.push(new Enemy(type));
  }

  function update(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.updatePosition(dt);
      e.updateAnimation(dt);
      e.updateDamageTimer(dt);
      if (e.reached) {
        Town.takeDamage(e.townDamage);
        enemies.splice(i, 1);
      } else if (e.dead) {
        enemies.splice(i, 1);
      }
    }
  }

  function getAll()  { return enemies; }
  function count()   { return enemies.length; }
  function clear()   { enemies = []; }

  return { spawn, update, getAll, count, clear, DEFS };
})();
