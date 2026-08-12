/* Parking availability synchronization.
   Parking Only reservations have no accommodation room. This bridge uses
   the booking's actual reserved resources and the booking dates, then marks
   the same dates in Parking Only and Accommodation + Parking modes. */
(function(){
'use strict';
const API='/api';
let bookings=[];
const TERMINAL=new Set(['cancelled','checked out','expired']);
function terminal(b){return TERMINAL.has(String(b?.bookingStatus||'').trim().toLowerCase());}
function id(v){if(!v)return '';if(typeof v==='object')return String(v._id||v.id||'');return String(v);}
function isParkingBooking(b){
  if(!b||terminal(b))return false;
  if(b.parkingOnly===true||String(b.parkingOnly).toLowerCase()==='true')return true;
  const type=String(b.bookingType||b.type||b.bookingCategory||'').trim().toLowerCase().replace(/[\s_-]/g,'');
  if(type==='parking'||type==='parkingonly')return true;
  if(id(b.parking)||id(b.parkingSlot)||String(b.parkingNumber||'').trim())return true;
  return !id(b.room)&&!id(b.unit);
}
function date(v){if(!v)return null;const s=String(v);if(/^\d{4}-\d{2}-\d{2}/.test(s)){const p=s.slice(0,10).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function overlaps(d,b){const a=date(b.checkIn),z=date(b.checkOut);return !!(a&&z&&z>a&&d>=a&&d<z);}
function month(){const title=document.getElementById('calendarTitle')?.textContent||'';const m=title.match(/^(.+)\s+(\d{4})$/);if(m){const d=new Date(`${m[1]} 1, ${m[2]}`);if(!Number.isNaN(d.getTime()))return{month:d.getMonth(),year:d.getFullYear()};}return{month:new Date().getMonth(),year:new Date().getFullYear()};}
function apply(){const type=String(document.getElementById('bookingType')?.value||'').trim().toLowerCase();if(type!=='parking'&&type!=='both')return;const grid=document.getElementById('calendarGrid');if(!grid)return;const {month:mo,year}=month();grid.querySelectorAll('.calendar-day:not(.empty)').forEach(cell=>{const n=Number(String(cell.textContent||'').trim());if(!n)return;const d=new Date(year,mo,n);d.setHours(0,0,0,0);if(bookings.some(b=>isParkingBooking(b)&&overlaps(d,b))){cell.classList.add('booked');cell.classList.remove('checkin','checkout','selected-range');cell.title='Parking already booked';cell.setAttribute('aria-disabled','true');cell.style.pointerEvents='none';}});}
async function refresh(){try{const r=await fetch(`${API}/bookings?availability=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});const j=await r.json().catch(()=>null);const list=Array.isArray(j?.data)?j.data:(Array.isArray(j)?j:[]);if(r.ok)bookings=list;console.log('PARKING AVAILABILITY:',bookings.filter(isParkingBooking).map(b=>({checkIn:b.checkIn,checkOut:b.checkOut,parkingOnly:b.parkingOnly,parking:b.parking,room:b.room,bookingStatus:b.bookingStatus})));}catch(e){console.warn('Parking availability refresh failed:',e);}apply();}
function schedule(){setTimeout(apply,0);setTimeout(apply,100);setTimeout(apply,300);setTimeout(apply,800);}
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('bookingType')?.addEventListener('change',()=>{refresh();schedule();});const grid=document.getElementById('calendarGrid');if(grid)new MutationObserver(()=>schedule()).observe(grid,{childList:true,subtree:true});refresh();schedule();});
window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.caRefreshParkingCalendar=refresh;
})();
