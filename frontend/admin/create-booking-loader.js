(() => {
  const run = code => {
    if (document.readyState === "loading") {
      new Function(code)();
      return;
    }
    const originalAddEventListener = document.addEventListener;
    let domReadyHandler = null;
    document.addEventListener = function(type, handler, options) {
      if (type === "DOMContentLoaded") { domReadyHandler = handler; return; }
      return originalAddEventListener.call(document, type, handler, options);
    };
    try { new Function(code)(); } finally { document.addEventListener = originalAddEventListener; }
    if (typeof domReadyHandler === "function") domReadyHandler();
  };
  const syncGuestAvailability = () => {
    const grid = document.getElementById("abCalendarGrid");
    if (!grid) return;
    grid.dataset.availabilitySync = "live";
  };
  fetch("create-booking-public.js?v=20260811-3", { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error("Unable to load guest booking module."); return r.text(); })
    .then(code => {
      code = code.replace('`${ADMIN_BOOKING_API}/bookings`', '`${ADMIN_BOOKING_API}/bookings?_=${Date.now()}`');
      run(code);
      syncGuestAvailability();
    })
    .catch(err => console.error("Admin guest booking module failed to load:", err));
})();
