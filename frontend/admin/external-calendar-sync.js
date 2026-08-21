(() => {
  const API = '/api/calendar-sync';
  const token = () => sessionStorage.getItem('caSmartAdminToken') || '';
  const authHeaders = (json = false) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token()}`
  });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

  function formatDate(value) {
    if (!value) return 'Never';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function request(path, options = {}) {
    const response = await fetch(API + path, { cache: 'no-store', ...options });
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem('caSmartAdminToken');
      throw new Error('Your admin session expired. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || 'Calendar request failed.');
    return data;
  }

  function injectStyles() {
    if (document.getElementById('externalCalendarStyles')) return;
    const style = document.createElement('style');
    style.id = 'externalCalendarStyles';
    style.textContent = `
      .ical-card{grid-column:1/-1}.ical-export{display:grid;grid-template-columns:1fr auto;gap:8px;margin:12px 0 18px}.ical-export input{min-width:0;padding:11px;border:1px solid #d8ddd9;border-radius:8px;background:#f7f8f7}.ical-export button,.ical-form button,.ical-actions button{border:0;border-radius:8px;padding:10px 13px;cursor:pointer;font-weight:700}.ical-export button,.ical-form button{background:#173f35;color:#fff}.ical-form{display:grid;grid-template-columns:minmax(140px,.5fr) minmax(240px,1.5fr) auto;gap:8px;margin:10px 0 16px}.ical-form input{min-width:0;padding:11px;border:1px solid #d8ddd9;border-radius:8px}.ical-list{display:grid;gap:10px}.ical-item{border:1px solid #e0e4e1;border-radius:12px;padding:13px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fff}.ical-main{min-width:0}.ical-name{font-weight:800;color:#173f35}.ical-meta{font-size:13px;color:#68756f;margin-top:4px;overflow-wrap:anywhere}.ical-error{font-size:12px;color:#a23a32;margin-top:5px}.ical-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.ical-actions button{background:#eef3f0;color:#173f35}.ical-actions .danger{background:#f9e9e7;color:#8c2f28}.ical-actions .toggle-off{background:#f5eee1;color:#775b22}.ical-empty{color:#68756f;padding:10px 0}.ical-note{font-size:13px;color:#68756f;line-height:1.5}.ical-status{font-size:12px;font-weight:700;margin-left:7px}.ical-status.on{color:#28764e}.ical-status.off{color:#8a6a2c}@media(max-width:760px){.ical-form{grid-template-columns:1fr}.ical-export{grid-template-columns:1fr}.ical-item{align-items:stretch;flex-direction:column}.ical-actions{justify-content:stretch;display:grid;grid-template-columns:1fr 1fr}.ical-actions button{width:100%}}`;
    document.head.appendChild(style);
  }

  function buildCard() {
    const grid = document.querySelector('main.grid');
    if (!grid || document.getElementById('externalCalendarCard')) return;
    const card = document.createElement('section');
    card.id = 'externalCalendarCard';
    card.className = 'card ical-card';
    card.innerHTML = `
      <div class="card-head"><div><h2>External Calendar Sync (iCal)</h2><p>Paste iCal links from Airbnb, Booking.com, Agoda, or other booking sites. Imported reservations automatically block accommodation dates on CA Smart Staycation.</p></div><button id="icalRefreshAll" type="button">Refresh</button></div>
      <p class="ical-note"><strong>Your CA Smart Staycation export link:</strong> use this URL when another booking site asks you to import your CA Smart Staycation calendar.</p>
      <div class="ical-export"><input id="icalExportUrl" readonly value="https://casmartstaycation.com/api/calendar.ics"><button id="copyIcalExport" type="button">Copy Export URL</button></div>
      <form id="icalAddForm" class="ical-form"><input id="icalName" maxlength="80" placeholder="Calendar name (e.g. Airbnb)" required><input id="icalUrl" type="url" inputmode="url" placeholder="Paste https://... .ics calendar URL" required><button type="submit">Add Calendar</button></form>
      <div id="icalMessage" class="ical-note" aria-live="polite"></div>
      <div id="icalList" class="ical-list"><div class="ical-empty">Loading calendars…</div></div>`;
    grid.appendChild(card);
  }

  let calendars = [];
  function render() {
    const list = document.getElementById('icalList');
    if (!list) return;
    if (!calendars.length) {
      list.innerHTML = '<div class="ical-empty">No external calendars connected yet. Paste an iCal URL above to connect one.</div>';
      return;
    }
    list.innerHTML = calendars.map(c => `
      <div class="ical-item">
        <div class="ical-main">
          <div class="ical-name">${esc(c.name)} <span class="ical-status ${c.enabled ? 'on' : 'off'}">${c.enabled ? 'Enabled' : 'Paused'}</span></div>
          <div class="ical-meta">${esc(c.host || 'Calendar feed')} · ${Number(c.eventCount || 0)} imported event(s) · Last sync: ${esc(formatDate(c.lastSyncedAt))}</div>
          ${c.lastError ? `<div class="ical-error">Last error: ${esc(c.lastError)}</div>` : ''}
        </div>
        <div class="ical-actions">
          <button type="button" data-action="sync" data-id="${esc(c._id)}">Sync Now</button>
          <button type="button" data-action="toggle" data-id="${esc(c._id)}" class="${c.enabled ? '' : 'toggle-off'}">${c.enabled ? 'Pause' : 'Enable'}</button>
          <button type="button" data-action="delete" data-id="${esc(c._id)}" class="danger">Delete</button>
        </div>
      </div>`).join('');
  }

  async function load() {
    const message = document.getElementById('icalMessage');
    try {
      const result = await request('/external-calendars', { headers: authHeaders() });
      calendars = Array.isArray(result.data) ? result.data : [];
      render();
      if (message) message.textContent = '';
    } catch (err) {
      if (message) message.textContent = err.message;
      if (/session/i.test(err.message)) window.location.href = 'bookings.html';
    }
  }

  async function addCalendar(event) {
    event.preventDefault();
    const name = document.getElementById('icalName').value.trim();
    const url = document.getElementById('icalUrl').value.trim();
    const message = document.getElementById('icalMessage');
    if (message) message.textContent = 'Checking and syncing calendar…';
    try {
      await request('/external-calendars', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ name, url }) });
      event.target.reset();
      if (message) message.textContent = 'Calendar connected and synced successfully.';
      await load();
    } catch (err) { if (message) message.textContent = err.message; }
  }

  async function act(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const item = calendars.find(c => String(c._id) === String(id));
    if (!item) return;
    const message = document.getElementById('icalMessage');
    button.disabled = true;
    try {
      if (button.dataset.action === 'sync') {
        if (message) message.textContent = `Syncing ${item.name}…`;
        await request(`/external-calendars/${encodeURIComponent(id)}/sync`, { method: 'POST', headers: authHeaders(true), body: '{}' });
      } else if (button.dataset.action === 'toggle') {
        await request(`/external-calendars/${encodeURIComponent(id)}`, { method: 'PATCH', headers: authHeaders(true), body: JSON.stringify({ enabled: !item.enabled }) });
      } else if (button.dataset.action === 'delete') {
        if (!confirm(`Delete ${item.name} calendar? Imported dates from this calendar will stop blocking your website.`)) return;
        await request(`/external-calendars/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders(true), body: '{}' });
      }
      if (message) message.textContent = 'Calendar settings updated.';
      await load();
    } catch (err) { if (message) message.textContent = err.message; }
    finally { button.disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    buildCard();
    document.getElementById('icalAddForm')?.addEventListener('submit', addCalendar);
    document.getElementById('icalList')?.addEventListener('click', act);
    document.getElementById('icalRefreshAll')?.addEventListener('click', load);
    document.getElementById('copyIcalExport')?.addEventListener('click', async () => {
      const input = document.getElementById('icalExportUrl');
      try { await navigator.clipboard.writeText(input.value); }
      catch { input.select(); document.execCommand('copy'); }
      const message = document.getElementById('icalMessage');
      if (message) message.textContent = 'CA Smart Staycation export URL copied.';
    });
    load();
  });
})();
