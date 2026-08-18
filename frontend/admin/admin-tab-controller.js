(function(){
  const BOOKING_PARTS=['.stats','.toolbar','.table-wrap','#paymentAlert'];
  const MESSAGE_SEEN_KEY='caSmartAdminMessagesSeenAt';
  const TAB_KEY='caSmartAdminTab';
  let messagePollTimer=null;
  let currentTab='bookings';
  let wiring=false;
  let lastExplicitIntent='';

  function nav(){return document.querySelector('.admin-nav');}
  function panels(){return {voucher:document.getElementById('voucherAdminCard'),email:document.querySelector('.admin-email-settings')};}
  function keyFromText(text){const t=(text||'').replace(/\s+/g,' ').trim().toLowerCase();if(t.startsWith('voucher management'))return 'voucher';if(t.startsWith('admin email notifications')||t.startsWith('admin account settings'))return 'email';if(t==='bookings')return 'bookings';return null;}
  function hashKey(){const h=(location.hash||'').toLowerCase();if(h==='#voucher'||h==='#vouchermanagement'||h==='#vouchermanagementtab')return 'voucher';if(h==='#adminemail'||h==='#adminemailsettings')return 'email';if(h==='#bookings')return 'bookings';return null;}
  function token(){return sessionStorage.getItem('caSmartAdminToken')||localStorage.getItem('caSmartAdminToken')||'';}
  function messageBadge(){return document.getElementById('adminMessageBadge');}
  function messageItems(data){return Array.isArray(data?.messages)?data.messages:Array.isArray(data?.data)?data.data:[];}
  function messageTime(m){const t=Date.parse(m?.createdAt||m?.updatedAt||'');return Number.isFinite(t)?t:0;}
  function updateMessageBadge(messages){const badge=messageBadge();if(!badge)return;const seen=Number(sessionStorage.getItem(MESSAGE_SEEN_KEY)||localStorage.getItem(MESSAGE_SEEN_KEY)||0);const count=messages.filter(m=>messageTime(m)>seen).length;badge.textContent=count>99?'99+':String(count);badge.hidden=count===0;}
  async function pollMessages(){if(!token())return;try{const r=await fetch('/api/admin/inbox',{headers:{Authorization:`Bearer ${token()}`},cache:'no-store'});if(!r.ok)return;const d=await r.json();updateMessageBadge(messageItems(d))}catch(_){} }
  function markMessagesSeen(){const now=Date.now();sessionStorage.setItem(MESSAGE_SEEN_KEY,String(now));localStorage.setItem(MESSAGE_SEEN_KEY,String(now));const badge=messageBadge();if(badge){badge.textContent='0';badge.hidden=true}}
  function startMessagePolling(){if(messagePollTimer)clearInterval(messagePollTimer);pollMessages();messagePollTimer=setInterval(pollMessages,10000)}
  function injectUnifiedNavStyles(){let style=document.getElementById('adminUnifiedNavStyles');if(style)return;style=document.createElement('style');style.id='adminUnifiedNavStyles';style.textContent=`.admin-nav{display:flex!important;align-items:stretch!important;gap:6px!important;flex-wrap:nowrap!important;overflow:hidden!important;width:100%!important;box-sizing:border-box!important;padding:6px!important}.admin-nav>a,.admin-nav>button{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:1 1 0!important;min-width:0!important;width:0!important;max-width:none!important;min-height:42px!important;box-sizing:border-box!important;margin:0!important;padding:9px 8px!important;border:1px solid #d7e1dc!important;border-radius:7px!important;background:#eef3f0!important;color:#173f35!important;text-decoration:none!important;font:700 clamp(10px,.82vw,13px)/1.2 Arial,sans-serif!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;cursor:pointer!important;transition:background .15s ease,color .15s ease,border-color .15s ease!important}.admin-nav>a:hover,.admin-nav>button:hover{background:#e1ebe6!important;color:#173f35!important;border-color:#cbd8d2!important}.admin-nav>a.active,.admin-nav>button.active{background:#173f35!important;color:#fff!important;border-color:#173f35!important}.admin-nav>.new-booking{margin-left:0!important;background:#eef3f0!important;color:#173f35!important;border-color:#d7e1dc!important}.admin-nav>.new-booking:hover{background:#e1ebe6!important;color:#173f35!important}.admin-nav>.new-booking.active{background:#173f35!important;color:#fff!important}.admin-nav .badge{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin-left:6px!important;min-width:20px!important;height:20px!important;padding:0 5px!important;border-radius:999px!important;background:#b08a3c!important;color:#fff!important;font-size:10px!important;line-height:1!important;flex:0 0 auto!important}.admin-nav .badge[hidden]{display:none!important}`;document.head.appendChild(style)}
  function enforceNavLayout(){const n=nav();if(!n)return;injectUnifiedNavStyles();n.querySelectorAll(':scope > *').forEach(item=>{item.style.setProperty('display','inline-flex','important');item.style.setProperty('flex','1 1 0','important');item.style.setProperty('min-width','0','important');item.style.setProperty('width','0','important');item.style.setProperty('max-width','none','important');item.style.setProperty('white-space','nowrap','important');item.style.setProperty('align-items','center','important');item.style.setProperty('justify-content','center','important');item.style.setProperty('margin','0','important');item.style.setProperty('padding','9px 8px','important');item.style.setProperty('overflow','hidden','important');item.style.setProperty('text-overflow','ellipsis','important')});const active=n.querySelector('.active');if(active){active.style.setProperty('background','#173f35','important');active.style.setProperty('color','#fff','important')}}
  function enforcePaymentAlertLayout(){const alert=document.getElementById('paymentAlert');if(!alert)return;const shell=document.getElementById('adminShell');const isBookings=(shell?.dataset.adminTab||document.body.dataset.adminTab||'bookings')==='bookings';if(!isBookings){alert.style.setProperty('display','none','important');return}alert.style.setProperty('display','flex','important');alert.style.setProperty('justify-content','space-between','important');alert.style.setProperty('align-items','center','important');alert.style.setProperty('gap','20px','important');const content=alert.firstElementChild;const button=document.getElementById('reviewPaymentsBtn');if(content)content.style.setProperty('flex','1 1 auto','important');if(button){button.style.setProperty('flex','0 0 auto','important');button.style.setProperty('margin-left','auto','important')}}
  function hideEverything(){BOOKING_PARTS.forEach(s=>document.querySelectorAll(s).forEach(e=>e.style.setProperty('display','none','important')));const p=panels();if(p.voucher)p.voucher.style.setProperty('display','none','important');if(p.email)p.email.style.setProperty('display','none','important')}
  function activate(key,opts={}){
    if(key!=='bookings'&&key!=='voucher'&&key!=='email')key='bookings';
    // Voucher Management owns the active tab until the administrator explicitly
    // selects another tab. This prevents delayed Account Settings initializers,
    // observers, or async callbacks from stealing the voucher tab.
    if(key==='email'&&!opts.explicit&&currentTab==='voucher')return;
    currentTab=key;
    if(opts.explicit){lastExplicitIntent=key;window.__caSmartAdminTabIntent=key;sessionStorage.setItem(TAB_KEY,key)}
    if(key==='bookings'){
      sessionStorage.setItem(TAB_KEY,'bookings');
      if(opts.updateHash!==false&&location.hash)history.replaceState(null,'',location.pathname+location.search);
      showBookings();
    }else{
      sessionStorage.setItem(TAB_KEY,key);
      if(opts.updateHash!==false){const hash=key==='voucher'?'#voucherManagement':'#adminEmailSettings';if(location.hash!==hash)history.replaceState(null,'',location.pathname+location.search+hash)}
      hideEverything();
      const p=panels();
      if(key==='voucher'&&p.voucher)p.voucher.style.setProperty('display','block','important');
      if(key==='email'&&p.email){p.email.style.setProperty('display','block','important');if(opts.explicit&&typeof window.loadAdminNotificationEmail==='function')window.loadAdminNotificationEmail()}
    }
    const n=nav();if(n)n.querySelectorAll('a,button').forEach(a=>a.classList.toggle('active',keyFromText(a.textContent)===key));
    document.body.dataset.adminTab=key;
    const shell=document.getElementById('adminShell');if(shell)shell.dataset.adminTab=key;
    window.dispatchEvent(new CustomEvent('admin-tab-changed',{detail:{key}}));
    enforceNavLayout();enforcePaymentAlertLayout();
    if(key==='bookings')pollMessages();
  }
  window.activateAdminTab=(key,opts={})=>activate(key,{...opts,explicit:true});
  function removeDuplicates(){const n=nav();if(!n)return;['voucher','email'].forEach(key=>{const matches=Array.from(n.querySelectorAll('a,button')).filter(a=>keyFromText(a.textContent)===key);matches.slice(1).forEach(a=>a.remove())})}
  function wire(){
    if(wiring)return;wiring=true;
    try{
      const n=nav();if(!n)return;removeDuplicates();enforceNavLayout();
      n.querySelectorAll('a,button').forEach(a=>{
        if(a.dataset.tabControllerBound)return;const key=keyFromText(a.textContent);if(!key)return;a.dataset.tabControllerBound='1';
        a.addEventListener('click',function(e){
          if(key==='voucher'||key==='email'){e.preventDefault();e.stopImmediatePropagation();activate(key,{updateHash:true,explicit:true});}
          else if(key==='bookings'){sessionStorage.setItem(TAB_KEY,'bookings');window.__caSmartAdminTabIntent='bookings'}
        },true)
      });
      const msg=n.querySelector('#adminMessagesTab');if(msg&&!msg.dataset.messageBound){msg.dataset.messageBound='1';msg.addEventListener('click',markMessagesSeen);msg.addEventListener('mousedown',markMessagesSeen)}
      const fromHash=hashKey(),saved=sessionStorage.getItem(TAB_KEY),intent=window.__caSmartAdminTabIntent||lastExplicitIntent;
      let target=intent||fromHash||(saved==='voucher'||saved==='email'?saved:'bookings');
      if(target!==currentTab)activate(target,{updateHash:false});
    }finally{wiring=false}
  }
  function showBookings(){hideEverything();document.querySelectorAll('.stats').forEach(e=>e.style.setProperty('display','grid','important'));document.querySelectorAll('.toolbar,.table-wrap').forEach(e=>e.style.setProperty('display','block','important'));const alert=document.getElementById('paymentAlert');if(alert&&!alert.hidden)enforcePaymentAlertLayout();else if(alert)alert.style.setProperty('display','none','important')}
  function init(){
    let style=document.getElementById('adminTabIsolationStyles');if(!style){style=document.createElement('style');style.id='adminTabIsolationStyles';style.textContent=`.admin-shell[data-admin-tab="voucher"] #paymentAlert,.admin-shell[data-admin-tab="email"] #paymentAlert{display:none!important}.admin-shell[data-admin-tab="voucher"] .stats,.admin-shell[data-admin-tab="voucher"] .toolbar,.admin-shell[data-admin-tab="voucher"] .table-wrap,.admin-shell[data-admin-tab="voucher"] .admin-email-settings{display:none!important}.admin-shell[data-admin-tab="email"] .stats,.admin-shell[data-admin-tab="email"] .toolbar,.admin-shell[data-admin-tab="email"] #voucherAdminCard{display:none!important}.admin-shell[data-admin-tab="bookings"] #voucherAdminCard,.admin-shell[data-admin-tab="bookings"] .admin-email-settings{display:none!important}`;document.head.appendChild(style)}
    wire();startMessagePolling();setTimeout(wire,300);setTimeout(wire,1000);setTimeout(enforcePaymentAlertLayout,2000)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.addEventListener('hashchange',wire);window.addEventListener('resize',enforcePaymentAlertLayout);
  new MutationObserver(()=>{wire();enforcePaymentAlertLayout()}).observe(document.documentElement,{childList:true,subtree:true});
})();
