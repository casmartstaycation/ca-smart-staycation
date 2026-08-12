(function(){
'use strict';
const API='https://ca-smart-staycation-muqd.onrender.com/api';
const TERMINAL=new Set(['cancelled','checked out','expired']);
let bookings=[];
function active(b){return b&&!TERMINAL.has(String(b.bookingStatus||'').trim().toLowerCase());}
function bookingTypeOf(b){return String(b?.bookingType||b?.type||'').trim().toLowerCase().replace(/[_-]+/g,' ');}
function isParkingOnlyBooking(b){const t=bookingTypeOf(b);return b?.parkingOnly===true||String(b?.parkingOnly).toLowerCase()==='true'||t==='parking'||t==='parking only'||t==='parkingonly';}
function hasRoom(b){return !!(b?.room?._id||b?.room||b?.unit?._id||b?.unit);}
function hasParking(b){return isParkingOnlyBooking(b)||!!(b?.parking?._id||b?.parking)||!!(b?.parkingSlot?._id||b?.parkingSlot);}
function date(v){if(!v)return null;const s=String(v);if(/^\d{4}-\d{2}-\d{2}/.test(s)){const p=s.slice(0,10).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function overlaps(d,b){const a=date(b.checkIn),z=date(b.checkOut);return !!(a&&z&&z>a&&d>=a&&d<z);}
function selectedType(){return String(document.getElementById('bookingType')?.value||'unit').trim().toLowerCase();}
function selectedRoom(){return String(document.getElementById('room')?.value||'');}
function occupied(d){const t=selectedType();return bookings.some(b=>{if(!active(b)||!overlaps(d,b))return false;const parking=hasParking(b),room=hasRoom(b),rid=String(b?.room?._id||b?.room||b?.unit?._id||b?.unit||'');if(t==='parking')return parking;if(t==='both')return parking||(room&&(!selectedRoom()||rid===selectedRoom()));return room&&rid===selectedRoom();});}
function calendarMonth(){if(typeof window.currentMonth==='number'&&typeof window.currentYear==='number')return{month:window.currentMonth,year:window.currentYear};const title=document.getElementById('calendarTitle')?.textContent||'';const m=title.match(/^(.+)\s+(\d{4})$/);if(m){const d=new Date(m[1]+' 1, '+m[2]);if(!Number.isNaN(d.getTime()))return{month:d.getMonth(),year:d.getFullYear()};}const n=new Date();return{month:n.getMonth(),year:n.getFullYear()};}
function apply(){const grid=document.getElementById('calendarGrid');if(!grid)return;const {month,year}=calendarMonth();grid.querySelectorAll('.calendar-day:not(.empty)').forEach(c=>{const n=Number(String(c.textContent||'').trim());if(!n)return;const d=new Date(year,month,n);if(occupied(d)){c.classList.add('booked');c.classList.remove('disabled');c.title=selectedType()==='parking'?'Parking already booked':'Already booked';c.setAttribute('aria-disabled','true');}});}
async function refresh(){try{const r=await fetch(API+'/bookings',{cache:'no-store',headers:{Accept:'application/json'}});const j=await r.json().catch(()=>({}));const data=Array.isArray(j?.data)?j.data:(Array.isArray(j)?j:[]);if(r.ok){bookings=data;console.log('Guest calendar availability loaded:',bookings.length,'bookings');}}catch(e){console.warn('Booking availability refresh failed',e);}apply();}
function schedule(){setTimeout(apply,0);setTimeout(apply,100);setTimeout(apply,300);setTimeout(refresh,700);setTimeout(apply,1200);}
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('bookingType')?.addEventListener('change',schedule);document.getElementById('room')?.addEventListener('change',schedule);const grid=document.getElementById('calendarGrid');if(grid)new MutationObserver(()=>{setTimeout(apply,0);}).observe(grid,{childList:true,subtree:true});refresh();schedule();});
window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.caRefreshBookingAvailability=refresh;
})();