(function(){
  'use strict';
  const API='https://ca-smart-staycation-muqd.onrender.com/api/rooms';
  const CACHE='caSmartStaycationRoomsGallery';
  const TIMEOUT=12000;

  function parkingOnly(){return String(document.getElementById('bookingType')?.value||'').toLowerCase()==='parking';}
  function fill(data){
    const select=document.getElementById('room');
    if(!select||!Array.isArray(data)||!data.length)return false;
    const current=select.value;
    select.innerHTML='<option value="">Select Accommodation</option>';
    data.forEach(room=>{
      if(!room||!room._id)return;
      const number=room.unitNumber||room.roomNumber||'';
      const name=room.unitName||room.roomName||'Room';
      const option=document.createElement('option');
      option.value=room._id;
      option.textContent=`${number ? number+' - ' : ''}${name}`;
      select.appendChild(option);
    });
    if(current&&data.some(r=>String(r._id)===String(current)))select.value=current;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function cacheData(){
    try{const raw=sessionStorage.getItem(CACHE);const parsed=raw?JSON.parse(raw):null;return Array.isArray(parsed?.data)?parsed.data:null}catch{return null}
  }
  async function request(){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT);
    try{
      const response=await fetch(API,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
      if(!response.ok)throw new Error(`Rooms API returned ${response.status}`);
      const json=await response.json();
      const data=Array.isArray(json.data)?json.data:[];
      if(!data.length)throw new Error('Rooms API returned no rooms');
      try{sessionStorage.setItem(CACHE,JSON.stringify({timestamp:Date.now(),data}))}catch{}
      return data;
    }finally{clearTimeout(timer)}
  }
  async function fix(){
    const select=document.getElementById('room');
    if(!select||parkingOnly())return;
    if(select.options.length>1)return;
    const cached=cacheData();
    if(cached&&fill(cached))return;
    for(let attempt=1;attempt<=3;attempt++){
      try{const data=await request();if(fill(data))return}catch(error){
        console.warn(`Accommodation load attempt ${attempt} failed:`,error);
        if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1500));
      }
    }
    if(!parkingOnly()&&select.options.length<=1){
      select.innerHTML='<option value="">Unable to load accommodations — tap to retry</option>';
      select.onclick=()=>{select.onclick=null;fix()};
    }
  }
  function start(){
    fix();
    const type=document.getElementById('bookingType');
    if(type)type.addEventListener('change',()=>{if(!parkingOnly())setTimeout(fix,50)});
    const observer=new MutationObserver(()=>{const select=document.getElementById('room');if(select&&select.options.length<=1&&!parkingOnly())fix()});
    const select=document.getElementById('room');
    if(select)observer.observe(select,{childList:true});
    setTimeout(fix,2500);
    setTimeout(fix,6000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
