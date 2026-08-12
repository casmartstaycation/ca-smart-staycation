(() => {
  const run = code => {
    const script = document.createElement('script');
    script.textContent = code;
    // If the DOM is already ready (DOMContentLoaded has fired), dispatch a
    // synthetic event so the injected module's DOMContentLoaded listener fires.
    const alreadyReady = document.readyState !== 'loading';
    document.head.appendChild(script);
    if (alreadyReady) {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }
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
  fetch("create-booking-public.js?v=20260811-9",{cache:"no-store"})
    .then(r=>{if(!r.ok)throw new Error("Unable to load guest booking module.");return r.text();})
    .then(code=>{
      // Keep the public guest-calendar availability source and rules. The only
      // admin-specific adjustment is the standard hotel checkout rule:
      // a reservation's check-in date is allowed as the previous guest's
      // checkout date, while every occupied night in between remains blocked.
      code=code.replace(
        'if(x<today||unavailable(x)){c.disabled=true;c.classList.add(x<today?"disabled":"booked")}else c.onclick=()=>pickDate(x);',
        'const booked=unavailable(x);const checkoutCandidate=!!selectedIn&&!selectedOut&&x>selectedIn;if(x<today){c.disabled=true;c.classList.add("disabled")}else if(booked&&!checkoutCandidate){c.disabled=true;c.classList.add("booked")}else c.onclick=()=>pickDate(x);if(booked)c.classList.add("booked");'
      );
      code=code.replace(
        'if(blocked||unavailable(x)){alert("Your selected stay contains booked dates. Please choose another date range.");selectedIn=null;selectedOut=null}',
        'if(blocked){alert("Your selected stay contains booked dates. Please choose another date range.");selectedIn=null;selectedOut=null}'
      );
      run(code);
      syncGuestAvailability(); removeDuplicateCalendarCards(); arrangeBookingFields();
      const b=document.getElementById("navNewBooking"); if(b)b.addEventListener("click",()=>{setTimeout(()=>{removeDuplicateCalendarCards();arrangeBookingFields();},0);setTimeout(arrangeBookingFields,50);});
    })
    .catch(err=>console.error("Admin guest booking module failed to load:",err));
})();