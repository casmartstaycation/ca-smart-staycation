/* Fix manual Admin Refresh: bypass the 15-second GET cache used by auto-refresh.js. */
(function(){
  function install(){
    const btn=document.getElementById('refreshBtn');
    if(!btn||btn.dataset.refreshFixInstalled==='1')return;
    btn.dataset.refreshFixInstalled='1';
    btn.addEventListener('click',function(){
      if(typeof window.caSmartAdminInvalidateCache==='function'){
        window.caSmartAdminInvalidateCache('/api/bookings');
      }
      btn.disabled=true;
      const original=btn.textContent;
      btn.textContent='Refreshing…';
      const finish=()=>{btn.disabled=false;btn.textContent=original;};
      setTimeout(finish,1200);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
