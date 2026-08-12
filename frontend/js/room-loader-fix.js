(function(){
'use strict';
const API='https://ca-smart-staycation-muqd.onrender.com/api/rooms';
const CACHE='caSmartStaycationRoomsGallery';
const TTL=24*60*60*1000;
const TIMEOUT=15000;
let loading=false;
let started=false;
function parkingOnly(){return String(document.getElementById('bookingType')?.value||'').toLowerCase()==='parking';}
function getSelect(){return document.getElementById('room');}
function setStatus(text,retry){const s=getSelect();if(!s||parkingOnly())return;s.disabled=false;s.innerHTML='';const o=document.createElement('option');o.value=retry?'__retry__':'';o.textContent=text;s.appendChild(o);if(retry)s.onchange=()=>{if(s.value==='__retry__'){s.onchange=null;load(true);}};}
function readCache(){try{const x=JSON.parse(localStorage.getItem(CACHE)||'null');if(!Array.isArray(x?.data)||!x.data.length)return null;if(x.timestamp&&Date.now()-x.timestamp>TTL)return null;return x.data;}catch{return null;}}
function writeCache(data){try{localStorage.setItem(CACHE,JSON.stringify({timestamp:Date.now(),data}));}catch{}}
function fill(data){const s=getSelect();if(!s||!Array.isArray(data)||!data.length||parkingOnly())return false;const current=s.value;s.disabled=false;s.innerHTML='<option value="">Select Accommodation</option>';data.forEach(r=>{if(!r||!r._id)return;const o=document.createElement('option');o.value=r._id;const n=r.unitNumber||r.roomNumber||'';const name=r.unitName||r.roomName||r.name||'Room';o.textContent=(n?n+' - ':'')+name;o.dataset.price=r.price??r.rate??r.nightlyRate??0;s.appendChild(o);});if(current&&data.some(r=>String(r._id)===String(current)))s.value=current;if(window.rooms&&Array.isArray(window.rooms)){window.rooms.length=0;data.forEach(r=>window.rooms.push(r));}s.dispatchEvent(new Event('change',{bubbles:true}));if(typeof window.calculateTotal==='function')window.calculateTotal();if(typeof window.renderCalendar==='function')window.renderCalendar();return s.options.length>1;}
async function request(){const c=new AbortController();const t=setTimeout(()=>c.abort(),TIMEOUT);try{const r=await fetch(API,{method:'GET',cache:'no-store',headers:{Accept:'application/json'},signal:c.signal});if(!r.ok)throw new Error('Rooms API returned '+r.status);const j=await r.json();const d=Array.isArray(j.data)?j.data:[];if(!d.length)throw new Error('Rooms API returned no rooms');return d;}finally{clearTimeout(t);}}
async function refresh(){try{const d=await request();writeCache(d);if(!loading&&!parkingOnly())fill(d);}catch(e){console.warn('Background accommodation refresh failed:',e);}}
async function load(force){const s=getSelect();if(!s||parkingOnly()||loading)return;if(!force&&s.options.length>1)return;loading=true;setStatus('Loading accommodations...',false);if(!force){const cached=readCache();if(cached&&fill(cached)){loading=false;refresh();return;}}for(let i=1;i<=3;i++){try{const d=await request();writeCache(d);fill(d);loading=false;return;}catch(e){console.warn('Accommodation load attempt '+i+' failed:',e);if(i<3)await new Promise(r=>setTimeout(r,i*2000));}}loading=false;const cached=readCache();if(cached&&fill(cached))return;setStatus('Unable to load accommodations — select here to retry',true);}
function start(){if(started)return;started=true;const type=document.getElementById('bookingType');if(type)type.addEventListener('change',()=>{if(!parkingOnly())setTimeout(()=>load(false),50);});load(false);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
