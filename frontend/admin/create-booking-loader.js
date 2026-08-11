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
  const removeDuplicateCalendarCards = () => {
    const cards = document.querySelectorAll("#adminBookingModal .ab-calendar-section");
    cards.forEach((card, index) => {
      if (index > 0) card.remove();
    });
  };
  const arrangeBookingFields = () => {
    const host = document.querySelector("#adminBookingForm .admin-booking-grid");
    if (!host) return;
    const bookingType = document.getElementById("abParkingOnly")?.closest(".admin-booking-field");
    const room = document.getElementById("abRoom")?.closest(".admin-booking-field");
    const calendar = host.querySelector(".ab-calendar-section");
    if (!bookingType || !room || !calendar) return;
    host.insertBefore(bookingType, room);
    host.insertBefore(calendar, room.nextSibling);
  };
  fetch("create-booking-public.js?v=20260811-5", { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error("Unable to load guest booking module."); return r.text(); })
    .then(code => {
      code = code.replace('`${ADMIN_BOOKING_API}/bookings`', '`${ADMIN_BOOKING_API}/bookings?_=${Date.now()}`');
      run(code);
      syncGuestAvailability();
      removeDuplicateCalendarCards();
      arrangeBookingFields();
      const newBookingButton = document.getElementById("navNewBooking");
      if (newBookingButton) {
        newBookingButton.addEventListener("click", () => {
          setTimeout(() => {
            removeDuplicateCalendarCards();
            arrangeBookingFields();
          }, 0);
          setTimeout(arrangeBookingFields, 50);
        });
      }
      const room = document.getElementById("abRoom");
      if (room) setInterval(() => {
        if (!document.getElementById("adminBookingModal")?.hidden) {
          room.dispatchEvent(new Event("change"));
          arrangeBookingFields();
        }
      }, 10000);
    })
    .catch(err => console.error("Admin guest booking module failed to load:", err));
})();
