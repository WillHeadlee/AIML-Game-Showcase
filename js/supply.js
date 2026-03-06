/* ============================================================
   supply.js — Supply network: connections, priority distribution
   ============================================================ */

// Supply is only active from Era 3. In Eras 1–2, no production is registered
// so getTotalProduction() returns 0 and all supplyHealth stays at 0.
// Step 15 will apply supply multipliers to tower stats (Era 3+ only).

const Supply = (() => {

  const PRIORITIES = ['low', 'medium', 'high'];

  // Map(towerId → { priority: 'low'|'medium'|'high', supplyHealth: 0–1 })
  const connections = new Map();

  // Combined supply production (units per second) — added by operational buildings.
  // Era 1–2: always 0.  Era 3+ buildings call Supply.addProduction().
  let totalProductionRate = 0;

  // ----- Connection management -----

  // connect(towerId) — add a supply line from Town Hall to this tower.
  // Default priority is 'medium'; does nothing if already connected.
  function connect(towerId, priority = 'medium') {
    if (!connections.has(towerId)) {
      connections.set(towerId, { priority, supplyHealth: 0 });
    }
  }

  // disconnect(towerId) — sever the supply line to this tower.
  function disconnect(towerId) {
    connections.delete(towerId);
  }

  // cyclePriority(towerId) — Low → Medium → High → Low
  function cyclePriority(towerId) {
    const c = connections.get(towerId);
    if (!c) return;
    const i = PRIORITIES.indexOf(c.priority);
    c.priority = PRIORITIES[(i + 1) % PRIORITIES.length];
  }

  function getConnection(towerId) {
    return connections.get(towerId) ?? null;
  }

  function getAllConnections() { return connections; }

  // ----- Production -----

  // addProduction(unitsPerSec) — called once per operational-resource building bought.
  function addProduction(unitsPerSec) {
    totalProductionRate += unitsPerSec;
  }

  function getTotalProduction() { return totalProductionRate; }

  // getTotalDraw() — each connected tower draws 1 supply unit per second.
  function getTotalDraw() { return connections.size; }

  // ----- Per-tick distribution -----
  // Satisfies High-priority towers first, then Medium, then Low.
  // Within each tier, supply is split proportionally when over capacity.
  function update() {
    if (connections.size === 0) return;

    // Group by priority
    const byPriority = { high: [], medium: [], low: [] };
    for (const [id, c] of connections) {
      byPriority[c.priority].push([id, c]);
    }

    let remaining = totalProductionRate;

    for (const tier of ['high', 'medium', 'low']) {
      const group = byPriority[tier];
      if (group.length === 0) continue;

      if (remaining >= group.length) {
        // Fully satisfy this tier
        for (const [, c] of group) c.supplyHealth = 1;
        remaining -= group.length;
      } else {
        // Proportional split within this tier
        const each = group.length > 0 ? remaining / group.length : 0;
        for (const [, c] of group) c.supplyHealth = each;
        remaining = 0;
      }
    }
  }

  return {
    PRIORITIES,
    connect, disconnect, cyclePriority,
    getConnection, getAllConnections,
    addProduction, getTotalProduction, getTotalDraw,
    update,
  };
})();
