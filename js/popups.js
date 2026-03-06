/* ============================================================
   popups.js — People arrival popup, era advancement overlay
   ============================================================ */

// ----- People Arrival Popup -----
const PeopleArrivalPopup = (() => {

  // Arrival count range per era (from design doc).
  const ERA_ARRIVAL_RANGE = {
    1: [2, 4],
    2: [3, 6],
    3: [4, 7],
    4: [5, 9],
    5: [7, 12],
  };

  let popupEl        = null;
  let onDoneCallback = null;

  // show(era, onDone) — generates a random arrival count and displays the popup.
  // onDone is called when the player clicks Done.
  function show(era, onDone) {
    onDoneCallback = onDone;
    const [lo, hi] = ERA_ARRIVAL_RANGE[era] ?? [2, 4];
    const arrivalCount = lo + Math.floor(Math.random() * (hi - lo + 1));
    _buildPopup(arrivalCount);
  }

  // ----- _buildPopup -----
  function _buildPopup(arrivalCount) {
    if (popupEl) popupEl.remove();

    popupEl = document.createElement('div');
    popupEl.id = 'popup-arrival';

    // Header
    const header = document.createElement('div');
    header.className = 'popup-title';
    const noun = arrivalCount === 1 ? 'person wants' : 'people want';
    header.textContent = `New Arrivals \u2014 ${arrivalCount} ${noun} to join your Town`;
    popupEl.appendChild(header);

    // Housing info line (refreshed after each decision)
    const housingInfo = document.createElement('div');
    housingInfo.className = 'popup-housing-info';
    _refreshHousingInfo(housingInfo);
    popupEl.appendChild(housingInfo);

    // Person list
    const listEl = document.createElement('div');
    listEl.className = 'popup-person-list';

    // Done button — created early so onRowResolved can reference it
    const doneBtn = document.createElement('button');
    doneBtn.className = 'popup-btn popup-btn-done';
    doneBtn.textContent = 'Done';
    doneBtn.disabled = true;
    doneBtn.addEventListener('click', _onDone);

    let pendingCount = arrivalCount;

    function onRowResolved() {
      pendingCount--;
      _refreshHousingInfo(housingInfo);
      _refreshAcceptButtons(listEl);
      // Enable Done when all rows resolved OR housing is full (remaining can't be accepted)
      if (pendingCount === 0 || !People.canAccept()) {
        doneBtn.disabled = false;
      }
    }

    for (let i = 0; i < arrivalCount; i++) {
      const row = document.createElement('div');
      row.className = 'popup-person-row';

      const icon = document.createElement('span');
      icon.className = 'popup-person-icon';
      icon.textContent = '\u{1F464}';

      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'popup-btn popup-btn-accept';
      acceptBtn.textContent = 'Accept';

      const rejectBtn = document.createElement('button');
      rejectBtn.className = 'popup-btn popup-btn-reject';
      rejectBtn.textContent = 'Turn Away';

      const statusEl = document.createElement('span');
      statusEl.className = 'popup-person-status';

      acceptBtn.addEventListener('click', () => {
        if (!People.canAccept()) return;
        People.acceptPerson();
        statusEl.textContent = 'Accepted';
        statusEl.className = 'popup-person-status status-accepted';
        acceptBtn.disabled = true;
        rejectBtn.disabled = true;
        onRowResolved();
      });

      rejectBtn.addEventListener('click', () => {
        statusEl.textContent = 'Turned Away';
        statusEl.className = 'popup-person-status status-rejected';
        acceptBtn.disabled = true;
        rejectBtn.disabled = true;
        onRowResolved();
      });

      row.append(icon, acceptBtn, rejectBtn, statusEl);
      listEl.appendChild(row);
    }

    popupEl.appendChild(listEl);
    popupEl.appendChild(doneBtn);

    document.getElementById('hud').appendChild(popupEl);

    // Initial state — if housing is already full, enable Done immediately
    _refreshAcceptButtons(listEl);
    if (!People.canAccept()) doneBtn.disabled = false;
  }

  // ----- Helpers -----

  function _refreshHousingInfo(el) {
    const used  = People.getTotalPeople();
    const cap   = People.getTotalCapacity();
    const avail = Math.max(0, cap - used);
    el.textContent =
      `Housing: ${used} / ${cap}  \u00b7  ${avail} slot${avail === 1 ? '' : 's'} available`;
  }

  // Disable all undecided Accept buttons when housing is full.
  function _refreshAcceptButtons(listEl) {
    const canStill = People.canAccept();
    for (const row of listEl.querySelectorAll('.popup-person-row')) {
      const btn = row.querySelector('.popup-btn-accept');
      if (btn && !btn.disabled) {
        btn.disabled = !canStill;
        btn.title    = canStill ? '' : 'Build more housing';
      }
    }
  }

  function _onDone() {
    if (popupEl) { popupEl.remove(); popupEl = null; }
    if (onDoneCallback) { onDoneCallback(); onDoneCallback = null; }
  }

  return { show };
})();
