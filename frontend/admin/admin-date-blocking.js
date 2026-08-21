(() => {
  const API = '/api/settings';
  const loadState = {
    unit: { inFlight: null },
    parking: { inFlight: null }
  };
  let initialRefreshDone = false;

  const token = () => sessionStorage.getItem('caSmartAdminToken') || localStorage.getItem('caSmartAdminToken') || '';
  const authHeaders = (json = false) => {
    const headers = { Authorization: `Bearer ${token()}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  };

  function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value || '');
    const [y, m, d] = String(value).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function setStatus(kind, message, good = false) {
    const el = document.getElementById(kind === 'parking' ? 'adminParkingDateBlockStatus' : 'adminDateBlockStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = good ? '#276749' : '#66736e';
  }

  function addStyles() {
    if (document.getElementById('adminDateBlockingStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminDateBlockingStyles';
    style.textContent = `
      .admin-date-blocking-section{margin-top:22px;padding-top:20px;border-top:1px solid #d7e1dc}
      .admin-date-blocking-section h3{margin:0 0 5px;color:#173f35}
      .admin-date-blocking-section>p{margin:0 0 14px;color:#66736e;font-size:13px}
      .admin-date-block-form{display:grid;grid-template-columns:minmax(170px,1fr) minmax(170px,1fr) auto;gap:10px;align-items:end}
      .admin-date-block-form label{display:block;font-weight:700;color:#173f35;font-size:13px}
      .admin-date-block-form input,.admin-date-block-form select{display:block;width:100%;height:42px;box-sizing:border-box;margin-top:7px;padding:9px 11px;border:1px solid #cbd7d1;border-radius:7px;background:#fff;font:inherit}
      .admin-date-block-form button{height:42px;padding:0 18px;border:0;border-radius:7px;background:#173f35;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap}
      .admin-date-block-form button:disabled{opacity:.6;cursor:wait}
      .admin-date-block-list{margin-top:16px;border-top:1px solid #e3e9e6}
      .admin-date-block-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #e3e9e6}
      .admin-date-block-row strong{display:block;color:#173f35;font-size:13px}
      .admin-date-block-row span{display:block;margin-top:3px;color:#66736e;font-size:12px}
      .admin-date-unblock{height:34px;padding:0 12px;border:1px solid #d9b1ad;border-radius:6px;background:#fff;color:#a1261f;font-weight:700;cursor:pointer}
      #adminDateBlockStatus,#adminParkingDateBlockStatus{min-height:20px;margin-top:10px;font-size:13px}
      @media(max-width:700px){.admin-date-block-form{grid-template-columns:1fr}.admin-date-block-form button{width:100%}.admin-date-block-row{align-items:flex-start;flex-direction:column}.admin-date-unblock{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function sectionMarkup(kind) {
    const parking = kind === 'parking';
    const prefix = parking ? 'adminParking' : 'admin';
    const reasons = parking
      ? '<option>Maintenance</option><option>Repair</option><option>Owner Use</option><option>Other</option>'
      : '<option>Maintenance</option><option>Cleaning</option><option>Repair</option><option>Owner Use</option><option>Other</option>';
    return `
      <p class="eyebrow" style="margin:0 0 4px">${parking ? 'PARKING AVAILABILITY' : 'UNIT AVAILABILITY'}</p>
      <h3>${parking ? 'Parking Date Blocking' : 'Unit Date Blocking'}</h3>
      <p>${parking
        ? 'Block a date when the parking is unavailable for maintenance, repairs, owner use, or another reason. Accommodation-only bookings remain available.'
        : 'Block a date when the accommodation is unavailable for maintenance, cleaning, repairs, owner use, or another reason. Parking-only bookings remain available.'}</p>
      <div class="admin-date-block-form">
        <label>Blocked Date<input id="${prefix}BlockedDate" type="date" min="${localToday()}"></label>
        <label>Reason<select id="${prefix}BlockedReason">${reasons}</select></label>
        <button id="${prefix}BlockDateBtn" type="button">Block Date</button>
      </div>
      <div id="${prefix}DateBlockStatus" aria-live="polite"></div>
      <div id="${prefix}DateBlockList" class="admin-date-block-list"><p style="color:#66736e;font-size:13px">Loading blocked dates...</p></div>
    `;
  }

  function mount() {
    const panel = document.querySelector('.admin-email-settings');
    if (!panel) return false;
    addStyles();
    let created = false;

    if (!document.getElementById('adminDateBlocking')) {
      const unitSection = document.createElement('div');
      unitSection.id = 'adminDateBlocking';
      unitSection.className = 'admin-date-blocking-section';
      unitSection.innerHTML = sectionMarkup('unit');
      panel.appendChild(unitSection);
      document.getElementById('adminBlockDateBtn')?.addEventListener('click', () => blockDate('unit'));
      created = true;
    }

    if (!document.getElementById('adminParkingDateBlocking')) {
      const parkingSection = document.createElement('div');
      parkingSection.id = 'adminParkingDateBlocking';
      parkingSection.className = 'admin-date-blocking-section';
      parkingSection.innerHTML = sectionMarkup('parking');
      panel.appendChild(parkingSection);
      document.getElementById('adminParkingBlockDateBtn')?.addEventListener('click', () => blockDate('parking'));
      created = true;
    }

    return created;
  }

  function config(kind) {
    const parking = kind === 'parking';
    return {
      endpoint: parking ? 'admin-parking-blocked-dates' : 'admin-blocked-dates',
      dateId: parking ? 'adminParkingBlockedDate' : 'adminBlockedDate',
      reasonId: parking ? 'adminParkingBlockedReason' : 'adminBlockedReason',
      buttonId: parking ? 'adminParkingBlockDateBtn' : 'adminBlockDateBtn',
      listId: parking ? 'adminParkingDateBlockList' : 'adminDateBlockList',
      empty: parking ? 'No parking dates are currently blocked.' : 'No dates are currently blocked.'
    };
  }

  function renderList(kind, items) {
    const c = config(kind);
    const list = document.getElementById(c.listId);
    if (!list) return;
    const html = items.length ? items.map(item => `
      <div class="admin-date-block-row">
        <div><strong>${formatDate(item.date)}</strong><span>${item.reason || 'Maintenance'}</span></div>
        <button class="admin-date-unblock" type="button" data-date="${item.date}">Unblock</button>
      </div>
    `).join('') : `<p style="color:#66736e;font-size:13px;padding:10px 0">${c.empty}</p>`;

    if (list.innerHTML !== html) list.innerHTML = html;
    list.querySelectorAll('button[data-date]').forEach(button => {
      if (button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => unblockDate(kind, button.dataset.date));
    });
  }

  function loadBlockedDates(kind) {
    const c = config(kind);
    const list = document.getElementById(c.listId);
    if (!list || !token()) return Promise.resolve();
    if (loadState[kind].inFlight) return loadState[kind].inFlight;

    loadState[kind].inFlight = (async () => {
      try {
        const response = await fetch(`${API}/${c.endpoint}`, { headers: authHeaders(), cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Unable to load blocked dates.');
        renderList(kind, Array.isArray(payload.data) ? payload.data : []);
      } catch (error) {
        const currentList = document.getElementById(c.listId);
        if (currentList) currentList.innerHTML = `<p style="color:#a1261f;font-size:13px">${error.message}</p>`;
      } finally {
        loadState[kind].inFlight = null;
      }
    })();

    return loadState[kind].inFlight;
  }

  function refreshAll() {
    return Promise.all([loadBlockedDates('unit'), loadBlockedDates('parking')]);
  }

  function mountAndRefreshIfNeeded() {
    const created = mount();
    if (created || !initialRefreshDone) {
      initialRefreshDone = true;
      refreshAll();
    }
  }

  async function blockDate(kind) {
    const c = config(kind);
    const dateInput = document.getElementById(c.dateId);
    const reasonInput = document.getElementById(c.reasonId);
    const button = document.getElementById(c.buttonId);
    const date = dateInput?.value || '';

    if (!date) {
      setStatus(kind, 'Please select a date to block.');
      dateInput?.focus();
      return;
    }

    if (button) button.disabled = true;
    setStatus(kind, 'Blocking date...');

    try {
      const response = await fetch(`${API}/${c.endpoint}`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ date, reason: reasonInput?.value || 'Maintenance' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to block this date.');
      setStatus(kind, payload.message || 'Date blocked.', true);
      if (dateInput) dateInput.value = '';
      await loadBlockedDates(kind);
    } catch (error) {
      setStatus(kind, error.message);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function unblockDate(kind, date) {
    if (!date) return;
    const c = config(kind);
    try {
      const response = await fetch(`${API}/${c.endpoint}/${encodeURIComponent(date)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to unblock this date.');
      setStatus(kind, payload.message || 'Date unblocked.', true);
      await loadBlockedDates(kind);
    } catch (error) {
      setStatus(kind, error.message);
    }
  }

  function boot() {
    mountAndRefreshIfNeeded();
    setTimeout(mountAndRefreshIfNeeded, 300);
    setTimeout(mountAndRefreshIfNeeded, 1000);
    setTimeout(mountAndRefreshIfNeeded, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.addEventListener('admin-tab-changed', event => {
    if (event.detail?.key === 'email') mountAndRefreshIfNeeded();
  });
})();
