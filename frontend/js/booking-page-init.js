/* CA Smart Staycation booking-page initialization. */
document.addEventListener('DOMContentLoaded', () => {
  const type = document.getElementById('bookingType');
  const idSection = document.getElementById('governmentIdSection');
  const idInput = document.getElementById('governmentId');
  const room = document.getElementById('room');
  const roomGroup = document.getElementById('roomGroup');

  if (type && idSection && idInput && room && roomGroup) {
    function updateDocumentRequirements() {
      const parkingOnly = type.value === 'parking';
      idSection.style.display = parkingOnly ? 'none' : '';
      idInput.required = !parkingOnly;
      if (parkingOnly) idInput.value = '';
      room.required = !parkingOnly;
      roomGroup.style.display = parkingOnly ? 'none' : '';
    }
    type.addEventListener('change', updateDocumentRequirements);
    updateDocumentRequirements();
  }

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const API_BASE = window.CA_SMART_API || '/api';
  let availability = [];
  let refreshing = false;
  const TERMINAL = new Set(['Cancelled', 'Checked Out', 'Expired']);
  const isTerminal = b => TERMINAL.has(String(b?.bookingStatus || ''));

  function parseDate(value) {
    if (!value) return null;
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      const x = new Date(y, m - 1, d); x.setHours(0, 0, 0, 0); return x;
    }
    const x = new Date(value);
    if (Number.isNaN(x.getTime())) return null;
    x.setHours(0, 0, 0, 0); return x;
  }

  function addKey(set, value) {
    if (value === undefined || value === null || String(value).trim() === '') return;
    set.add(String(value).trim().toLowerCase());
  }

  // A parking booking may contain an id, populated object, slot number, or
  // parking number depending on which API path created the booking. Treat all
  // representations of the same physical slot as equivalent.
  function parkingKeys(value) {
    const keys = new Set();
    if (value === undefined || value === null || value === '') return keys;
    if (typeof value !== 'object') { addKey(keys, value); return keys; }
    ['_id','id','parkingId','slotId','parkingSlotId','parkingNumber','slotNumber','number','name','parkingName'].forEach(k => addKey(keys, value[k]));
    if (value.parking && typeof value.parking === 'object') {
      parkingKeys(value.parking).forEach(k => keys.add(k));
    }
    return keys;
  }

  function bookingParkingKeys(booking) {
    const keys = new Set();
    ['parking','parkingId','parkingSlot','parkingSlotId','parkingSpace','parkingNumber','slotNumber'].forEach(k => {
      parkingKeys(booking?.[k]).forEach(v => keys.add(v));
    });
    return keys;
  }

  function selectedParkingKeys() {
    const select = document.getElementById('parking');
    if (!select?.value) return new Set();
    const keys = new Set();
    addKey(keys, select.value);
    const option = select.options[select.selectedIndex];
    if (option) {
      addKey(keys, option.textContent);
      addKey(keys, option.textContent.split(' - ')[0]);
    }
    const slots = Array.isArray(window.__caSmartParkingSlots) ? window.__caSmartParkingSlots : [];
    const slot = slots.find(s => parkingKeys(s).has(String(select.value).trim().toLowerCase()));
    if (slot) parkingKeys(slot).forEach(v => keys.add(v));
    return keys;
  }

  function roomKeys(value) {
    const keys = new Set();
    if (value === undefined || value === null || value === '') return keys;
    if (typeof value !== 'object') { addKey(keys, value); return keys; }
    ['_id','id','roomId','unitId','unitNumber','roomNumber','unitName','roomName','name'].forEach(k => addKey(keys, value[k]));
    return keys;
  }

  function selectedRoomKeys() {
    const value = document.getElementById('room')?.value || '';
    const keys = new Set();
    addKey(keys, value);
    const option = document.getElementById('room')?.selectedOptions?.[0];
    if (option) {
      addKey(keys, option.textContent);
      addKey(keys, option.textContent.split(' - ')[0]);
    }
    return keys;
  }

  function dateIsBlocked(target) {
    const day = parseDate(target);
    if (!day) return false;
    const bookingType = document.getElementById('bookingType')?.value || 'unit';
    const selectedRoom = selectedRoomKeys();
    const selectedParking = selectedParkingKeys();
    const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);

    return availability.some(booking => {
      if (isTerminal(booking)) return false;
      const start = parseDate(booking?.checkIn);
      const end = parseDate(booking?.checkOut);
      if (!start || !end || !(day < end && nextDay > start)) return false;

      const sameParking = selectedParking.size > 0 && [...bookingParkingKeys(booking)].some(k => selectedParking.has(k));
      const sameRoom = selectedRoom.size > 0 && [...roomKeys(booking?.room)].some(k => selectedRoom.has(k));

      // Parking Only: only the selected physical parking slot blocks dates.
      if (bookingType === 'parking') return sameParking;
      // Accommodation + Parking: either the selected accommodation OR the
      // selected parking slot blocks the date.
      if (bookingType === 'both') return sameRoom || sameParking;
      // Accommodation Only: only the selected accommodation blocks dates.
      return sameRoom;
    });
  }

  window.isDateBooked = dateIsBlocked;

  function redraw() {
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
  }

  async function refreshAvailability() {
    if (refreshing) return;
    refreshing = true;
    try {
      const response = await fetch(`${API_BASE}/bookings`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const json = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(json.data)) {
        availability = json.data;
        window.bookedDates = availability;
        redraw();
      }
    } catch (error) {
      console.warn('Guest booking availability refresh failed:', error);
    } finally {
      refreshing = false;
    }
  }

  function syncParkingSlotsFromFix() {
    const select = document.getElementById('parking');
    if (!select) return;
    const current = Array.isArray(window.__caSmartParkingSlots) ? window.__caSmartParkingSlots : [];
    [...select.options].forEach(option => {
      if (!option.value) return;
      if (!current.some(s => parkingKeys(s).has(String(option.value).trim().toLowerCase()))) {
        current.push({ _id: option.value, parkingNumber: option.textContent.trim(), slotNumber: option.textContent.split(' - ')[0].trim() });
      }
    });
    window.__caSmartParkingSlots = current;
  }

  const parkingSelect = document.getElementById('parking');
  const roomSelect = document.getElementById('room');
  const bookingType = document.getElementById('bookingType');

  parkingSelect?.addEventListener('change', () => {
    syncParkingSlotsFromFix(); redraw(); refreshAvailability();
  });
  roomSelect?.addEventListener('change', () => redraw());
  bookingType?.addEventListener('change', () => {
    syncParkingSlotsFromFix(); setTimeout(redraw, 0); refreshAvailability();
  });

  grid.addEventListener('click', event => {
    const cell = event.target.closest('.calendar-day.booked');
    if (!cell || !window.selectedCheckIn || window.selectedCheckOut) return;
    const day = Number(cell.textContent.trim());
    if (!day) return;
    const target = new Date(window.currentYear, window.currentMonth, day); target.setHours(0, 0, 0, 0);
    if (target <= window.selectedCheckIn) return;
    let blocked = false;
    for (let d = new Date(window.selectedCheckIn); d < target; d.setDate(d.getDate() + 1)) {
      if (dateIsBlocked(new Date(d))) { blocked = true; break; }
    }
    if (!blocked) return;
    event.preventDefault(); event.stopImmediatePropagation();
    window.selectedCheckIn = null; window.selectedCheckOut = null;
    const ci = document.getElementById('checkIn'); const co = document.getElementById('checkOut');
    if (ci) ci.value = ''; if (co) co.value = '';
    alert('Your selected stay contains booked dates. Please choose another date range.'); redraw();
  }, true);

  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAvailability(); });
  window.addEventListener('focus', refreshAvailability);
  syncParkingSlotsFromFix();
  refreshAvailability();
  setTimeout(() => { syncParkingSlotsFromFix(); redraw(); }, 250);
  setInterval(refreshAvailability, 15000);
});
