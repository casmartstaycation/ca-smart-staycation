(function(){
  'use strict';
  const API='https://ca-smart-staycation-muqd.onrender.com/api';
  const TERMINAL=new Set(['Cancelled','Checked Out','Expired']);
  let bookings=[];
  let applying=false;

  function dateOnly(value){
    if(!value)return null;
    const s=String(value);
    if(/^\d{4}-\d{2}-\d{2}/.test(s)){
      const p=s.slice(0,10).split('-').map(Number);
      return new Date(p[0],p[1]-1,p[2]);
    }
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return null;
    return new Date(d.getFullYear(),d.getMonth(),d.getDate());
  }

  function activeParkingBooking(b){
    if(!b||TERMINAL.has(String(b.bookingStatus||'')))return false;
    return b.parkingOnly===true || b.parkingOnly==='true' || Boolean(b.parking?._id||b.parking);
  }

  function selectedType(){
    return String(document.getElementById('bookingType')?.value||'unit').toLowerCase();
  }

  function overlapsDay(day,b){
    const start=dateOnly(b.checkIn),end=dateOnly(b.checkOut);
    if(!start||!end||end<=start)return false;
    return day>=start&&day<end;
  }

  function getCalendarMonth(){
    if(typeof window.currentMonth==='number'&&typeof window.currentYear==='number'){
      return {month:window.currentMonth,year:window.currentYear};
    }
    const title=document.getElementById('calendarTitle')?.textContent?.trim()||'';
    const m=title.match(/^(.+)\s+(\d{4})$/);
    if(m){
      const parsed=new Date(`${m[1]} 1, ${m[2]}`);
      if(!Number.isNaN(parsed.getTime()))return {month:parsed.getMonth(),year:parsed.getFullYear()};
    }
    const now=new Date();
    return {month:now.getMonth(),year:now.getFullYear()};
  }

  function apply(){
    if(applying)return;
    const type=selectedType();
    if(type!=='both'&&type!=='parking')return;
    const grid=document.getElementById('calendarGrid');
    if(!grid)return;
    const list=bookings.filter(activeParkingBooking);
    if(!list.length)return;
    const {month,year}=getCalendarMonth();
    applying=true;
    try{
      [...grid.querySelectorAll('.calendar-day:not(.empty):not(.disabled)')].forEach(cell=>{
        const day=Number(String(cell.textContent||'').trim());
        if(!day)return;
        const d=new Date(year,month,day);
        if(list.some(b=>overlapsDay(d,b))){
          cell.classList.add('booked');
          cell.title='Parking already booked';
          cell.setAttribute('aria-disabled','true');
        }
      });
    }finally{applying=false;}
  }

  async function refresh(){
    try{
      const r=await fetch(`${API}/bookings`,{cache:'no-store',headers:{Accept:'application/json'}});
      const j=await r.json().catch(()=>({}));
      const data=Array.isArray(j.data)?j.data:(Array.isArray(j)?j:[]);
      if(r.ok)bookings=data;
    }catch(e){console.warn('Parking calendar sync failed',e)}
    apply();
  }

  function scheduleApply(){
    setTimeout(apply,0);
    setTimeout(apply,100);
    setTimeout(apply,400);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const type=document.getElementById('bookingType');
    if(type)type.addEventListener('change',()=>{refresh();scheduleApply()});
    const grid=document.getElementById('calendarGrid');
    if(grid){
      const observer=new MutationObserver(()=>{if(!applying&& (selectedType()==='both'||selectedType()==='parking'))scheduleApply()});
      observer.observe(grid,{childList:true,subtree:true});
    }
    refresh();
    scheduleApply();
  });

  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
