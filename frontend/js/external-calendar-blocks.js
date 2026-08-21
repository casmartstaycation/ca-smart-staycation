(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const externalBlocked = new Set();
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const bookingType = () => document.getElementById('bookingType')?.value || 'both';
    const blocksAccommodation = date => bookingType() !== 'parking' && externalBlocked.has(dateKey(date));

    const previousIsDateBooked = typeof window.isDateBooked === 'function' ? window.isDateBooked : null;
    if (previousIsDateBooked) {
      window.isDateBooked = function(date) {
        if (blocksAccommodation(date)) return true;
        return previousIsDateBooked(date);
      };
    }

    const previousRenderCalendar = typeof window.renderCalendar === 'function' ? window.renderCalendar : null;
    if (previousRenderCalendar) {
      window.renderCalendar = function() {
        previousRenderCalendar();
        if (bookingType() === 'parking') return;
        document.querySelectorAll('#calendarGrid .calendar-day:not(.empty)').forEach(cell => {
          const day = Number(cell.textContent.trim());
          if (!day || typeof currentYear === 'undefined' || typeof currentMonth === 'undefined') return;
          const date = new Date(currentYear, currentMonth, day);
          if (!externalBlocked.has(dateKey(date))) return;
          cell.classList.add('booked', 'external-calendar-blocked');
          cell.title = 'Unavailable — reserved on another booking site';
        });
      };
    }

    fetch('/api/calendar-sync/external-calendar-blocks', { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        externalBlocked.clear();
        const dates = Array.isArray(payload?.data) ? payload.data : [];
        dates.forEach(value => {
          const key = String(value || '').trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) externalBlocked.add(key);
        });
        window.CA_SMART_EXTERNAL_BLOCKED_DATES = externalBlocked;
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
      })
      .catch(error => console.warn('Unable to load external calendar dates.', error));
  });
})();
