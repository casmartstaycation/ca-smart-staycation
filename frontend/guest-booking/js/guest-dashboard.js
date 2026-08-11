/* Guest dashboard enhancements: account settings + additional guest/amenity requests. */
(function(){
  function addAccountSettings(){
    if(document.getElementById('accountSettingsBtn')) return true;
    const nav=document.querySelector('#bookingsBtn')?.parentElement || document.querySelector('.tabs, .tab-nav, .dashboard-tabs, nav');
    if(!nav) return false;
    const btn=document.createElement('button'); btn.type='button'; btn.id='accountSettingsBtn'; btn.className='tab-button'; btn.textContent='Account Settings'; btn.title='Manage your email address and password'; btn.addEventListener('click',()=>{location.href='account-settings.html';}); nav.appendChild(btn); return true;
  }
  function loadAddOns(){ if(document.getElementById('guestAddOnsScript'))return; const s=document.createElement('script'); s.id='guestAddOnsScript'; s.src='js/guest-addons.js?v=1'; s.async=false; document.body.appendChild(s); }
  function boot(){ if(!addAccountSettings())setTimeout(addAccountSettings,500); loadAddOns(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
