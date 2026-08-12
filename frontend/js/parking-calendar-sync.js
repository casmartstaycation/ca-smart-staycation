(function(){
'use strict';
const API='https://ca-smart-staycation-muqd.onrender.com/api';
const TERMINAL=new Set(['cancelled','checked out','expired']);
let bookings=[];
function active(b){return b&&!TERMINAL.has(String(b.bookingStatus||'').trim().toLowerCase());}
function hasRoom(b){return !!(b?.room?._id||b?.room);}
function hasParking(b){return b?.parkingOnly===true||String(b?.parkingOnly).toLowerCase()==='true'||!!(b?.parking?._id||b?.parking);}
function date(v){if(!v)return null;const s=String(v);if(/^\d{4}-\d{2}-\d{2}/.test(s)){const p=s.slice(0,10).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function overlaps(d,b){const a=date(b.checkIn),z=date(b.checkOut);return !!(a&&z&&z>a&&d>=a&&d<z);}
function type(){return String(document.getElementById('bookingType')?.value||'unit').toLowerCase();}
function roomId(){return String(document.getElementById('room')?.value||'');}
function occupied(d){const t=type();return bookings.some(b=>{if(!active(b)||!overlaps(d,b))return false;if(t==='parking')return hasParking(b);if(t==='both')return hasParking(b)||(hasRoom(b)&&String(b.room?._id||b.room)===roomId());return hasRoom(b)&&String(b.room?._id||b.room)===roomId();});}
function calendarMonth(){if(typeof currentMonth==='number'&&typeof currentYear==='number')return {month:currentMonth,year:currentYear};const title=document.getElementById('calendarTitle')?.textContent||'';const m=title.match(/^(.+)\s+(\d{4})$/);if(m){const d=new Date(m[1]+' 1, '+m[2]);if(!Number.isNaN(d.getTime()))return {month:d.getMonth(),year:d.getFullYear()};}const n=new Date();return {month:n.getMonth(),year:n.getFullYear()};}
function apply(){const grid=document.getElementById('calendarGrid');if(!grid)return;const t=type();if(!['unit','parking','both'].includes(t))return;const {month,year}=calendarMonth();grid.querySelectorAll('.calendar-day:not(.empty)').forEach(c=>{const n=Number(String(c.textContent||'').trim());if(!n)return;const d=new Date(year,month,n);if(occupied(d)){c.classList.add('booked');c.title='Already booked';c.setAttribute('aria-disabled','true');}});}
async function refresh(){try{const r=await fetch(API+'/bookings',{cache:'no-store',headers:{Accept:'application/json'}});const j=await r.json().catch(()=>({}));bookings=r.ok?(Array.isArray(j?.data)?j.data:(Array.isArray(j)?j:[])):[];}catch(e){console.warn('Booking availability refresh failed',e);}apply();}
function schedule(){setTimeout(apply,0);setTimeout(apply,100);setTimeout(apply,500);}
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('bookingType')?.addEventListener('change',()=>{refresh();schedule();});document.getElementById('room')?.addEventListener('change',schedule);const grid=document.getElementById('calendarGrid');if(grid)new MutationObserver(()=>schedule()).observe(grid,{childList:true,subtree:true});refresh();schedule();});
window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.caRefreshBookingAvailability=refresh;
})();