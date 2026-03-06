/* ============================================================
   ui.js — HUD rendering, phase controls, build mode
   ============================================================ */

const UI = (() => {
  let eraWaveEl    = null;
  let startWaveBtn = null;

  // Town health bar elements
  let townHealthFill = null;
  let townHealthText = null;

  // Prep-only stub buttons
  let townButtons = null;

  // Build mode elements
  let buildModeBtn  = null;
  let towerSelector = null;

  // Resource display
  let resourcesEl = null;

  // Population counter
  let populationEl = null;

  // Tower selection panel
  let selectedTower = null;
  let towerPanelEl  = null;

  // Barricade selection panel
  let selectedBarricade = null;
  let barricadePanelEl  = null;

  // Build mode state
  let buildMode    = false;
  let selectedType = 'club';  // default selected tower
  let hoverCell    = null;    // { gx, gy } | null
  let canvasEl     = null;

  // ----- Init -----
  function init() {
    const hud = document.getElementById('hud');
    canvasEl  = document.getElementById('game-canvas');

    // ── Town health bar (top center, prominent) ──────────────────────────
    const healthWidget = document.createElement('div');
    healthWidget.id = 'hud-town-health';

    const healthLabel = document.createElement('div');
    healthLabel.id = 'hud-town-health-label';
    healthLabel.textContent = 'Town';

    const track = document.createElement('div');
    track.id = 'hud-town-health-track';

    townHealthFill = document.createElement('div');
    townHealthFill.id = 'hud-town-health-fill';

    townHealthText = document.createElement('div');
    townHealthText.id = 'hud-town-health-text';

    track.appendChild(townHealthFill);
    track.appendChild(townHealthText);
    healthWidget.appendChild(healthLabel);
    healthWidget.appendChild(track);
    hud.appendChild(healthWidget);

    // ── Era / wave label (top left) ──────────────────────────────────────
    eraWaveEl = document.createElement('div');
    eraWaveEl.id = 'hud-era-wave';
    hud.appendChild(eraWaveEl);

    // ── Resource display (top right) ─────────────────────────────────────
    resourcesEl = document.createElement('div');
    resourcesEl.id = 'hud-resources';
    hud.appendChild(resourcesEl);

    // ── Population counter (top left, below era/wave) ─────────────────────
    populationEl = document.createElement('div');
    populationEl.id = 'hud-population';
    hud.appendChild(populationEl);

    // ── Stub upgrade/repair buttons (prep phase only, top center below bar) ──
    townButtons = document.createElement('div');
    townButtons.id = 'hud-town-buttons';

    const upgradeBtn = document.createElement('button');
    upgradeBtn.className = 'hud-town-btn';
    upgradeBtn.textContent = 'Upgrade Town';
    upgradeBtn.disabled = true; // stub — no function yet

    const repairBtn = document.createElement('button');
    repairBtn.className = 'hud-town-btn';
    repairBtn.textContent = 'Repair Town';
    repairBtn.disabled = true; // stub — no function yet

    townButtons.appendChild(upgradeBtn);
    townButtons.appendChild(repairBtn);
    hud.appendChild(townButtons);

    // ── Build Mode toggle button (prep phase only) ────────────────────────
    buildModeBtn = document.createElement('button');
    buildModeBtn.id = 'hud-build-mode-btn';
    buildModeBtn.textContent = 'Build Mode';
    buildModeBtn.addEventListener('click', onToggleBuildMode);
    hud.appendChild(buildModeBtn);

    // ── Tower type selector (visible only when build mode is active) ──────
    towerSelector = document.createElement('div');
    towerSelector.id = 'hud-tower-selector';

    // Labels include cost hint: B=Bone, W=Wood
    const towerTypes = [
      { type: 'club',        label: 'Club (5B 3W)'        },
      { type: 'rockThrower', label: 'Rock (8B 5W)'        },
      { type: 'spear',       label: 'Spear (10B 8W)'      },
      { type: 'barricade',   label: 'Barricade (3B 4W)'   },
    ];
    for (const { type, label } of towerTypes) {
      const btn = document.createElement('button');
      btn.className = 'hud-tower-type-btn';
      btn.dataset.towerType = type;
      btn.textContent = label;
      btn.addEventListener('click', () => { selectedType = type; _refreshTowerSelector(); });
      towerSelector.appendChild(btn);
    }
    hud.appendChild(towerSelector);

    // ── Start Wave button (bottom right) ────────────────────────────────
    startWaveBtn = document.createElement('button');
    startWaveBtn.id = 'hud-start-wave';
    startWaveBtn.textContent = 'Start Wave';
    startWaveBtn.disabled = true;
    startWaveBtn.addEventListener('click', onStartWave);
    hud.appendChild(startWaveBtn);

    // ── Canvas listeners for build mode ─────────────────────────────────
    canvasEl.addEventListener('mousemove', onCanvasMouseMove);
    canvasEl.addEventListener('mouseleave', () => { hoverCell = null; });
    canvasEl.addEventListener('click', onCanvasClick);

    update(state);
  }

  // ----- Button handlers -----

  function onStartWave() {
    if (state.phase !== 'prep') return;
    // Leaving prep — disable build mode
    buildMode = false;
    state.phase = 'wave';
    Waves.startWave(state.currentEra, state.currentWave);
    update(state);
  }

  function onToggleBuildMode() {
    buildMode = !buildMode;
    if (!buildMode) hoverCell = null;
    if (buildMode) { _closeTowerPanel(); _closeBarricadePanel(); }
    _refreshBuildModeBtn();
    _refreshTowerSelector();
  }

  // ----- Canvas event handlers -----

  function _canvasCoords(e) {
    const rect   = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width  / rect.width;
    const scaleY = canvasEl.height / rect.height;
    return {
      cx: (e.clientX - rect.left) * scaleX,
      cy: (e.clientY - rect.top)  * scaleY,
    };
  }

  function onCanvasMouseMove(e) {
    if (!buildMode || state.phase !== 'prep') { hoverCell = null; return; }
    const { cx, cy } = _canvasCoords(e);
    const gx = Math.floor(cx / Map.CELL);
    const gy = Math.floor(cy / Map.CELL);
    if (gx < 0 || gx >= Map.COLS || gy < 0 || gy >= Map.ROWS) {
      hoverCell = null;
    } else {
      hoverCell = { gx, gy };
    }
  }

  function onCanvasClick(e) {
    const { cx, cy } = _canvasCoords(e);
    const gx = Math.floor(cx / Map.CELL);
    const gy = Math.floor(cy / Map.CELL);

    // Build mode: place a tower or barricade (prep only)
    if (buildMode && state.phase === 'prep') {
      let result;
      if (selectedType === 'barricade') {
        result = Barricades.place(gx, gy);
      } else {
        result = Towers.place(selectedType, gx, gy);
      }
      if (result === 'insufficient') _flashResourceError();
      return;
    }

    // Non-build mode: select tower, barricade, or deselect
    const tower = Towers.getAt(gx, gy);
    if (tower) {
      _closeBarricadePanel();
      _openTowerPanel(tower);
      return;
    }
    const barricade = Barricades.getAt(gx, gy);
    if (barricade) {
      _closeTowerPanel();
      _openBarricadePanel(barricade);
      return;
    }
    _closeTowerPanel();
    _closeBarricadePanel();
  }

  // ----- renderHUD -----
  // Called every frame — keeps health bar, resource display, and population in sync.
  function renderHUD() {
    _updateHealthBar();
    _updateResourceDisplay();
    _updatePopulationDisplay();
  }

  // ----- renderStartWaveButton -----
  function renderStartWaveButton() {
    if (!startWaveBtn) return;
    startWaveBtn.style.display = (state.phase === 'prep') ? '' : 'none';
  }

  // ----- update -----
  // Syncs all HUD elements to the given state snapshot.
  function update(s) {
    if (eraWaveEl) {
      eraWaveEl.textContent = `Era ${s.currentEra} \u2014 Wave ${s.currentWave}`;
    }
    const isPrep = s.phase === 'prep';
    if (townButtons) {
      townButtons.style.display = isPrep ? '' : 'none';
    }
    if (buildModeBtn) {
      buildModeBtn.style.display = isPrep ? '' : 'none';
    }
    if (!isPrep) {
      buildMode = false;
      hoverCell = null;
    }
    _refreshBuildModeBtn();
    _refreshTowerSelector();
    renderStartWaveButton();
    _updateHealthBar();
    _updateResourceDisplay();
  }

  // ----- enableStartButton -----
  function enableStartButton() {
    if (startWaveBtn) startWaveBtn.disabled = false;
  }

  // ----- getBuildState -----
  // Used by Renderer to draw hover highlights.
  function getBuildState() {
    return { buildMode, hoverCell, selectedType };
  }

  // ----- Internal -----

  function _refreshBuildModeBtn() {
    if (!buildModeBtn) return;
    buildModeBtn.classList.toggle('active', buildMode);
  }

  function _refreshTowerSelector() {
    if (!towerSelector) return;
    towerSelector.style.display = buildMode ? '' : 'none';
    for (const btn of towerSelector.querySelectorAll('.hud-tower-type-btn')) {
      btn.classList.toggle('active', btn.dataset.towerType === selectedType);
    }
  }

  function _updateHealthBar() {
    if (!townHealthFill || !townHealthText) return;
    const hp    = Town.getHealth();
    const maxHp = Town.getMaxHealth();
    const pct   = maxHp > 0 ? hp / maxHp : 0;

    townHealthFill.style.width = `${(pct * 100).toFixed(1)}%`;
    townHealthText.textContent = `${hp} / ${maxHp}`;

    // Colour: green → yellow → red
    if (pct > 0.6) {
      townHealthFill.style.backgroundColor = '#3fa025';
    } else if (pct > 0.3) {
      townHealthFill.style.backgroundColor = '#c0900a';
    } else {
      townHealthFill.style.backgroundColor = '#c02020';
    }
  }

  // Rebuilds the resource counter text every frame (small string, negligible cost).
  function _updateResourceDisplay() {
    if (!resourcesEl) return;
    const g = Resources.getGold();
    const s = Resources.getStockpile();
    const LABELS = {
      bone:'Bone', wood:'Wood', stone:'Stone', iron:'Iron',
      timber:'Timber', gunpowder:'Powder', steel:'Steel',
      oil:'Oil', alloy:'Alloy', plasma:'Plasma',
    };
    let text = `Gold: ${g}`;
    for (const [key, label] of Object.entries(LABELS)) {
      text += `\n${label}: ${s[key]}`;
    }
    resourcesEl.textContent = text;
  }

  function _updatePopulationDisplay() {
    if (!populationEl) return;
    const unassigned = People.getUnassigned();
    const total      = People.getTotalPeople();
    populationEl.textContent = `People: ${unassigned} / ${total}`;
  }

  // ----- Tower selection panel -----

  function _openTowerPanel(tower) {
    selectedTower = tower;
    _buildTowerPanel(tower);
  }

  function _closeTowerPanel() {
    if (towerPanelEl) { towerPanelEl.remove(); towerPanelEl = null; }
    selectedTower = null;
  }

  function _buildTowerPanel(tower) {
    _closeTowerPanel();

    towerPanelEl = document.createElement('div');
    towerPanelEl.id = 'overlay-tower-panel';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', _closeTowerPanel);
    towerPanelEl.appendChild(closeBtn);

    // Title
    const title = document.createElement('div');
    title.className = 'overlay-title';
    title.textContent = `${tower.label}  \u2014  Era ${Towers.DEFS[tower.type].era}`;
    towerPanelEl.appendChild(title);

    // Staffing row: [ − ] X / Y [ + ]
    const staffRow = document.createElement('div');
    staffRow.className = 'tower-panel-staff-row';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'tower-panel-staff-btn';
    minusBtn.textContent = '\u2212';

    const staffLabel = document.createElement('span');
    staffLabel.className = 'tower-panel-staff-label';

    const plusBtn = document.createElement('button');
    plusBtn.className = 'tower-panel-staff-btn';
    plusBtn.textContent = '+';

    function refreshStaff() {
      const assigned = People.getAssigned(tower.id);
      const required = tower.peopleRequired;
      staffLabel.textContent = `${assigned} / ${required} people`;
      minusBtn.disabled = assigned <= 0;
      plusBtn.disabled  = People.getUnassigned() <= 0;
    }
    refreshStaff();

    minusBtn.addEventListener('click', () => {
      People.removeFromTower(tower.id);
      refreshStaff();
    });

    plusBtn.addEventListener('click', () => {
      People.assignToTower(tower.id);
      refreshStaff();
    });

    staffRow.append(minusBtn, staffLabel, plusBtn);
    towerPanelEl.appendChild(staffRow);

    // Effective damage display
    const dmgEl = document.createElement('div');
    dmgEl.className = 'tower-panel-damage';
    const ratio = tower.staffingRatio;
    const effectiveDmg = (tower.damage * ratio).toFixed(0);
    dmgEl.textContent = ratio < 1
      ? `Damage: ${effectiveDmg} (${Math.round(ratio * 100)}% staffed)`
      : `Damage: ${effectiveDmg}`;
    towerPanelEl.appendChild(dmgEl);

    // Demolish button
    const demolishBtn = document.createElement('button');
    demolishBtn.className = 'tower-panel-demolish-btn';
    demolishBtn.textContent = 'Demolish';
    demolishBtn.addEventListener('click', () => {
      Towers.demolish(tower);
      _closeTowerPanel();
    });
    towerPanelEl.appendChild(demolishBtn);

    document.getElementById('hud').appendChild(towerPanelEl);
  }

  // ----- Barricade selection panel -----

  function _openBarricadePanel(barricade) {
    selectedBarricade = barricade;
    _buildBarricadePanel(barricade);
  }

  function _closeBarricadePanel() {
    if (barricadePanelEl) { barricadePanelEl.remove(); barricadePanelEl = null; }
    selectedBarricade = null;
  }

  function _buildBarricadePanel(barricade) {
    _closeBarricadePanel();

    barricadePanelEl = document.createElement('div');
    barricadePanelEl.id = 'overlay-barricade-panel';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'overlay-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', _closeBarricadePanel);
    barricadePanelEl.appendChild(closeBtn);

    // Title
    const title = document.createElement('div');
    title.className = 'overlay-title';
    title.textContent = 'Barricade';
    barricadePanelEl.appendChild(title);

    // HP display
    const hpEl = document.createElement('div');
    hpEl.className = 'barricade-panel-hp';
    hpEl.textContent = `HP: ${Math.ceil(barricade.hp)} / ${barricade.maxHp}`;
    barricadePanelEl.appendChild(hpEl);

    // HP bar
    const hpTrack = document.createElement('div');
    hpTrack.className = 'barricade-panel-hp-track';
    const hpFill = document.createElement('div');
    hpFill.className = 'barricade-panel-hp-fill';
    hpFill.style.width = `${(barricade.hp / barricade.maxHp) * 100}%`;
    hpTrack.appendChild(hpFill);
    barricadePanelEl.appendChild(hpTrack);

    // Slow info
    const slowEl = document.createElement('div');
    slowEl.className = 'barricade-panel-info';
    slowEl.textContent = `Slows enemies to ${Math.round(Barricades.DEF.slowFactor * 100)}% speed`;
    barricadePanelEl.appendChild(slowEl);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'tower-panel-demolish-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      Barricades.remove(barricade);
      _closeBarricadePanel();
    });
    barricadePanelEl.appendChild(removeBtn);

    document.getElementById('hud').appendChild(barricadePanelEl);
  }

  // Triggers a brief red flash on the resource display when placement is blocked.
  function _flashResourceError() {
    if (!resourcesEl) return;
    resourcesEl.classList.remove('flash');
    void resourcesEl.offsetWidth; // force reflow to restart animation
    resourcesEl.classList.add('flash');
    resourcesEl.addEventListener('animationend', () => {
      resourcesEl.classList.remove('flash');
    }, { once: true });
  }

  return { init, renderHUD, renderStartWaveButton, update, enableStartButton, getBuildState };
})();
