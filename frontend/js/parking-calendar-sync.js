/* Parking-only calendar renderer bridge.
   script.js keeps bookedDates in a top-level let, so it is NOT exposed as
   window.bookedDates. This file therefore uses the API directly and marks
   the already-rendered calendar cells after script.js renders them. */
(function(){
'use strict';
const API='https://ca-smart-staycation-muqd.onrender.com/api';
let parkingBookings=[];
const terminal=s=>['cancelled','checked out','expired'].includes(String(s||'').trim().toLowerCase());
function isParkingBooking(b){
  if(!b||terminal(b.bookingStatus)) return false;
  if(b.parkingOnly===true||String(b.parkingOnly).toLowerCase()==='true') return true;
  if(b.parking||b.parkingSlot) return true;
  const t=String(b.bookingType||b.type||'').toLowerCase().replace(/[\s_-]/g,'');
  return t==='parking'||t==='parkingonly';
}
function day(v){
  if(!v)return null;
  const s=String(v);
  if(/^\d{4}-\d{2}-\d{2}/.test(s)){const p=s.slice(0,10).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
  const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
}
function overlaps(d,b){const a=day(b.checkIn),z=day(b.checkOut);return !!(a&&z&&d>=a&&d<z);}
function parkingBooked(d){return parkingBookings.some(b=>isParkingBooking(b)&&overlaps(d,b));}
function currentMonth(){
  const title=document.getElementById('calendarTitle')?.textContent||'';
  const m=title.match(/^(.+)\s+(\d{4})$/);
  if(m){const d=new Date(m[1]+' 1, '+m[2]);if(!Number.isNaN(d.getTime()))return {month:d.getMonth(),year:d.getFullYear()};}
  const n=new Date();return {month:n.getMonth(),year:n.getFullYear()};
}
function applyParking(){
  const type=String(document.getElementById('bookingType')?.value||'').toLowerCase();
  if(type!=='parking'&&type!=='both')return;
  const grid=document.getElementById('calendarGrid');if(!grid)return;
  const {month,year}=currentMonth();
  grid.querySelectorAll('.calendar-day:not(.empty)').forEach(cell=>{
    const n=parseInt(cell.textContent.trim(),10);if(!n)return;
    const d=new Date(year,month,n);d.setHours(0,0,0,0);
    if(parkingBooked(d)){
      cell.classList.add('booked');
      cell.classList.remove('checkin','checkout','selected-range');
      cell.title='Parking already booked';
      cell.setAttribute('aria-disabled','true');
      cell.style.pointerEvents='none';
    }
  });
}
async function refresh(){
  try{
    const r=await fetch(API+'/bookings',{cache:'no-store',headers:{Accept:'application/json'}});
    const j=await r.json().catch(()=>null);
    const list=Array.isArray(j?.data)?j.data:(Array.isArray(j)?j:[]);
    if(r.ok)parkingBookings=list;
  }catch(e){console.warn('Parking calendar availability failed:',e);}
  applyParking();
}
function schedule(){setTimeout(applyParking,0);setTimeout(applyParking,50);setTimeout(applyParking,250);setTimeout(applyParking,700);}
document.addEventListener('DOMContentLoaded',()=>{
  const type=document.getElementById('bookingType');
  type?.addEventListener('change',()=>{refresh();schedule();});
  const grid=document.getElementById('calendarGrid');
  if(grid)new MutationObserver(schedule).observe(grid,{childList:true,subtree:true});
  refresh();schedule();
});
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.caRefreshParkingCalendar=refresh;
})();