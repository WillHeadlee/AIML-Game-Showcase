/* ============================================================
   map.js — Grid data model, zone constants, coordinate helpers
   ============================================================ */

const Map = (() => {
  // ----- Constants -----
  const COLS = 96;
  const ROWS = 54;
  const CELL = 20; // px per cell

  // Defense zone: cols 0-47  (pixels 0–959)
  // Settlement zone: cols 48-95 (pixels 960–1919)
  const WALL_COL = 48;

  const DEFENSE_ZONE    = { minCol: 0,        maxCol: WALL_COL - 1 };
  const SETTLEMENT_ZONE = { minCol: WALL_COL,  maxCol: COLS - 1 };

  // ----- Coordinate helpers -----
  // gridToPixel returns the CENTER of the cell in canvas pixels.
  //   gridToPixel(0,0)   → {x:10,  y:10}
  //   gridToPixel(95,53) → {x:1910, y:1070}
  function gridToPixel(gx, gy) {
    return { x: CELL / 2 + gx * CELL, y: CELL / 2 + gy * CELL };
  }

  function pixelToGrid(px, py) {
    return {
      x: Math.floor((px - CELL / 2) / CELL),
      y: Math.floor((py - CELL / 2) / CELL),
    };
  }

  // ----- Grid build -----
  // Each cell: { state: 'open' | 'path' | 'wall' | 'blocked' }
  const grid = [];
  for (let gy = 0; gy < ROWS; gy++) {
    grid[gy] = [];
    for (let gx = 0; gx < COLS; gx++) {
      // Defense zone: 'open'; wall column: 'wall'; settlement zone: 'blocked'
      let state;
      if      (gx < WALL_COL) state = 'open';
      else if (gx === WALL_COL) state = 'wall';
      else                    state = 'blocked';
      grid[gy][gx] = { state };
    }
  }

  // ----- Accessors -----
  function getCell(gx, gy) {
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return null;
    return grid[gy][gx];
  }

  function setCell(gx, gy, state) {
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
    grid[gy][gx].state = state;
  }

  function isDefenseZone(gx) { return gx >= DEFENSE_ZONE.minCol && gx <= DEFENSE_ZONE.maxCol; }
  function isSettlementZone(gx) { return gx >= SETTLEMENT_ZONE.minCol && gx <= SETTLEMENT_ZONE.maxCol; }

  // isAdjacentToPath(gx, gy) — true if any of the 4 cardinal neighbors is a path cell.
  function isAdjacentToPath(gx, gy) {
    const neighbors = [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]];
    return neighbors.some(([nx, ny]) => {
      const c = getCell(nx, ny);
      return c && c.state === 'path';
    });
  }

  return {
    COLS, ROWS, CELL, WALL_COL,
    DEFENSE_ZONE, SETTLEMENT_ZONE,
    grid,
    gridToPixel, pixelToGrid,
    getCell, setCell,
    isDefenseZone, isSettlementZone, isAdjacentToPath,
  };
})();
