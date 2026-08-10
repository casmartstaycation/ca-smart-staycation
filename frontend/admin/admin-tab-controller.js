(function(){
  const SELECTORS = [
    '#bookingTable', '.table-wrap', '.stats', '.toolbar', '#paymentAlert',
    '#voucherAdminCard', '.voucher-admin-card', '#adminEmailManager', '.admin-email-settings',
    '[data-admin-panel="notifications"]', '[data-admin-panel="messages"]',
    '[data-admin-panel="resources"]', '#notificationsPanel', '#messagesPanel', '#resourcesPanel'
  ];
  const TAB_MAP = {
    bookings: ['bookings.html','Bookings'],
    notifications: ['notifications.html','Notifications'],
    messages: ['messages.html','Messages'],
    resources: ['resources.html','Units & Parking Management'],
    vouchers: ['#voucherAdminCard','Voucher Management'],
    adminEmail: ['#adminEmailManager','Admin Email Notifications']
  };
  function getTab(){ return sessionStorage.getItem('caSmartAdminTab') || 'bookings'; }
  function navKey(a){
    const href=(a.getAttribute('href')||'').toLowerCase();
    const text=(a.textContent||'').toLowerCase();
    if(href.includes('notifications')||text.includes('notification')) return 'notifications';
    if(href.includes('messages')||text.includes('message')) return 'messages';
    if(href.includes('resources')||text.includes('units')) return 'resources';
    if(text.includes('voucher')) return 'vouchers';
    if(text.includes('admin email')) return 'adminEmail';
    return 'bookings';
  }
  function panelFor(key){
    if(key==='vouchers') return document.querySelector('#voucherAdminCard,.voucher-admin-card');
    if(key==='adminEmail') return document.querySelector('#adminEmailManager');
    if(key==='bookings') return null;
    return document.querySelector(`[data-admin-panel="${key}"]`) || document.querySelector(`#${key}Panel`);
  }
  function allPanels(){
    const found=[];
    SELECTORS.forEach(s=>document.querySelectorAll(s).forEach(e=>{if(!found.includes(e))found.push(e)}));
    document.querySelectorAll('.admin-email-settings').forEach(e=>{if(!found.includes(e))found.push(e)});
    return found;
  }
  function activate(key){
    sessionStorage.setItem('caSmartAdminTab',key);
    document.querySelectorAll('.admin-nav a,.admin-nav button[data-admin-tab]').forEach(a=>{
      a.classList.toggle('active',navKey(a)===key || a.dataset.adminTab===key);
    });
    const panels=allPanels();
    panels.forEach(p=>p.classList.remove('admin-tab-visible'));
    const selected=panelFor(key);
    if(key==='bookings'){
      document.querySelector('.stats')?.classList.add('admin-tab-visible');
      document.querySelector('.toolbar')?.classList.add('admin-tab-visible');
      document.querySelector('.table-wrap')?.classList.add('admin-tab-visible');
      document.querySelector('#paymentAlert')?.classList.add('admin-tab-visible');
    }else if(selected){selected.classList.add('admin-tab-visible');}
    document.body.dataset.adminTab=key;
    window.dispatchEvent(new CustomEvent('admin-tab-changed',{detail:{key}}));
  }
  function install(){
    const nav=document.querySelector('.admin-nav'); if(!nav)return;
    nav.querySelectorAll('a').forEach(a=>{
      if(a.classList.contains('new-booking'))return;
      const key=navKey(a);
      if(a.textContent.toLowerCase().includes('voucher')){
        a.href='#voucher';
      }
      if(a.textContent.toLowerCase().includes('admin email')) a.href='#admin-email';
      a.addEventListener('click',function(e){
        if(key==='bookings' && (a.getAttribute('href')||'').endsWith('bookings.html')){e.preventDefault();activate(key);return;}
        if(key==='vouchers'||key==='adminEmail'){e.preventDefault();activate(key);return;}
      });
    });
    if(!nav.querySelector('[data-admin-tab="vouchers"]')){
      const a=document.createElement('a');a.href='#voucher';a.textContent='Voucher Management';a.dataset.adminTab='vouchers';nav.appendChild(a);a.addEventListener('click',e=>{e.preventDefault();activate('vouchers')});
    }
    if(!nav.querySelector('[data-admin-tab="adminEmail"]')){
      const a=document.createElement('a');a.href='#admin-email';a.textContent='Admin Email Notifications';a.dataset.adminTab='adminEmail';nav.appendChild(a);a.addEventListener('click',e=>{e.preventDefault();activate('adminEmail')});
    }
    activate(getTab());
  }
  const style=document.createElement('style');
  style.textContent=`.admin-tab-visible{display:block!important}.admin-nav a,.admin-nav button{min-height:40px;padding:0 14px;border:1px solid #d7e1dc;border-radius:7px;background:#eef3f0;color:#173f35;text-decoration:none;font-weight:700;cursor:pointer}.admin-nav a.active,.admin-nav button.active{background:#173f35;color:#fff;border-color:#173f35}.admin-nav{display:flex;gap:8px;flex-wrap:wrap}.admin-tab-panel{display:none!important}.admin-shell .stats,.admin-shell .toolbar,.admin-shell .table-wrap,.admin-shell #paymentAlert{display:none}.admin-shell .admin-email-settings{display:none}.admin-shell #voucherAdminCard{display:none}`;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100));
  window.addEventListener('admin-voucher-ready',()=>activate(getTab()));
  window.addEventListener('admin-email-ready',()=>activate(getTab()));
})();
