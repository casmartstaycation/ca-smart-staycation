(() => {
  'use strict';
  const API='https://ca-smart-staycation-muqd.onrender.com/api';
  let parkingBookings=[];
  let timer=null;
  const type=()=>String(document.getElementById('bookingType')?.value||'unit').trim().toLowerCase().replace(/[\s_-]/g,'');
  const parkingMode=()=>type()==='parking'||type()==='parkingonly'||type()==='both'||type()==='accommodationparking';
  const localDate=v=>{if(!v)return null;const s=String(v);if(/^\d{4}-\d{2}-\d{2}/.test(s)){const p=s.slice(0,10).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());};
  const occupied=d=>parkingBookings.some(b=>{const s=localDate(b.checkIn),e=localDate(b.checkOut);return s&&e&&d>=s&&d<e;});
  const month=()=>{const title=document.getElementById('calendarTitle')?.textContent?.trim()||'';const m=title.match(/^(.+)\s+(\d{4})$/);if(!m)return null;const d=new Date(m[1]+' 1, '+m[2]);return Number.isNaN(d.getTime())?null:{month:d.getMonth(),year:d.getFullYear()};};
  function apply(){if(!parkingMode())return;const grid=document.getElementById('calendarGrid'),m=month();if(!grid||!m)return;grid.querySelectorAll('.calendar-day:not(.empty)').forEach(cell=>{const n=Number(String(cell.textContent||'').trim());if(!n)return;const d=new Date(m.year,m.month,n);d.setHours(0,0,0,0);if(occupied(d)){cell.classList.add('booked');cell.classList.remove('disabled');cell.title='Parking already booked';cell.setAttribute('aria-disabled','true');cell.style.pointerEvents='none';}});}
  async function refresh(){try{const r=await fetch(`${API}/parking/availability?ts=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});const j=await r.json();parkingBookings=r.ok&&Array.isArray(j?.data)?j.data:[];apply();}catch(e){console.warn('Parking availability refresh failed',e);}}
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{refresh();setTimeout(apply,150);setTimeout(apply,600);},0);}
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('bookingType')?.addEventListener('change',schedule);const grid=document.getElementById('calendarGrid');if(grid)new MutationObserver(()=>parkingMode()&&apply()).observe(grid,{childList:true,subtree:true});schedule();});
  window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
})();