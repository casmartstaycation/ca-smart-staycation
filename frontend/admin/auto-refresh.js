/* CA Smart Staycation — Admin booking auto-refresh
   Refreshes the lightweight booking list without repeatedly hammering the API. */
(function(){
  const REFRESH_MS = 120000;
  let refreshInProgress = false;

  async function refreshAdminBookings(){
    if (refreshInProgress || document.hidden || typeof window.loadBookings !== 'function') return;
    refreshInProgress = true;
    try {
      await window.loadBookings(true);
    } finally {
      refreshInProgress = false;
    }
  }

  setInterval(refreshAdminBookings, REFRESH_MS);
})();
