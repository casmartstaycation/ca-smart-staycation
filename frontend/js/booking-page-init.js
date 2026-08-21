/* CA Smart Staycation booking-page initialization.
 * Externalized from index.html so it works under strict Content-Security-Policy.
 */

document.addEventListener('DOMContentLoaded', () => {
  const type = document.getElementById('bookingType');
  const idSection = document.getElementById('governmentIdSection');
  const idInput = document.getElementById('governmentId');
  const room = document.getElementById('room');
  const roomGroup = document.getElementById('roomGroup');

  const bookingGrid = type?.closest('.form-grid');
  if (bookingGrid && type?.parentElement) {
    type.parentElement.id = type.parentElement.id || 'bookingTypeGroup';
    bookingGrid.classList.add('booking-details-grid');

    if (!document.getElementById('bookingDetailsRowStyles')) {
      const style = document.createElement('style');
      style.id = 'bookingDetailsRowStyles';
      style.textContent = `
        @media (min-width: 901px) {
          .booking-details-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
          .booking-details-grid > #bookingTypeGroup,
          .booking-details-grid > #parkingGroup,
          .booking-details-grid > #roomGroup {
            grid-column: span 2;
          }
          .booking-details-grid > .full-width {
            grid-column: 1 / -1;
          }
          .booking-details-grid > #guestsGroup,
          .booking-details-grid > #childrenGroup {
            grid-column: span 3;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

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
  const parkingBlockedDateKeys = new Set();
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const selectedParking = () => document.getElementById('parking')?.value || '';
  const bookingUsesParking = bookingType => bookingType === 'parking' || (bookingType === 'both' && selectedParking() && selectedParking() !== 'none');
  const isAdminBlockedForType = (date, bookingType) => {
    const key = dateKey(date);
    if (bookingType === 'parking') return parkingBlockedDateKeys.has(key);
    if (bookingType === 'both') return blockedDateKeys.has(key) || (bookingUsesParking(bookingType) && parkingBlockedDateKeys.has(key));
    return blockedDateKeys.has(key);
  };

  const originalIsDateBooked = typeof window.isDateBooked === 'function' ? window.isDateBooked : null;
  if (originalIsDateBooked) {
    window.isDateBooked = function(date) {
      const bookingType = document.getElementById('bookingType')?.value || 'both';
      if (isAdminBlockedForType(date, bookingType)) return true;
      return originalIsDateBooked(date);
    };
  }

  const originalRenderCalendar = typeof window.renderCalendar === 'function' ? window.renderCalendar : null;
  if (originalRenderCalendar) {
    window.renderCalendar = function() {
      originalRenderCalendar();
      const bookingType = document.getElementById('bookingType')?.value || 'both';
      document.querySelectorAll('#calendarGrid .calendar-day:not(.empty)').forEach(cell => {
        const day = Number(cell.textContent.trim());
        if (!day) return;
        const date = new Date(currentYear, currentMonth, day);
        const key = dateKey(date);
        const unitBlocked = blockedDateKeys.has(key);
        const parkingBlocked = parkingBlockedDateKeys.has(key);
        if (!isAdminBlockedForType(date, bookingType)) return;
        cell.classList.add('booked', 'admin-blocked');
        if (bookingType === 'parking') cell.title = 'Parking unavailable';
        else if (bookingType === 'both' && bookingUsesParking(bookingType) && unitBlocked && parkingBlocked) cell.title = 'Accommodation and parking unavailable';
        else if (bookingType === 'both' && bookingUsesParking(bookingType) && parkingBlocked) cell.title = 'Parking unavailable';
        else cell.title = 'Accommodation unavailable';
      });
    };
  }

  fetch('/api/settings', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(response => response.ok ? response.json() : null)
    .then(payload => {
      blockedDateKeys.clear();
      parkingBlockedDateKeys.clear();
      const unitItems = Array.isArray(payload?.data?.blockedDates) ? payload.data.blockedDates : [];
      const parkingItems = Array.isArray(payload?.data?.parkingBlockedDates) ? payload.data.parkingBlockedDates : [];
      unitItems.forEach(item => {
        const key = String(item?.date || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) blockedDateKeys.add(key);
      });
      parkingItems.forEach(item => {
        const key = String(item?.date || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) parkingBlockedDateKeys.add(key);
      });
      window.CA_SMART_BLOCKED_DATES = blockedDateKeys;
      window.CA_SMART_PARKING_BLOCKED_DATES = parkingBlockedDateKeys;
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
    const bookingType = document.getElementById('bookingType')?.value || 'both';

    if (isAdminBlockedForType(target, bookingType)) return;

    const selectedRoom = document.getElementById('room')?.value || '';
    const selectedParkingId = selectedParking();
    const usesParking = bookingUsesParking(bookingType);
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
      const parkingId = booking.parking?._id || booking.parking || null;

      if (bookingType === 'parking') return usesParking && hasParking(booking) && String(parkingId) === String(selectedParkingId);
      if (bookingType === 'both') {
        return (hasRoom(booking) && String(roomId) === String(selectedRoom)) || (usesParking && hasParking(booking) && String(parkingId) === String(selectedParkingId));
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
