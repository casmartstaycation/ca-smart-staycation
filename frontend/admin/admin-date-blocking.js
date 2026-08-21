(() => {
  const API = '/api/settings';
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

  function setStatus(message, good = false) {
    const el = document.getElementById('adminDateBlockStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = good ? '#276749' : '#66736e';
  }

  function addStyles() {
    if (document.getElementById('adminDateBlockingStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminDateBlockingStyles';
    style.textContent = `
      #adminDateBlocking{margin-top:22px;padding-top:20px;border-top:1px solid #d7e1dc}
      #adminDateBlocking h3{margin:0 0 5px;color:#173f35}
      #adminDateBlocking>p{margin:0 0 14px;color:#66736e;font-size:13px}
      .admin-date-block-form{display:grid;grid-template-columns:minmax(170px,1fr) minmax(170px,1fr) auto;gap:10px;align-items:end}
      .admin-date-block-form label{display:block;font-weight:700;color:#173f35;font-size:13px}
      .admin-date-block-form input,.admin-date-block-form select{display:block;width:100%;height:42px;box-sizing:border-box;margin-top:7px;padding:9px 11px;border:1px solid #cbd7d1;border-radius:7px;background:#fff;font:inherit}
      .admin-date-block-form button{height:42px;padding:0 18px;border:0;border-radius:7px;background:#173f35;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap}
      .admin-date-block-list{margin-top:16px;border-top:1px solid #e3e9e6}
      .admin-date-block-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #e3e9e6}
      .admin-date-block-row strong{display:block;color:#173f35;font-size:13px}
      .admin-date-block-row span{display:block;margin-top:3px;color:#66736e;font-size:12px}
      .admin-date-unblock{height:34px;padding:0 12px;border:1px solid #d9b1ad;border-radius:6px;background:#fff;color:#a1261f;font-weight:700;cursor:pointer}
      #adminDateBlockStatus{min-height:20px;margin-top:10px;font-size:13px}
      @media(max-width:700px){.admin-date-block-form{grid-template-columns:1fr}.admin-date-block-form button{width:100%}.admin-date-block-row{align-items:flex-start;flex-direction:column}.admin-date-unblock{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    const panel = document.querySelector('.admin-email-settings');
    if (!panel || document.getElementById('adminDateBlocking')) return;
    addStyles();
    const section = document.createElement('div');
    section.id = 'adminDateBlocking';
    section.innerHTML = `
      <p class="eyebrow" style="margin:0 0 4px">UNIT AVAILABILITY</p>
      <h3>Unit Date Blocking</h3>
      <p>Block a date when the accommodation is unavailable for maintenance, cleaning, repairs, owner use, or another reason. Parking-only bookings remain available.</p>
      <div class="admin-date-block-form">
        <label>Blocked Date<input id="adminBlockedDate" type="date" min="${localToday()}"></label>
        <label>Reason<select id="adminBlockedReason"><option>Maintenance</option><option>Cleaning</option><option>Repair</option><option>Owner Use</option><option>Other</option></select></label>
        <button id="adminBlockDateBtn" type="button">Block Date</button>
      </div>
      <div id="adminDateBlockStatus" aria-live="polite"></div>
      <div id="adminDateBlockList" class="admin-date-block-list"><p style="color:#66736e;font-size:13px">Loading blocked dates...</p></div>
    `;
    panel.appendChild(section);
    document.getElementById('adminBlockDateBtn')?.addEventListener('click', blockDate);
    loadBlockedDates();
  }

  async function loadBlockedDates() {
    const list = document.getElementById('adminDateBlockList');
    if (!list || !token()) return;
    try {
      const response = await fetch(`${API}/admin-blocked-dates`, { headers: authHeaders(), cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to load blocked dates.');
      const items = Array.isArray(payload.data) ? payload.data : [];
      list.innerHTML = items.length ? items.map(item => `
        <div class="admin-date-block-row">
          <div><strong>${formatDate(item.date)}</strong><span>${item.reason || 'Maintenance'}</span></div>
          <button class="admin-date-unblock" type="button" data-date="${item.date}">Unblock</button>
        </div>
      `).join('') : '<p style="color:#66736e;font-size:13px;padding:10px 0">No dates are currently blocked.</p>';
      list.querySelectorAll('button[data-date]').forEach(button => button.addEventListener('click', () => unblockDate(button.dataset.date)));
    } catch (error) {
      list.innerHTML = `<p style="color:#a1261f;font-size:13px">${error.message}</p>`;
    }
  }

  async function blockDate() {
    const dateInput = document.getElementById('adminBlockedDate');
    const reasonInput = document.getElementById('adminBlockedReason');
    const button = document.getElementById('adminBlockDateBtn');
    const date = dateInput?.value || '';
    if (!date) {
      setStatus('Please select a date to block.');
      dateInput?.focus();
      return;
    }
    if (button) button.disabled = true;
    setStatus('Blocking date...');
    try {
      const response = await fetch(`${API}/admin-blocked-dates`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ date, reason: reasonInput?.value || 'Maintenance' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to block this date.');
      setStatus(payload.message || 'Date blocked.', true);
      if (dateInput) dateInput.value = '';
      await loadBlockedDates();
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function unblockDate(date) {
    if (!date) return;
    try {
      const response = await fetch(`${API}/admin-blocked-dates/${encodeURIComponent(date)}`, { method: 'DELETE', headers: authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to unblock this date.');
      setStatus(payload.message || 'Date unblocked.', true);
      await loadBlockedDates();
    } catch (error) {
      setStatus(error.message);
    }
  }

  function boot() {
    mount();
    setTimeout(mount, 300);
    setTimeout(mount, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('admin-tab-changed', event => {
    if (event.detail?.key === 'email') {
      mount();
      loadBlockedDates();
    }
  });
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
})();
