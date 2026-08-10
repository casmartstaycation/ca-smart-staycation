/* CA Smart Staycation — Admin booking auto-refresh
   Refreshes the booking table so payment approvals, rejections, and cancellations
   appear without requiring a manual page refresh. */
(function(){
  const REFRESH_MS = 30000;
  function refreshAdminBookings(){
    if (typeof window.loadBookings !== 'function') return;
    if (document.hidden) return;
    window.loadBookings(true);
  }
  setInterval(refreshAdminBookings, REFRESH_MS);
})();
