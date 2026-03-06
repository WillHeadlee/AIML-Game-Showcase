/* ============================================================
   barricades.js — Placeable path barricades: slow enemies, have HP
   ============================================================ */

const Barricades = (() => {

  // Era 1 wooden barricade:
  //   slowFactor   — enemy speed multiplied by this while within slowRadius
  //   slowRadius   — pixel radius for slow & damage detection
  //   damagePerSec — HP lost per second per enemy in contact
  //   cost         — resource cost to place
  const DEF = {
    hp:           80,
    slowFactor:   0.35,
    slowRadius:   52,
    damagePerSec: 8,
    cost:         { bone: 3, wood: 4 },
    label:        'Barricade',
  };

  let nextId     = 0;
  let barricades = [];

  // ----- Barricade class -----
  class Barricade {
    constructor(gx, gy) {
      this.id    = `barricade_${nextId++}`;
      this.gx    = gx;
      this.gy    = gy;
      this.hp    = DEF.hp;
      this.maxHp = DEF.hp;
      this.dead  = false;

      const c  = Map.gridToPixel(gx, gy);
      this.cx  = c.x;
      this.cy  = c.y;
    }

    takeDamage(amount) {
      this.hp -= amount;
      if (this.hp <= 0 && !this.dead) this.dead = true;
    }
  }

  // ----- Placement validation -----
  // Valid: defense-zone path cell not already occupied by a barricade.
  function isValid(gx, gy) {
    const cell = Map.getCell(gx, gy);
    if (!cell) return false;
    if (!Map.isDefenseZone(gx)) return false;
    if (cell.state !== 'path') return false;
    return !barricades.some(b => b.gx === gx && b.gy === gy);
  }

  // place(gx, gy) — deduct resources and add barricade.
  // Returns: 'ok' | 'invalid' | 'insufficient'
  function place(gx, gy) {
    if (!isValid(gx, gy)) return 'invalid';
    if (!Resources.canAfford(DEF.cost)) return 'insufficient';
    Resources.spendResources(DEF.cost);
    barricades.push(new Barricade(gx, gy));
    return 'ok';
  }

  // getSpeedMultiplier(x, y) — returns < 1 if the pixel position is within
  // range of any living barricade; called each frame from Enemy.updatePosition.
  function getSpeedMultiplier(x, y) {
    for (const b of barricades) {
      if (b.dead) continue;
      const dx = x - b.cx, dy = y - b.cy;
      if (dx * dx + dy * dy <= DEF.slowRadius * DEF.slowRadius) {
        return DEF.slowFactor;
      }
    }
    return 1;
  }

  // update(dt) — enemies in contact deal damage to barricades;
  // destroyed barricades are removed from the list.
  function update(dt) {
    const enemies = Enemies.getAll();
    for (const b of barricades) {
      if (b.dead) continue;
      for (const e of enemies) {
        if (e.dead || e.reached) continue;
        const pos = e.getPosition();
        const dx  = pos.x - b.cx, dy = pos.y - b.cy;
        if (dx * dx + dy * dy <= DEF.slowRadius * DEF.slowRadius) {
          b.takeDamage(DEF.damagePerSec * (dt / 1000));
        }
      }
    }
    barricades = barricades.filter(b => !b.dead);
  }

  function getAll()       { return barricades; }
  function getAt(gx, gy) { return barricades.find(b => b.gx === gx && b.gy === gy) ?? null; }
  function remove(b)      { barricades = barricades.filter(x => x !== b); }
  function clear()        { barricades = []; }

  return { DEF, isValid, place, getSpeedMultiplier, update, getAll, getAt, remove, clear };
})();
