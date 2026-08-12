(function(){
  'use strict';
  const API='https://ca-smart-staycation-muqd.onrender.com/api';
  const TIMEOUT=12000;

  function setMessage(select,text){
    if(select && (!select.options.length || select.options[0].textContent.includes('Loading') || select.options[0].textContent.includes('Unable'))){
      select.innerHTML='';
      const o=document.createElement('option');o.value='';o.textContent=text;select.appendChild(o);
    }
  }
  async function fetchRooms(){
    const select=document.getElementById('room');
    if(!select)return;
    if(String(document.getElementById('bookingType')?.value||'unit').toLowerCase()==='parking')return;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT);
    try{
      const response=await fetch(API+'/rooms',{method:'GET',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
      const json=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(json.message||('Rooms request failed ('+response.status+')'));
      const data=Array.isArray(json.data)?json.data:[];
      select.innerHTML='';
      const first=document.createElement('option');first.value='';first.textContent=data.length?'Select Accommodation':'No accommodation available';select.appendChild(first);
      data.forEach(room=>{
        const option=document.createElement('option');
        option.value=room._id||'';
        const number=room.unitNumber||room.roomNumber||'';
        const name=room.unitName||room.roomName||room.name||'Room';
        option.textContent=[number,name].filter(Boolean).join(' - ');
        const rate=room.price??room.rate??room.nightlyRate;
        if(rate!=null){option.dataset.price=rate;option.dataset.rate=rate;}
        select.appendChild(option);
      });
      if(typeof window.caBookingSummaryCalculate==='function')window.caBookingSummaryCalculate();
    }catch(error){
      console.error('ROOM LOADING FIX:',error);
      setMessage(select,error.name==='AbortError'?'Unable to load accommodations. Please refresh.':'Unable to load accommodations.');
    }finally{clearTimeout(timer);}
  }
  function start(){
    const select=document.getElementById('room');
    if(!select)return;
    fetchRooms();
    setTimeout(()=>{
      if(select.options.length===1 && /Loading rooms/i.test(select.options[0].textContent))fetchRooms();
    },1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
