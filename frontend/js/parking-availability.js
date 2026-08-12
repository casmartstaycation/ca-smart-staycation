(() => {
  'use strict';

  const API = 'https://ca-smart-staycation-muqd.onrender.com/api';
  let parkingBookings = [];
  let refreshTimer = null;

  const normalizedType = () => String(document.getElementById('bookingType')?.value || 'unit')
    .trim().toLowerCase().replace(/[\s_-]/g, '');

  const isParkingMode = () => {
    const t = normalizedType();
    return t === 'parking' || t === 'parkingonly' || t === 'both' || t === 'accommodationparking';
  };

  const terminal = status => ['cancelled', 'checkedout', 'expired'].includes(
    String(status || '').trim().toLowerCase().replace(/[\s_-]/g, '')
  );

  const localDate = value => {
    if (!value) return null;
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const p = s.slice(0, 10).split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const parkingBooking = b => {
    if (!b || terminal(b.bookingStatus)) return false;
    if (b.parkingOnly === true || String(b.parkingOnly).toLowerCase() === 'true') return true;
    if (b.parking || b.parkingSlot || String(b.parkingNumber || '').trim()) return true;
    const t = String(b.bookingType || b.type || '').trim().toLowerCase().replace(/[\s_-]/g, '');
    return t === 'parking' || t === 'parkingonly';
  };

  const occupied = day => parkingBookings.some(b => {
    if (!parkingBooking(b)) return false;
    const start = localDate(b.checkIn);
    const end = localDate(b.checkOut);
    return !!(start && end && day >= start && day < end);
  });

  const monthFromTitle = () => {
    const title = document.getElementById('calendarTitle')?.textContent?.trim() || '';
    const match = title.match(/^(.+)\s+(\d{4})$/);
    if (!match) return null;
    const d = new Date(`${match[1]} 1, ${match[2]}`);
    return Number.isNaN(d.getTime()) ? null : { month: d.getMonth(), year: d.getFullYear() };
  };

  const apply = () => {
    if (!isParkingMode()) return;
    const grid = document.getElementById('calendarGrid');
    const month = monthFromTitle();
    if (!grid || !month) return;

    grid.querySelectorAll('.calendar-day:not(.empty)').forEach(cell => {
      const dayNumber = Number(String(cell.textContent || '').trim());
      if (!dayNumber) return;
      const day = new Date(month.year, month.month, dayNumber);
      day.setHours(0, 0, 0, 0);
      if (!occupied(day)) return;

      cell.classList.add('booked');
      cell.classList.remove('checkin', 'checkout', 'selected-range');
      cell.title = 'Parking already booked';
      cell.setAttribute('aria-disabled', 'true');
      cell.style.pointerEvents = 'none';
    });
  };

  const refresh = async () => {
    try {
      const response = await fetch(`${API}/bookings?parkingAvailability=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const json = await response.json();
      const list = response.ok
        ? (Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []))
        : [];
      parkingBookings = list;
      apply();
    } catch (error) {
      console.warn('Parking availability refresh failed:', error);
    }
  };

  const schedule = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refresh();
      setTimeout(apply, 100);
      setTimeout(apply, 500);
    }, 0);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const type = document.getElementById('bookingType');
    type?.addEventListener('change', schedule);

    const grid = document.getElementById('calendarGrid');
    if (grid) {
      new MutationObserver(() => {
        if (isParkingMode()) apply();
      }).observe(grid, { childList: true, subtree: true });
    }

    schedule();
  });

  window.addEventListener('focus', schedule);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule();
  });
})();