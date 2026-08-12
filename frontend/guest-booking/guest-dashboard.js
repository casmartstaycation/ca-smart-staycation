/* Guest dashboard behavior is preserved in the existing inline dashboard script. This file only adds Account Settings navigation when loaded. */
(function(){
  function addAccountSettings(){
    if(document.getElementById('accountSettingsBtn')) return true;
    const nav=document.querySelector('#bookingsBtn')?.parentElement || document.querySelector('.tabs, .tab-nav, .dashboard-tabs, nav');
    if(!nav) return false;
    const btn=document.createElement('button');
    btn.type='button'; btn.id='accountSettingsBtn'; btn.className='tab-button';
    btn.textContent='Account Settings';
    btn.addEventListener('click',()=>{ location.href='account-settings.html'; });
    nav.appendChild(btn); return true;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{if(!addAccountSettings()) setTimeout(addAccountSettings,500);});
  else if(!addAccountSettings()) setTimeout(addAccountSettings,500);
})();
