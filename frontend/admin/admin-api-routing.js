/* CA Smart Staycation admin API routing/auth bridge. */
(function () {
  const TOKEN_KEY = 'caSmartAdminToken';
  const LEGACY_ORIGIN = 'https://ca-smart-staycation-muqd.onrender.com';
  const originalFetch = window.fetch.bind(window);
  function getToken(){return sessionStorage.getItem(TOKEN_KEY)||localStorage.getItem(TOKEN_KEY)||'';}
  function isApiUrl(url){try{const u=new URL(url,window.location.origin);return u.origin===window.location.origin&&u.pathname.startsWith('/api/');}catch(_){return false;}}
  function validateToken(token){if(!token)return false;try{const p=token.split('.');if(p.length!==3)return false;const x=JSON.parse(atob(p[1].replace(/-/g,'+').replace(/_/g,'/')));return !!(x&&x.role==='admin'&&x.email&&(!x.exp||x.exp*1000>Date.now()));}catch(_){return false;}}
  function clear(){sessionStorage.removeItem(TOKEN_KEY);localStorage.removeItem(TOKEN_KEY);}
  function clearInvalidToken(token){if(token&&!validateToken(token)){clear();return '';}return token;}
  function rewrite(input){const r=input instanceof Request?input:null;const raw=r?r.url:String(input||'');if(!raw)return null;try{const u=new URL(raw,window.location.origin);if(u.origin!==LEGACY_ORIGIN)return null;return new URL(u.pathname+u.search,window.location.origin).href;}catch(_){return null;}}
  function withAuth(input,init,url){let request;try{request=input instanceof Request?new Request(url||input.url,input):new Request(url||String(input),init||{});}catch(_){return null;}const token=clearInvalidToken(getToken());if(!token)return request;const h=new Headers(request.headers);if(!h.has('Authorization'))h.set('Authorization',`Bearer ${token}`);return new Request(request,{headers:h});}
  window.fetch=function(input,init){const rewritten=rewrite(input);const rawUrl=rewritten||(input instanceof Request?input.url:String(input||''));if(!isApiUrl(rawUrl))return originalFetch(input,init);const request=withAuth(input,init,rewritten||rawUrl);const promise=request?originalFetch(request):originalFetch(input,init);return promise.then(response=>{if(response.status===401&&isApiUrl(rawUrl)){clear();if(!location.pathname.endsWith('/admin/index.html')&&!location.pathname.endsWith('/admin/')){location.replace('/admin/index.html?session=expired');}}return response;});};
  window.CASmartAdminAuth={token:getToken,hasValidToken:()=>validateToken(getToken()),clear};

  document.addEventListener('DOMContentLoaded',()=>{
    const nav=document.querySelector('.admin-nav');
    if(!nav)return;
    const newBooking=nav.querySelector('.new-booking');
    const links=[
      {href:'page-designer.html',text:'Page Designer'},
      {href:'guest-account-designer.html',text:'Guest Account Designer'}
    ];
    links.forEach(item=>{
      if(nav.querySelector(`a[href="${item.href}"]`))return;
      const link=document.createElement('a');
      link.href=item.href;
      link.textContent=item.text;
      nav.insertBefore(link,newBooking||null);
    });
  });
})();
