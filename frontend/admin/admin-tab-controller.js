(function(){
  const TAB_LABELS={voucher:'Voucher Management',email:'Admin Email Notifications'};
  const BOOKING_PARTS=['.stats','.toolbar','.table-wrap','#paymentAlert'];
  function keyFromText(text){const t=(text||'').trim().toLowerCase();if(t==='voucher management')return 'voucher';if(t==='admin email notifications')return 'email';return 'bookings';}
  function nav(){return document.querySelector('.admin-nav');}
  function panels(){return {voucher:document.getElementById('voucherAdminCard'),email:document.querySelector('.admin-email-settings')};}
  function hideEverything(){
    BOOKING_PARTS.forEach(s=>document.querySelectorAll(s).forEach(e=>e.style.setProperty('display','none','important')));
    const p=panels();
    if(p.voucher)p.voucher.style.setProperty('display','none','important');
    if(p.email)p.email.style.setProperty('display','none','important');
  }
  function showBookings(){
    hideEverything();
    document.querySelectorAll('.stats').forEach(e=>e.style.setProperty('display','grid','important'));
    document.querySelectorAll('.toolbar,.table-wrap,#paymentAlert').forEach(e=>e.style.setProperty('display','block','important'));
  }
  function activate(key){
    sessionStorage.setItem('caSmartAdminTab',key);
    hideEverything();
    const p=panels();
    if(key==='voucher'&&p.voucher)p.voucher.style.setProperty('display','block','important');
    else if(key==='email'&&p.email)p.email.style.setProperty('display','block','important');
    else showBookings();
    const n=nav();
    if(n)n.querySelectorAll('a,button').forEach(a=>a.classList.toggle('active',keyFromText(a.textContent)===key));
    document.body.dataset.adminTab=key;
    const shell=document.getElementById('adminShell');if(shell)shell.dataset.adminTab=key;
    window.dispatchEvent(new CustomEvent('admin-tab-changed',{detail:{key}}));
  }
  function removeDuplicates(){
    const n=nav();if(!n)return;
    ['voucher','email'].forEach(key=>{
      const matches=Array.from(n.querySelectorAll('a,button')).filter(a=>keyFromText(a.textContent)===key);
      matches.slice(1).forEach(a=>a.remove());
    });
  }
  function wire(){
    const n=nav();if(!n)return;
    removeDuplicates();
    n.querySelectorAll('a,button').forEach(a=>{
      if(a.dataset.tabControllerBound)return;
      const key=keyFromText(a.textContent);
      if(key!=='voucher'&&key!=='email')return;
      a.dataset.tabControllerBound='1';
      a.addEventListener('click',function(e){
        e.preventDefault();e.stopImmediatePropagation();activate(key);
      },true);
    });
    const saved=sessionStorage.getItem('caSmartAdminTab')||'bookings';
    activate(saved==='voucher'||saved==='email'?saved:'bookings');
  }
  function init(){
    const style=document.createElement('style');style.id='adminTabIsolationStyles';style.textContent=`.admin-shell[data-admin-tab="voucher"] .stats,.admin-shell[data-admin-tab="voucher"] .toolbar,.admin-shell[data-admin-tab="voucher"] .table-wrap,.admin-shell[data-admin-tab="voucher"] #paymentAlert,.admin-shell[data-admin-tab="voucher"] .admin-email-settings{display:none!important}.admin-shell[data-admin-tab="email"] .stats,.admin-shell[data-admin-tab="email"] .toolbar,.admin-shell[data-admin-tab="email"] .table-wrap,.admin-shell[data-admin-tab="email"] #paymentAlert,.admin-shell[data-admin-tab="email"] #voucherAdminCard{display:none!important}.admin-nav a,.admin-nav button{min-height:40px;padding:0 14px;border:1px solid #d7e1dc;border-radius:7px;background:#eef3f0;color:#173f35;text-decoration:none;font-weight:700;cursor:pointer}.admin-nav a.active,.admin-nav button.active{background:#173f35;color:#fff;border-color:#173f35}`;document.head.appendChild(style);wire();setTimeout(wire,300);setTimeout(wire,1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  new MutationObserver(()=>{wire();}).observe(document.documentElement,{childList:true,subtree:true});
})();
