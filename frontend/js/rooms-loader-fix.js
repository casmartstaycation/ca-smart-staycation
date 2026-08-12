(function(){
  'use strict';
  const API='https://ca-smart-staycation-muqd.onrender.com/api';
  async function loadRoomsSafely(){
    const select=document.getElementById('room');
    if(!select)return;
    if(String(document.getElementById('bookingType')?.value||'').toLowerCase()==='parking'){
      select.innerHTML='<option value="">Not required for Parking Only</option>';
      return;
    }
    select.innerHTML='<option value="">Loading rooms...</option>';
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),10000);
      const res=await fetch(`${API}/rooms?active=true`,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
      clearTimeout(timer);
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(json.message||`Rooms API returned ${res.status}`);
      const list=Array.isArray(json.data)?json.data:[];
      if(!list.length){select.innerHTML='<option value="">No accommodation available</option>';return;}
      select.innerHTML='<option value="">Select Accommodation</option>';
      list.forEach(room=>{
        const id=room?._id||'';
        if(!id)return;
        const number=room.unitNumber||room.roomNumber||'';
        const name=room.unitName||room.roomName||room.name||'Accommodation';
        const option=document.createElement('option');
        option.value=id;
        option.textContent=[number,name].filter(Boolean).join(' - ');
        if(room.price!=null)option.dataset.price=room.price;
        if(room.rate!=null)option.dataset.rate=room.rate;
        select.appendChild(option);
      });
    }catch(error){
      console.error('Accommodation rooms failed to load:',error);
      select.innerHTML='<option value="">Unable to load rooms — tap to retry</option>';
      select.onclick=()=>{select.onclick=null;loadRoomsSafely()};
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const type=document.getElementById('bookingType');
    type?.addEventListener('change',()=>{if(String(type.value).toLowerCase()!=='parking')loadRoomsSafely()});
    loadRoomsSafely();
  });
})();
