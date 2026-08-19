(function(){'use strict';
const API='/api';
const TOKEN_KEY='caSmartAdminToken';
function token(){return sessionStorage.getItem(TOKEN_KEY)||localStorage.getItem(TOKEN_KEY)||sessionStorage.getItem('adminToken')||sessionStorage.getItem('admin_token')||localStorage.getItem('adminToken')||localStorage.getItem('admin_token')||'';}
function esc(v){return String(v||'').replace(/[^a-zA-Z0-9._-]/g,'_');}
function isOldUpload(url){return /onrender\.com\/api\/uploads\//i.test(url)||/vercel\.app\/api\/uploads\//i.test(url)||/\/api\/uploads\//i.test(url);}
function normalizeLink(a){
  if(!a||a.dataset.adminFileNormalized==='1')return;
  const href=a.getAttribute('href')||'';
  if(!href)return;
  if(isOldUpload(href)){
    const row=a.closest('tr');
    const id=row?.querySelector('td:first-child .muted')?.textContent?.trim();
    if(id){a.href=`${API}/admin/bookings/${encodeURIComponent(id)}/file/payment`;a.dataset.adminFileNormalized='1';}
  }
}
function normalizeAll(){document.querySelectorAll('a.proof').forEach(normalizeLink);}
async function openProtected(a){
  normalizeLink(a);
  const href=a.getAttribute('href')||'';
  if(!href)return;
  if(!href.startsWith(API+'/admin/bookings/'))return;
  const t=token();
  if(!t){alert('Your admin session has expired. Please sign in again.');return;}
  const oldText=a.textContent;
  a.dataset.opening='1';a.textContent='Opening…';
  try{
    const r=await fetch(href,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});
    const ct=r.headers.get('content-type')||'';
    if(r.status===401||r.status===403)throw new Error('Your admin session has expired. Please sign in again.');
    if(!r.ok){let msg='Unable to open uploaded file.';if(ct.includes('application/json')){const d=await r.json().catch(()=>({}));msg=d.message||msg;}throw new Error(msg);}
    if(ct.includes('application/json')){const d=await r.json().catch(()=>({}));throw new Error(d.message||'The uploaded file could not be opened.');}
    const blob=await r.blob();
    if(!blob.size)throw new Error('The uploaded file is empty.');
    const url=URL.createObjectURL(blob);
    const w=window.open(url,'_blank','noopener,noreferrer');
    if(!w){URL.revokeObjectURL(url);throw new Error('Your browser blocked the file window. Please allow pop-ups for this site.');}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){alert(e.message||'Unable to open uploaded file.');}
  finally{a.dataset.opening='';a.textContent=oldText;}
}
document.addEventListener('click',function(e){const a=e.target.closest('a.proof');if(!a)return;normalizeLink(a);const href=a.getAttribute('href')||'';if(href.startsWith(API+'/admin/bookings/')){e.preventDefault();e.stopImmediatePropagation();openProtected(a);}},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalizeAll);else normalizeAll();
const observer=new MutationObserver(normalizeAll);observer.observe(document.documentElement,{childList:true,subtree:true});
setInterval(normalizeAll,1000);
})();