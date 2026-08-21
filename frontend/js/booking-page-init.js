/* CA Smart Staycation booking-page initialization.
 * Externalized from index.html so it works under strict Content-Security-Policy.
 */

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

  const blockedDateKeys = new Set();
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const originalIsDateBooked = typeof window.isDateBooked === 'function' ? window.isDateBooked : null;
  if (originalIsDateBooked) {
    window.isDateBooked = function(date) {
      const bookingType = document.getElementById('bookingType')?.value || 'unit';
      if (bookingType !== 'parking' && blockedDateKeys.has(dateKey(date))) return true;
      return originalIsDateBooked(date);
    };
  }

  const originalRenderCalendar = typeof window.renderCalendar === 'function' ? window.renderCalendar : null;
  if (originalRenderCalendar) {
    window.renderCalendar = function() {
      originalRenderCalendar();
      const bookingType = document.getElementById('bookingType')?.value || 'unit';
      if (bookingType === 'parking') return;
      document.querySelectorAll('#calendarGrid .calendar-day:not(.empty)').forEach(cell => {
        const day = Number(cell.textContent.trim());
        if (!day) return;
        const date = new Date(currentYear, currentMonth, day);
        if (blockedDateKeys.has(dateKey(date))) {
          cell.classList.add('booked', 'admin-blocked');
          cell.title = 'Unavailable';
        }
      });
    };
  }

  fetch('/api/settings', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(response => response.ok ? response.json() : null)
    .then(payload => {
      blockedDateKeys.clear();
      const items = Array.isArray(payload?.data?.blockedDates) ? payload.data.blockedDates : [];
      items.forEach(item => {
        const key = String(item?.date || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) blockedDateKeys.add(key);
      });
      window.CA_SMART_BLOCKED_DATES = blockedDateKeys;
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    })
    .catch(error => console.warn('Unable to load admin blocked dates.', error));

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  grid.addEventListener('click', (event) => {
    const cell = event.target.closest('.calendar-day.booked');
    if (!cell || !selectedCheckIn || selectedCheckOut) return;

    const day = Number(cell.textContent.trim());
    if (!day) return;

    const target = new Date(currentYear, currentMonth, day);
    target.setHours(0, 0, 0, 0);

    if (blockedDateKeys.has(dateKey(target))) return;

    const selectedRoom = document.getElementById('room')?.value || '';
    const bookingType = document.getElementById('bookingType')?.value || 'unit';
    const isTerminal = booking => ['Cancelled', 'Checked Out', 'Expired'].includes(String(booking?.bookingStatus || ''));

    const parseDate = value => {
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        const [y, m, d] = String(value).split('-').map(Number);
        const result = new Date(y, m - 1, d);
        result.setHours(0, 0, 0, 0);
        return result;
      }
      const result = new Date(value);
      if (Number.isNaN(result.getTime())) return null;
      result.setHours(0, 0, 0, 0);
      return result;
    };

    const hasRoom = booking => Boolean(booking?.room?._id || booking?.room);
    const hasParking = booking => Boolean(booking?.parking?._id || booking?.parking);

    const matchingBoundary = bookedDates.some(booking => {
      if (isTerminal(booking)) return false;
      const start = parseDate(booking.checkIn);
      if (!start || start.getTime() !== target.getTime()) return false;
      const roomId = booking.room?._id || booking.room || null;

      if (bookingType === 'parking') return hasParking(booking);
      if (bookingType === 'both') {
        return (hasRoom(booking) && String(roomId) === String(selectedRoom)) || hasParking(booking);
      }
      return hasRoom(booking) && String(roomId) === String(selectedRoom);
    });

    if (!matchingBoundary || target <= selectedCheckIn) return;

    event.stopPropagation();
    selectedCheckOut = new Date(target);

    const checkIn = document.getElementById('checkIn');
    const checkOut = document.getElementById('checkOut');
    const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    if (checkIn) checkIn.value = format(selectedCheckIn);
    if (checkOut) checkOut.value = format(selectedCheckOut);
    if (typeof calculateTotal === 'function') calculateTotal();
    if (typeof renderCalendar === 'function') renderCalendar();
  }, true);
});
