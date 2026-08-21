/* CA Smart Staycation guest booking parking fix */
(function () {
  'use strict';
  const API_BASE = window.CA_SMART_API || '/api';
  const TERMINAL = new Set(['Cancelled', 'Checked Out', 'Expired']);
  let parkingSlots = [];
  let selectedParkingId = '';
  let bookings = [];
  let rooms = [];

  const $ = id => document.getElementById(id);
  const type = () => $('bookingType')?.value || 'both';
  const showsParkingChoice = () => type() === 'parking' || type() === 'both';
  const parkingChoice = () => $('parking')?.value || '';
  const needsParking = () => type() === 'parking' || (type() === 'both' && parkingChoice() && parkingChoice() !== 'none');

  function date(v) {
    if (!v) return null;
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y,m,d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const x = new Date(v);
    return Number.isNaN(x.getTime()) ? null : x;
  }
  function overlap(a,b,c,d) { return a && b && c && d && a < d && c < b; }

  function ensureParkingUI() {
    if ($('parkingGroup')) return;
    const vehicle = $('vehicleSection');
    if (!vehicle) return;
    const group = document.createElement('div');
    group.id = 'parkingGroup';
    group.className = 'form-group';
    group.innerHTML = '<label for="parking">Select Parking Lot</label><select id="parking"><option value="none">No parking required</option></select><small id="parkingAvailabilityMessage"></small>';
    const bookingType = $('bookingType');
    if (bookingType?.parentElement?.parentElement) {
      bookingType.parentElement.parentElement.insertBefore(group, bookingType.parentElement.nextElementSibling);
    } else if (vehicle.parentNode) {
      vehicle.parentNode.insertBefore(group, vehicle);
    }
  }

  function updateParkingUI() {
    ensureParkingUI();
    const group = $('parkingGroup');
    const vehicle = $('vehicleSection');
    const select = $('parking');
    const visible = showsParkingChoice();

    if (group) group.style.display = visible ? '' : 'none';
    if (select) {
      select.required = visible;
      if (type() === 'both' && !select.value) select.value = 'none';
      if (type() === 'parking' && select.value === 'none') select.value = '';
    }

    const parkingRequired = needsParking();
    if (vehicle) vehicle.style.display = parkingRequired ? '' : 'none';
    ['vehicleBrand','vehicleModel','vehicleColor','plateNumber','driversLicense'].forEach(id => {
      const el = $(id);
      if (el) el.required = parkingRequired;
    });

    if (!parkingRequired) {
      selectedParkingId = '';
    } else if (select && select.value && select.value !== 'none') {
      selectedParkingId = select.value;
    }
  }

  async function loadRoomsFix() {
    try {
      const r = await fetch(`${API_BASE}/rooms`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      rooms = Array.isArray(j.data) ? j.data : [];
      const select = $('room');
      if (!select) return;
      const current = select.value;
      select.innerHTML = '<option value="">Select Accommodation</option>';
      rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room._id;
        option.textContent = `${room.unitNumber || room.roomNumber || ''} - ${room.unitName || room.roomName || 'Room'}`;
        select.appendChild(option);
      });
      if (current && rooms.some(r => String(r._id) === String(current))) select.value = current;
    } catch (e) { console.error('Guest booking rooms:', e); }
  }

  async function loadParkingFix() {
    try {
      const r = await fetch(`${API_BASE}/parking`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      parkingSlots = Array.isArray(j.data) ? j.data : [];
      const select = $('parking');
      if (!select) return;

      const current = parkingChoice() || selectedParkingId;
      select.innerHTML = type() === 'both'
        ? '<option value="none">No parking required</option>'
        : '<option value="">Select Parking Lot</option>';

      parkingSlots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot._id;
        option.textContent = `${slot.parkingNumber || slot.slotNumber || ''}${slot.parkingName ? ` - ${slot.parkingName}` : ''}`.trim() || slot.name || 'Parking Lot';
        if (String(slot.status || '').toLowerCase() === 'occupied') option.disabled = true;
        select.appendChild(option);
      });

      if (type() === 'both' && current === 'none') {
        select.value = 'none';
        selectedParkingId = '';
      } else if (current && parkingSlots.some(s => String(s._id) === String(current))) {
        select.value = current;
        selectedParkingId = current;
      } else if (type() === 'both') {
        select.value = 'none';
        selectedParkingId = '';
      }
      updateParkingUI();
    } catch (e) {
      parkingSlots = [];
      const select = $('parking');
      if (select) {
        select.innerHTML = type() === 'both'
          ? '<option value="none">No parking required</option>'
          : '<option value="">Parking unavailable</option>';
      }
      updateParkingUI();
      console.error('Guest booking parking:', e);
    }
  }

  async function refreshBookings() {
    try {
      const r = await fetch(`${API_BASE}/bookings`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      bookings = Array.isArray(j.data) ? j.data : [];
      try { window.bookedDates = bookings; } catch (_) {}
      return bookings;
    } catch (e) {
      bookings = [];
      console.error('Guest booking availability:', e);
      return bookings;
    }
  }

  function parkingConflict(start, end) {
    if (!needsParking()) return false;
    const selected = String(selectedParkingId || parkingChoice() || '');
    if (!selected || selected === 'none') return false;
    return bookings.some(b => {
      if (TERMINAL.has(String(b.bookingStatus || ''))) return false;
      if (!(b.parking?._id || b.parking)) return false;
      if (String(b.parking?._id || b.parking) !== selected) return false;
      return overlap(start, end, date(b.checkIn), date(b.checkOut));
    });
  }

  function roomConflict(start, end) {
    if (type() === 'parking') return false;
    const selected = String($('room')?.value || '');
    return bookings.some(b => {
      if (TERMINAL.has(String(b.bookingStatus || ''))) return false;
      if (!(b.room?._id || b.room)) return false;
      if (String(b.room?._id || b.room) !== selected) return false;
      return overlap(start, end, date(b.checkIn), date(b.checkOut));
    });
  }

  async function submitFix(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    updateParkingUI();

    const bookingType = type();
    const selectedChoice = parkingChoice();
    const useParking = bookingType === 'parking' || (bookingType === 'both' && selectedChoice && selectedChoice !== 'none');
    const checkIn = $('checkIn')?.value || '';
    const checkOut = $('checkOut')?.value || '';
    const start = date(checkIn), end = date(checkOut);

    if (!checkIn || !checkOut || !start || !end || end <= start) return alert('Please select valid check-in and check-out dates.');
    if (bookingType !== 'parking' && !$('room')?.value) return alert('Please select an accommodation.');
    if (bookingType === 'both' && !selectedChoice) return alert('Please select a parking lot or choose No parking required.');

    if (useParking) {
      if (!selectedChoice || selectedChoice === 'none') return alert('Please select a parking lot.');
      if (!$('driversLicense')?.files?.length) return alert("Please upload the driver's license required for parking.");
      if (!$('vehicleBrand')?.value.trim() || !$('vehicleModel')?.value.trim() || !$('vehicleColor')?.value.trim() || !$('plateNumber')?.value.trim()) return alert('Please complete Vehicle Brand, Vehicle Model, Vehicle Color, and Plate Number.');
      selectedParkingId = selectedChoice;
    } else {
      selectedParkingId = '';
    }

    for (const id of ['firstName','lastName','email','mobile','address']) if (!$(`${id}`)?.value.trim()) return alert('Please complete all required guest information.');
    if (bookingType !== 'parking' && !$('governmentId')?.files?.length) return alert('Please upload a government-issued ID.');

    await refreshBookings();
    if (roomConflict(start, end)) return alert('The selected accommodation is already booked for the selected dates.');
    if (useParking && parkingConflict(start, end)) return alert('The selected parking lot is already reserved for the selected dates.');

    const totalText = $('totalAmount')?.textContent || '0';
    const total = Number(totalText.replace(/[^0-9.-]/g, '')) || 0;
    const payload = {
      firstName: $('firstName').value.trim(), lastName: $('lastName').value.trim(), email: $('email').value.trim(), mobile: $('mobile').value.trim(), address: $('address').value.trim(),
      room: bookingType === 'parking' ? null : $('room').value, parking: useParking ? selectedParkingId : null, parkingOnly: bookingType === 'parking',
      checkIn, checkOut, adults: Number($('guests')?.value || 0), children: Number($('children')?.value || 0),
      vehicleBrand: useParking ? ($('vehicleBrand')?.value.trim() || '') : '', vehicleModel: useParking ? ($('vehicleModel')?.value.trim() || '') : '', vehicleColor: useParking ? ($('vehicleColor')?.value.trim() || '') : '', plateNumber: useParking ? ($('plateNumber')?.value.trim() || '') : '', totalAmount: total
    };

    const button = document.querySelector('#guestBookingForm button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const r = await fetch(`${API_BASE}/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || 'Booking failed.');
      const booking = { ...(j.data || {}), bookingType, parking: payload.parking, parkingOnly: payload.parkingOnly, checkIn, checkOut, guests: payload.adults, children: payload.children, totalAmount: total };
      localStorage.setItem('guestBooking', JSON.stringify(booking));
      localStorage.setItem('bookingReference', booking.bookingReference || '');
      window.location.href = 'guest-booking/booking-success.html';
    } catch (e) {
      console.error('Guest booking submit:', e);
      alert(e.message || 'Unable to connect to server.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    ensureParkingUI();
    updateParkingUI();
    await Promise.all([loadRoomsFix(), loadParkingFix(), refreshBookings()]);
    updateParkingUI();

    $('parking')?.addEventListener('change', e => {
      selectedParkingId = e.target.value && e.target.value !== 'none' ? e.target.value : '';
      updateParkingUI();
      if (typeof calculateTotal === 'function') calculateTotal();
      if (typeof renderCalendar === 'function') renderCalendar();
    });

    $('bookingType')?.addEventListener('change', async () => {
      selectedParkingId = '';
      await loadParkingFix();
      updateParkingUI();
      if (typeof calculateTotal === 'function') calculateTotal();
      if (typeof renderCalendar === 'function') renderCalendar();
    });

    $('room')?.addEventListener('change', () => setTimeout(refreshBookings, 0));
    $('guestBookingForm')?.addEventListener('submit', submitFix, true);
  });
})();
