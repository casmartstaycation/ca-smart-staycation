(function(){
  const BOOKING_PARTS=['.stats','.toolbar','.table-wrap','#paymentAlert'];
  function nav(){return document.querySelector('.admin-nav');}
  function panels(){return {voucher:document.getElementById('voucherAdminCard'),email:document.querySelector('.admin-email-settings')};}
  function keyFromText(text){const t=(text||'').trim().toLowerCase();if(t==='voucher management')return 'voucher';if(t==='admin email notifications')return 'email';if(t==='bookings')return 'bookings';return null;}
  function hashKey(){const h=(location.hash||'').toLowerCase();if(h==='#voucher' || h==='#vouchermanagement' || h==='#vouchermanagementtab')return 'voucher';if(h==='#adminemail' || h==='#adminemailsettings')return 'email';return null;}
  function enforceNavLayout(){
    const n=nav();
    if(!n)return;
    n.style.setProperty('display','flex','important');
    n.style.setProperty('align-items','center','important');
    n.style.setProperty('flex-wrap','nowrap','important');
    n.style.setProperty('white-space','nowrap','important');
    n.style.setProperty('overflow-x','auto','important');
    n.style.setProperty('overflow-y','hidden','important');
    n.style.setProperty('width','100%','important');
    n.style.setProperty('box-sizing','border-box','important');
    n.querySelectorAll(':scope > a,:scope > button').forEach(item=>{
      item.style.setProperty('flex','0 0 auto','important');
      item.style.setProperty('white-space','nowrap','important');
      item.style.setProperty('display','inline-flex','important');
      item.style.setProperty('align-items','center','important');
      item.style.setProperty('justify-content','center','important');
    });
  }
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
    if(key==='bookings'){
      sessionStorage.setItem('caSmartAdminTab','bookings');
      showBookings();
    }else{
      sessionStorage.setItem('caSmartAdminTab',key);
      hideEverything();
      const p=panels();
      if(key==='voucher'&&p.voucher)p.voucher.style.setProperty('display','block','important');
      if(key==='email'&&p.email){
        p.email.style.setProperty('display','block','important');
        if(typeof window.loadAdminNotificationEmail==='function')window.loadAdminNotificationEmail();
      }
    }
    const n=nav();
    if(n)n.querySelectorAll('a,button').forEach(a=>a.classList.toggle('active',keyFromText(a.textContent)===key));
    document.body.dataset.adminTab=key;
    const shell=document.getElementById('adminShell');if(shell)shell.dataset.adminTab=key;
    enforceNavLayout();
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
    enforceNavLayout();
    n.querySelectorAll('a,button').forEach(a=>{
      if(a.dataset.tabControllerBound)return;
      const key=keyFromText(a.textContent);
      if(!key)return;
      a.dataset.tabControllerBound='1';
      if(key==='voucher'||key==='email'){
        a.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();activate(key);},true);
      }else if(key==='bookings'){
        a.addEventListener('click',function(){sessionStorage.setItem('caSmartAdminTab','bookings');},true);
      }
    });
    const fromHash=hashKey();
    const saved=sessionStorage.getItem('caSmartAdminTab');
    activate(fromHash || (saved==='voucher'||saved==='email'?saved:'bookings'));
    enforceNavLayout();
  }
  function init(){
    const style=document.createElement('style');style.id='adminTabIsolationStyles';style.textContent=`
      .admin-nav{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:nowrap!important;white-space:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;width:100%!important;box-sizing:border-box!important}
      .admin-nav>a,.admin-nav>button{display:inline-flex!important;flex:0 0 auto!important;white-space:nowrap!important;align-items:center!important;justify-content:center!important}
      .admin-nav .new-booking{margin-left:auto!important;flex:0 0 auto!important}
      .admin-nav .admin-email-tab{flex:0 0 auto!important;order:0!important}
      .admin-shell[data-admin-tab="voucher"] .stats,.admin-shell[data-admin-tab="voucher"] .toolbar,.admin-shell[data-admin-tab="voucher"] .table-wrap,.admin-shell[data-admin-tab="voucher"] #paymentAlert,.admin-shell[data-admin-tab="voucher"] .admin-email-settings{display:none!important}
      .admin-shell[data-admin-tab="email"] .stats,.admin-shell[data-admin-tab="email"] .toolbar,.admin-shell[data-admin-tab="email"] .table-wrap,.admin-shell[data-admin-tab="email"] #paymentAlert,.admin-shell[data-admin-tab="email"] #voucherAdminCard{display:none!important}
      .admin-shell[data-admin-tab="bookings"] #voucherAdminCard,.admin-shell[data-admin-tab="bookings"] .admin-email-settings{display:none!important}
      .admin-nav a,.admin-nav button{min-height:40px;padding:0 14px;border:1px solid #d7e1dc;border-radius:7px;background:#eef3f0;color:#173f35;text-decoration:none;font-weight:700;cursor:pointer}
      .admin-nav a.active,.admin-nav button.active{background:#173f35;color:#fff;border-color:#173f35}
      @media(max-width:800px){.admin-nav{justify-content:flex-start!important}.admin-nav .new-booking{margin-left:0!important}}
    `;document.head.appendChild(style);wire();setTimeout(wire,300);setTimeout(wire,1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.addEventListener('hashchange',wire);
  new MutationObserver(()=>wire()).observe(document.documentElement,{childList:true,subtree:true});
})();