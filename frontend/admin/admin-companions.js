(function(){
  'use strict';
  const API='/api';
  const token=()=>sessionStorage.getItem('caSmartAdminToken')||localStorage.getItem('caSmartAdminToken')||sessionStorage.getItem('adminToken')||localStorage.getItem('adminToken')||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let lastRef='';
  async function inject(){
    const details=document.getElementById('bookingDetails'),modal=document.getElementById('bookingModal'),title=document.getElementById('modalTitle');
    if(!details||!modal||modal.hidden||!title)return;
    const ref=title.textContent.trim();if(!ref||ref===lastRef&&details.querySelector('[data-admin-companions]'))return;
    if(details.querySelector('[data-admin-companions]'))details.querySelector('[data-admin-companions]').remove();
    lastRef=ref;
    try{
      const r=await fetch(`${API}/admin/bookings/${encodeURIComponent(ref)}/companions`,{headers:{Authorization:`Bearer ${token()}`},cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.message||'Unable to load companion information.');
      const box=document.createElement('div');box.dataset.adminCompanions='1';box.className='notes';
      const list=(d.companions||[]).map((c,i)=>`<div style="border-top:1px solid #e1e8e4;padding:12px 0"><strong>Companion ${i+1}</strong><p style="margin:6px 0">Full Name: <strong>${esc(c.fullName)}</strong></p><p style="margin:6px 0">ID: <a class="proof admin-file-link" href="${API}/admin/bookings/${encodeURIComponent(ref)}/companions/${encodeURIComponent(c._id)}/id" data-admin-file="1">View Uploaded ID</a>${c.idFileName?` <small>(${esc(c.idFileName)})</small>`:''}</p></div>`).join('');
      box.innerHTML=`<span>Guest Companions / Building Visitor Pass</span><p>${d.required||0} companion${Number(d.required||0)===1?'':'s'} required for this booking. Only full name and ID are collected for companions; no companion address is included.</p>${list||'<p>No companion information has been submitted yet.</p>'}`;
      details.appendChild(box);
    }catch(e){console.warn('Admin companion information unavailable:',e);}
  }
  const observer=new MutationObserver(()=>setTimeout(inject,50));
  function start(){const details=document.getElementById('bookingDetails');if(details)observer.observe(details,{childList:true,subtree:true});setInterval(inject,500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
