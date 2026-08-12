(function(){
  'use strict';
  const API='https://ca-smart-staycation-muqd.onrender.com/api';
  let loading=false;
  async function load(){
    const select=document.getElementById('room');
    if(!select || loading)return;
    const type=String(document.getElementById('bookingType')?.value||'unit').toLowerCase();
    if(type==='parking' || type==='parkingonly') return;
    loading=true;
    try{
      select.disabled=false;
      select.innerHTML='<option value="">Loading accommodations...</option>';
      const response=await fetch(API+'/rooms',{cache:'no-store',headers:{Accept:'application/json'}});
      const json=await response.json();
      if(!response.ok)throw new Error(json.message||'Unable to load accommodations');
      const data=Array.isArray(json.data)?json.data:[];
      select.innerHTML='<option value="">Select Accommodation</option>';
      data.forEach(room=>{
        if(!room || !room._id)return;
        const option=document.createElement('option');
        option.value=room._id;
        option.textContent=[room.unitNumber||room.roomNumber||'',room.unitName||room.roomName||room.name||'Room'].filter(Boolean).join(' - ');
        option.dataset.price=room.price??room.rate??room.nightlyRate??0;
        select.appendChild(option);
      });
      if(window.rooms && Array.isArray(window.rooms)){window.rooms.length=0;data.forEach(r=>window.rooms.push(r));}
      if(typeof window.calculateTotal==='function')window.calculateTotal();
      if(typeof window.renderCalendar==='function')window.renderCalendar();
    }catch(e){
      console.error('Accommodation loading failed:',e);
      select.innerHTML='<option value="">Unable to load accommodation — retrying...</option>';
    }finally{loading=false;}
  }
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(load,250);});
})();