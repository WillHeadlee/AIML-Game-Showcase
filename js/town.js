/* ============================================================
   town.js — Town health, damage, game-over trigger
   ============================================================ */

const Town = (() => {

  // Base health values per era (from design doc)
  const BASE_HEALTH = { 1: 500, 2: 750, 3: 1000, 4: 1400, 5: 2000 };

  let maxHealth = BASE_HEALTH[1];
  let health    = BASE_HEALTH[1];

  // ----- Public API -----

  // init(era) — set up health for the given era (call on game start).
  function init(era) {
    reset(era);
  }

  // takeDamage(n) — reduce health; emit 'game:over' if depleted.
  function takeDamage(n) {
    if (health <= 0) return;
    health = Math.max(0, health - n);
    if (health === 0) {
      Events.emit('game:over', {});
    }
  }

  // isDestroyed() — true when health has reached zero.
  function isDestroyed() {
    return health <= 0;
  }

  // reset(era) — restore full health for the given era (called on era advance).
  function reset(era) {
    maxHealth = BASE_HEALTH[era] ?? BASE_HEALTH[1];
    health    = maxHealth;
  }

  function getHealth()    { return health; }
  function getMaxHealth() { return maxHealth; }

  return { init, takeDamage, isDestroyed, reset, getHealth, getMaxHealth };
})();
