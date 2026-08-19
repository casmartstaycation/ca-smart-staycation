(function () {
  'use strict';

  // A newly completed guest booking must never inherit an existing guest
  // session from another account/browser user. The guest must explicitly log
  // in before entering the dashboard for this booking.
  function clearGuestSessionBeforeDashboard() {
    try {
      localStorage.removeItem('guestAuthToken');
      localStorage.removeItem('guestAccount');
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    var back = document.getElementById('backBookings');
    var home = document.getElementById('returnHome');
    if (back) back.addEventListener('click', function () {
      clearGuestSessionBeforeDashboard();
      window.location.href = 'guest-dashboard.html';
    });
    if (home) home.addEventListener('click', function () { window.location.href = '../index.html'; });
  });
})();
