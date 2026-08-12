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
      const m=s.slice(0,10).split('-').map(Number);
      return new Date(m[0],m[1]-1,m[2]);
    }
    const d=new Date(value); if(Number.isNaN(d.getTime()))return null;
    return new Date(d.getFullYear(),d.getMonth(),d.getDate());
  }
  function activeParkingBooking(b){
    if(!b||TERMINAL.has(String(b.bookingStatus||'')))return false;
    return Boolean(b.parkingOnly===true || b.parking?._id || b.parking);
  }
  function parkingBookings(){return bookings.filter(activeParkingBooking);}
  function selectedType(){return String(document.getElementById('bookingType')?.value||'unit').toLowerCase();}
  function overlapsDay(day,b){
    const start=dateOnly(b.checkIn),end=dateOnly(b.checkOut);
    if(!start||!end||end<=start)return false;
    return day>=start&&day<end;
  }
  function apply(){
    if(applying)return;
    const grid=document.getElementById('calendarGrid');
    if(!grid)return;
    const type=selectedType();
    if(type!=='both'&&type!=='parking')return;
    const list=parkingBookings();
    if(!list.length)return;
    applying=true;
    try{
      const cells=[...grid.querySelectorAll('.calendar-day:not(.empty)')];
      const title=document.getElementById('calendarTitle');
      if(!title)return;
      const text=title.textContent.trim();
      const parts=text.match(/^(.+)\s+(\d{4})$/); if(!parts)return;
      const month=new Date(`${parts[1]} 1, ${parts[2]}`).getMonth();
      const year=Number(parts[2]);
      cells.forEach(cell=>{
        const day=Number(cell.textContent.trim());
        if(!day)return;
        const d=new Date(year,month,day);
        if(list.some(b=>overlapsDay(d,b))){
          cell.classList.add('booked');
          cell.title='Parking already booked';
          cell.replaceChildren(document.createTextNode(String(day)));
        }
      });
    }finally{applying=false;}
  }
  async function refresh(){
    try{
      const r=await fetch(`${API}/bookings`,{cache:'no-store',headers:{Accept:'application/json'}});
      const j=await r.json();
      if(r.ok&&Array.isArray(j.data))bookings=j.data;
    }catch(e){console.warn('Parking calendar sync failed',e)}
    apply();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const type=document.getElementById('bookingType');
    if(type)type.addEventListener('change',()=>setTimeout(()=>{apply();refresh()},50));
    const grid=document.getElementById('calendarGrid');
    if(grid){
      const observer=new MutationObserver(()=>{if(!applying)setTimeout(apply,0)});
      observer.observe(grid,{childList:true});
    }
    refresh();
  });
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
