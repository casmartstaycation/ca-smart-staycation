(function(){
  'use strict';
  const INCLUDED_GUESTS=2, EXTRA_GUEST_FEE=300, SECURITY_DEPOSIT=1000, PARKING_RATE=500, ROOM_RATE=2800;
  const money=n=>'₱'+Number(n||0).toLocaleString('en-PH');
  const value=id=>document.getElementById(id)?.value||'';
  function date(id){const v=value(id);if(!v)return null;const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?null:d;}
  function nights(){const a=date('checkIn'),b=date('checkOut');return a&&b&&b>a?Math.round((b-a)/86400000):0;}
  function type(){return String(value('bookingType')||'unit').toLowerCase();}
  function room(){const id=value('room');return Array.isArray(window.rooms)?window.rooms.find(r=>String(r._id)===String(id)):null;}
  function set(id,n){const e=document.getElementById(id);if(e)e.textContent=money(n);}
  function calculate(){
    const t=type(), n=nights(), accommodation=t==='unit'||t==='both';
    let roomTotal=0, extraTotal=0, parkingTotal=0, deposit=0;
    if(n>0){
      if(accommodation){
        const r=room(), rate=Number(r?.price);
        roomTotal=(Number.isFinite(rate)&&rate>=0?rate:ROOM_RATE)*n;
        const guestCount=Math.max(0,Number(value('guests')||0));
        extraTotal=Math.max(0,guestCount-INCLUDED_GUESTS)*EXTRA_GUEST_FEE*n;
        deposit=SECURITY_DEPOSIT;
      }
      if(t==='parking'||t==='both') parkingTotal=PARKING_RATE*n;
    }
    const total=roomTotal+extraTotal+parkingTotal+deposit;
    set('roomAmount',roomTotal);set('extraGuestAmount',extraTotal);set('parkingAmount',parkingTotal);set('securityDepositAmount',deposit);set('totalAmount',total);
    return total;
  }
  // Replace the original calculation so calls from calendar/booking-type code
  // cannot overwrite this corrected summary with the old capacity-based logic.
  window.calculateTotal=calculate;
  window.caBookingSummaryCalculate=calculate;
  function bind(){
    ['bookingType','room','guests','children','checkIn','checkOut'].forEach(id=>{
      const e=document.getElementById(id);if(!e)return;
      e.addEventListener('change',calculate);e.addEventListener('input',calculate);
    });
    calculate();
    [100,500,1500].forEach(ms=>setTimeout(calculate,ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
