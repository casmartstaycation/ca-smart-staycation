(function(){
  'use strict';
  const INCLUDED_GUESTS = 2;
  const EXTRA_GUEST_FEE = 300;
  const SECURITY_DEPOSIT = 1000;
  const PARKING_RATE = 500;
  const ROOM_RATE = 2800;

  function money(n){return `₱${Number(n||0).toLocaleString('en-PH')}`;}
  function dateValue(id){
    const el=document.getElementById(id);
    if(!el?.value)return null;
    const d=new Date(`${el.value}T00:00:00`);
    return Number.isNaN(d.getTime())?null:d;
  }
  function nights(){
    const a=dateValue('checkIn'),b=dateValue('checkOut');
    if(!a||!b||b<=a)return 0;
    return Math.round((b-a)/86400000);
  }
  function bookingType(){return String(document.getElementById('bookingType')?.value||'unit').toLowerCase();}
  function guests(){return Math.max(0,Number(document.getElementById('guests')?.value||0));}
  function selectedRoom(){
    const select=document.getElementById('room');
    if(!select)return null;
    const option=select.options[select.selectedIndex];
    return option?.value?option:null;
  }
  function roomRate(){
    const option=selectedRoom();
    const raw=option?.dataset?.price||option?.dataset?.rate;
    const parsed=Number(raw);
    return Number.isFinite(parsed)&&parsed>=0?parsed:ROOM_RATE;
  }
  function parkingAmount(n){
    const type=bookingType();
    return (type==='parking'||type==='both') ? PARKING_RATE*n : 0;
  }
  function calculate(){
    const type=bookingType();
    const n=nights();
    const hasAccommodation=type==='unit'||type==='both';
    const roomAmount=hasAccommodation ? roomRate()*n : 0;
    const extraGuests=hasAccommodation ? Math.max(0,guests()-INCLUDED_GUESTS) : 0;
    const extraAmount=extraGuests*EXTRA_GUEST_FEE*n;
    const parking=parkingAmount(n);
    const deposit=hasAccommodation ? SECURITY_DEPOSIT : 0;
    const total=roomAmount+extraAmount+parking+deposit;
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=money(value);};
    set('roomAmount',roomAmount);
    set('extraGuestAmount',extraAmount);
    set('parkingAmount',parking);
    set('securityDepositAmount',deposit);
    set('totalAmount',total);
    return total;
  }
  function bind(){
    ['bookingType','room','guests','children','checkIn','checkOut'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      el.addEventListener('change',calculate);
      el.addEventListener('input',calculate);
    });
    calculate();
    window.setTimeout(calculate,100);
    window.setTimeout(calculate,500);
    window.setTimeout(calculate,1500);
  }
  window.caBookingSummaryCalculate=calculate;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
