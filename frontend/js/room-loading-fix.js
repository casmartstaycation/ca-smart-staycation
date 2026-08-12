(function(){
  'use strict';

  const API='https://ca-smart-staycation-muqd.onrender.com/api';
  const TIMEOUT=30000;
  let loading=false;
  let retryTimer=null;

  function getSelect(){ return document.getElementById('room'); }

  function setMessage(select,text){
    if(!select)return;
    select.innerHTML='';
    const option=document.createElement('option');
    option.value='';
    option.textContent=text;
    select.appendChild(option);
  }

  function populateRooms(select,data){
    select.innerHTML='';
    const first=document.createElement('option');
    first.value='';
    first.textContent=data.length?'Select Accommodation':'No accommodation available';
    select.appendChild(first);

    data.forEach(room=>{
      if(!room || !room._id)return;
      const option=document.createElement('option');
      option.value=room._id;
      const number=room.unitNumber||room.roomNumber||'';
      const name=room.unitName||room.roomName||room.name||'Room';
      option.textContent=[number,name].filter(Boolean).join(' - ');
      const rate=room.price??room.rate??room.nightlyRate;
      if(rate!=null){
        option.dataset.price=rate;
        option.dataset.rate=rate;
      }
      select.appendChild(option);
    });

    // Keep the main booking script's room cache synchronized.
    if(Array.isArray(window.rooms)){
      window.rooms.length=0;
      data.forEach(room=>window.rooms.push(room));
    }

    if(typeof window.caBookingSummaryCalculate==='function')window.caBookingSummaryCalculate();
    if(typeof window.calculateTotal==='function')window.calculateTotal();
    if(typeof window.renderCalendar==='function')window.renderCalendar();
  }

  async function fetchRooms(){
    const select=getSelect();
    if(!select)return false;
    if(String(document.getElementById('bookingType')?.value||'unit').toLowerCase()==='parking')return true;
    if(loading)return false;

    loading=true;
    setMessage(select,'Loading rooms...');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT);

    try{
      const response=await fetch(API+'/rooms?public=1',{method:'GET',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
      const text=await response.text();
      let json={};
      try{json=JSON.parse(text||'{}');}catch(e){throw new Error('Invalid server response');}
      if(!response.ok)throw new Error(json.message||('Rooms request failed ('+response.status+')'));
      const data=Array.isArray(json.data)?json.data:[];
      populateRooms(select,data);
      return true;
    }catch(error){
      console.error('ROOM LOADING FIX:',error);
      setMessage(select,error.name==='AbortError'?'Unable to load rooms. Retrying...':'Unable to load rooms. Retrying...');
      return false;
    }finally{
      clearTimeout(timer);
      loading=false;
    }
  }

  async function start(){
    const select=getSelect();
    if(!select)return;
    const success=await fetchRooms();
    if(!success){
      clearTimeout(retryTimer);
      retryTimer=setTimeout(async()=>{
        const ok=await fetchRooms();
        if(!ok){
          clearTimeout(retryTimer);
          retryTimer=setTimeout(fetchRooms,5000);
        }
      },2000);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
