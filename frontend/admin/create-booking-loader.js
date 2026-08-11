(() => {
  const run = code => {
    if (document.readyState === "loading") { new Function(code)(); return; }
    const originalAddEventListener = document.addEventListener;
    let domReadyHandler = null;
    document.addEventListener = function(type, handler, options) {
      if (type === "DOMContentLoaded") { domReadyHandler = handler; return; }
      return originalAddEventListener.call(document, type, handler, options);
    };
    try { new Function(code)(); } finally { document.addEventListener = originalAddEventListener; }
    if (typeof domReadyHandler === "function") domReadyHandler();
  };
  const syncGuestAvailability = () => { const grid=document.getElementById("abCalendarGrid"); if(grid) grid.dataset.availabilitySync="live"; };
  const removeDuplicateCalendarCards = () => { document.querySelectorAll("#adminBookingModal .ab-calendar-section").forEach((card,index)=>{if(index>0)card.remove();}); };
  const arrangeBookingFields = () => {
    const host=document.querySelector("#adminBookingForm .admin-booking-grid"); if(!host)return;
    const bookingType=document.getElementById("abParkingOnly")?.closest(".admin-booking-field"),room=document.getElementById("abRoom")?.closest(".admin-booking-field"),calendar=host.querySelector(".ab-calendar-section");
    if(!bookingType||!room||!calendar)return;
    bookingType.style.order="1"; room.style.order="2"; bookingType.style.gridColumn="auto"; room.style.gridColumn="auto"; calendar.style.order="3"; calendar.style.gridColumn="1 / -1";
    Array.from(host.children).forEach(el=>{if(el!==bookingType&&el!==room&&el!==calendar&&el.classList.contains("admin-booking-field"))el.style.order="4";});
  };
  fetch("create-booking-public.js?v=20260811-8",{cache:"no-store"})
    .then(r=>{if(!r.ok)throw new Error("Unable to load guest booking module.");return r.text();})
    .then(code=>{
      // Run the public guest-booking module unchanged. This makes the admin
      // calendar use the same availability calculation and API data source.
      run(code);
      syncGuestAvailability(); removeDuplicateCalendarCards(); arrangeBookingFields();
      const b=document.getElementById("navNewBooking"); if(b)b.addEventListener("click",()=>{setTimeout(()=>{removeDuplicateCalendarCards();arrangeBookingFields();},0);setTimeout(arrangeBookingFields,50);});
    })
    .catch(err=>console.error("Admin guest booking module failed to load:",err));
})();