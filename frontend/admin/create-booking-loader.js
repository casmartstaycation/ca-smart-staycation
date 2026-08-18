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
  const ensureAdminBookingModal = () => {
    if (document.getElementById("adminBookingModal")) return;
    const modal = document.createElement("div");
    modal.id = "adminBookingModal";
    modal.className = "admin-booking-modal";
    modal.hidden = true;
    modal.innerHTML = `<div class="admin-booking-card" role="dialog" aria-modal="true" aria-labelledby="adminBookingTitle"><div class="admin-booking-head"><div><p class="eyebrow">CA SMART STAYCATION</p><h2 id="adminBookingTitle">New Guest Booking</h2><p class="subtitle">Create a reservation directly from the admin account.</p></div><button type="button" class="admin-booking-close" id="adminBookingClose" aria-label="Close">×</button></div><form id="adminBookingForm"><div class="admin-booking-grid"><div class="admin-booking-field"><label for="abParkingOnly">Booking Type</label><select id="abParkingOnly"></select></div><div class="admin-booking-field"><label for="abRoom">Accommodation</label><select id="abRoom"></select></div><div class="admin-booking-field"><label for="abCheckIn">Check-in</label><input id="abCheckIn" type="date"></div><div class="admin-booking-field"><label for="abCheckOut">Check-out</label><input id="abCheckOut" type="date"></div><div class="admin-booking-field"><label for="abParking">Parking</label><select id="abParking"></select></div><div class="admin-booking-field"><label for="abAdults">Adults</label><input id="abAdults" type="number" min="0" max="4" value="2"></div><div class="admin-booking-field"><label for="abChildren">Children (0–2)</label><input id="abChildren" type="number" min="0" max="2" value="0"></div><div class="admin-booking-field"><label for="abFirstName">First Name</label><input id="abFirstName" required></div><div class="admin-booking-field"><label for="abLastName">Last Name</label><input id="abLastName" required></div><div class="admin-booking-field"><label for="abEmail">Email</label><input id="abEmail" type="email" required></div><div class="admin-booking-field"><label for="abMobile">Mobile</label><input id="abMobile" required></div><div class="admin-booking-field full"><label for="abAddress">Address</label><input id="abAddress"></div><div class="admin-booking-field"><label for="abPaymentStatus">Payment Status</label><select id="abPaymentStatus"><option value="Paid">Paid</option><option value="Pending">Pending</option></select></div><div class="admin-booking-field"><label for="abPaymentReference">Payment Reference</label><input id="abPaymentReference"></div><div class="admin-booking-field"><label for="abNotes">Notes</label><textarea id="abNotes"></textarea></div><div class="admin-booking-field"><label for="abVehicleBrand">Vehicle Brand</label><input id="abVehicleBrand"></div><div class="admin-booking-field"><label for="abVehicleModel">Vehicle Model</label><input id="abVehicleModel"></div><div class="admin-booking-field"><label for="abVehicleColor">Vehicle Color</label><input id="abVehicleColor"></div><div class="admin-booking-field"><label for="abPlateNumber">Plate Number</label><input id="abPlateNumber"></div></div><div class="admin-booking-docs"><h3>Guest Documents</h3><p>Upload required identification documents.</p><div class="admin-booking-docs-grid"><div class="admin-booking-doc"><label for="abGovernmentId">Government ID <span>*</span></label><input id="abGovernmentId" type="file" accept="image/*,.pdf"></div><div class="admin-booking-doc"><label for="abDriversLicense">Driver's License <span>* for parking</span></label><input id="abDriversLicense" type="file" accept="image/*,.pdf"></div></div></div><div id="abSummary" class="admin-booking-summary"></div><div id="abError" class="admin-booking-error" aria-live="polite"></div><div class="admin-booking-actions"><button type="button" class="admin-booking-cancel" id="adminBookingCancel">Cancel</button><button type="submit" class="admin-booking-save">Create Booking</button></div></form></div>`;
    document.body.appendChild(modal);
  };
  const syncGuestAvailability=()=>{const grid=document.getElementById("abCalendarGrid");if(grid)grid.dataset.availabilitySync="live"};
  const removeDuplicateCalendarCards=()=>{document.querySelectorAll("#adminBookingModal .ab-calendar-section").forEach((card,index)=>{if(index>0)card.remove()})};
  const arrangeBookingFields=()=>{const host=document.querySelector("#adminBookingForm .admin-booking-grid");if(!host)return;const bookingType=document.getElementById("abParkingOnly")?.closest(".admin-booking-field"),room=document.getElementById("abRoom")?.closest(".admin-booking-field"),calendar=host.querySelector(".ab-calendar-section");if(!bookingType||!room||!calendar)return;bookingType.style.order="1";room.style.order="2";bookingType.style.gridColumn="auto";room.style.gridColumn="auto";calendar.style.order="3";calendar.style.gridColumn="1 / -1";Array.from(host.children).forEach(el=>{if(el!==bookingType&&el!==room&&el!==calendar&&el.classList.contains("admin-booking-field"))el.style.order="4"})};
  const updateParkingOnlyInfo=()=>{
    const summary=document.getElementById("abSummary");
    if(!summary)return;
    const parkingOnly=document.getElementById("abParkingOnly")?.value==="parking";
    const heading=Array.from(summary.querySelectorAll("h3")).find(h=>h.textContent.trim()==="Booking Information");
    if(!heading)return;
    let node=heading;
    while(node){
      node.style.display=parkingOnly?"none":"";
      if(node.nextElementSibling?.tagName==="HR")break;
      node=node.nextElementSibling;
    }
    heading.style.display=parkingOnly?"none":"";
  };
  ensureAdminBookingModal();
  fetch("create-booking-public.js?v=20260815-2",{cache:"no-store"})
    .then(r=>{if(!r.ok)throw new Error("Unable to load guest booking module.");return r.text();})
    .then(code=>{
      code=code.replace(/Accept:\"application\/json`/g,'Accept:\"application/json\"');
      code=code.replace('if(x<today||unavailable(x)){c.disabled=true;c.classList.add(x<today?"disabled":"booked")}else c.onclick=()=>pickDate(x);','const booked=unavailable(x);const checkoutCandidate=!!selectedIn&&!selectedOut&&x>selectedIn;if(x<today){c.disabled=true;c.classList.add("disabled")}else if(booked&&!checkoutCandidate){c.disabled=true;c.classList.add("booked")}else c.onclick=()=>pickDate(x);if(booked)c.classList.add("booked");');
      code=code.replace('if(blocked||unavailable(x)){alert("Your selected stay contains booked dates. Please choose another date range.");selectedIn=null;selectedOut=null}','if(blocked){alert("Your selected stay contains booked dates. Please choose another date range.");selectedIn=null;selectedOut=null}');
      run(code);
      syncGuestAvailability();removeDuplicateCalendarCards();arrangeBookingFields();updateParkingOnlyInfo();
      const summary=document.getElementById("abSummary");
      if(summary){
        const observer=new MutationObserver(()=>updateParkingOnlyInfo());
        observer.observe(summary,{childList:true,subtree:true});
      }
      document.getElementById("abParkingOnly")?.addEventListener("change",()=>setTimeout(updateParkingOnlyInfo,0));
      const b=document.getElementById("navNewBooking");if(b)b.addEventListener("click",()=>{setTimeout(()=>{removeDuplicateCalendarCards();arrangeBookingFields();updateParkingOnlyInfo()},0);setTimeout(updateParkingOnlyInfo,50)});
    })
    .catch(err=>console.error("Admin guest booking module failed to load:",err));
})();