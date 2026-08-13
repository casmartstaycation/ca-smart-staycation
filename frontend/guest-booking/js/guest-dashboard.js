/* Account Settings navigation enhancement. Loaded independently so the existing dashboard remains untouched. */
(function(){
  function addAccountSettings(){
    if(document.getElementById('accountSettingsBtn')) return true;
    const nav=document.querySelector('#bookingsBtn')?.parentElement || document.querySelector('.tabs, .tab-nav, .dashboard-tabs, nav');
    if(!nav) return false;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='accountSettingsBtn';
    btn.className='tab-button';
    btn.textContent='Account Settings';
    btn.title='Manage your email address and password';
    btn.addEventListener('click',()=>{ location.href='account-settings.html'; });
    nav.appendChild(btn);
    return true;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{if(!addAccountSettings()) setTimeout(addAccountSettings,500);});
  else if(!addAccountSettings()) setTimeout(addAccountSettings,500);
})();
