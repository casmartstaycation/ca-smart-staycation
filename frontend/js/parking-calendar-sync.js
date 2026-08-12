/* Parking calendar availability bridge.
   The main script owns rendering and bookedDates. This bridge refreshes the
   source data and then asks the main renderer to redraw, avoiding a second
   calendar implementation fighting with script.js. */
(function(){
'use strict';
const API='https://ca-smart-staycation-muqd.onrender.com/api';
const terminal=s=>['cancelled','checked out','expired'].includes(String(s||'').trim().toLowerCase());
function hasParking(b){
  return b && (
    b.parkingOnly===true || String(b.parkingOnly).toLowerCase()==='true' ||
    String(b.bookingType||'').trim().toLowerCase().replace(/[\s_-]/g,'')==='parking' ||
    String(b.type||'').trim().toLowerCase().replace(/[\s_-]/g,'')==='parking' ||
    !!b.parking || !!b.parkingSlot
  );
}
async function refresh(){
  try{
    const r=await fetch(API+'/bookings',{cache:'no-store',headers:{Accept:'application/json'}});
    const j=await r.json().catch(()=>null);
    const list=Array.isArray(j?.data)?j.data:(Array.isArray(j)?j:[]);
    if(!r.ok)return;
    /* Update the exact array used by script.js. */
    if(Array.isArray(window.bookedDates)){
      window.bookedDates.length=0;
      list.filter(b=>!terminal(b.bookingStatus)).forEach(b=>window.bookedDates.push(b));
    }
    /* script.js's calendar uses the global bookedDates variable. Its
       isDateBooked() already checks bookingHasParking(), so temporarily
       provide a parking marker for parking-only records when needed. */
    list.forEach(b=>{
      if(hasParking(b) && !b.parking && !b.parkingSlot){ b.parking={_id:'parking-slot'}; }
    });
    if(typeof window.renderCalendar==='function') window.renderCalendar();
  }catch(e){console.warn('Parking availability refresh failed:',e);}
}
function run(){setTimeout(refresh,0);setTimeout(refresh,1000);}
document.addEventListener('DOMContentLoaded',run);
const type=document.getElementById('bookingType');
if(type)type.addEventListener('change',run);
window.addEventListener('focus',run);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run();});
window.caRefreshParkingCalendar=refresh;
})();