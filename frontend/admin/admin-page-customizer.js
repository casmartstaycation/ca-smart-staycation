/* CA Smart Staycation — Admin Page Designer runtime */
(function(){
'use strict';
const API='/api/settings/page-design/admin-page';
const STYLE_ID='ca-admin-page-designer-style';
let current=null;
function font(v){if(v==='modern')return'"Trebuchet MS",Arial,sans-serif';if(v==='classic')return'Georgia,"Times New Roman",serif';if(v==='luxury')return'"Times New Roman",Georgia,serif';return'Arial,Helvetica,sans-serif';}
function shadow(v){if(v==='none')return'none';if(v==='strong')return'0 18px 45px rgba(0,0,0,.18)';return'0 6px 18px rgba(0,0,0,.08)';}
function safeUrl(v){return String(v||'').replace(/[\\'\n\r]/g,m=>`\\${m}`);}
function apply(s){if(!s||typeof s!=='object')return;current=s;let style=document.getElementById(STYLE_ID);if(!style){style=document.createElement('style');style.id=STYLE_ID;document.head.appendChild(style);}const bg=s.pageBackgroundImageUrl?`url('${safeUrl(s.pageBackgroundImageUrl)}')`:'none';const cols=Math.max(1,Math.min(3,Number(s.mobileNavColumns)||2));style.textContent=`
html,body{background-color:${s.pageBackgroundColor}!important;color:${s.textColor}!important;font-family:${font(s.fontPreset)}!important;}
body{background-image:${bg}!important;background-size:cover!important;background-position:center!important;background-attachment:fixed!important;}
.page,.admin-shell,.wrap{max-width:${Number(s.pageMaxWidth)}px!important;padding-left:${Number(s.pagePadding)}px!important;padding-right:${Number(s.pagePadding)}px!important;}
.topbar h1,.wrap h1,.card h1,.card h2,.section-title{color:${s.primaryColor}!important;}
.subtitle,.muted,.eyebrow,.stat span{color:${s.mutedTextColor}!important;}
.admin-nav,.nav{background:${s.navBackgroundColor}!important;border-radius:${Number(s.buttonRadius)}px!important;}
.admin-nav a,.admin-nav button,.nav a{border-radius:${Number(s.buttonRadius)}px!important;border-color:${s.borderColor}!important;color:${s.primaryColor}!important;}
.admin-nav a.active,.admin-nav button.active,.nav a.active,.communication-tab.active{background:${s.primaryColor}!important;color:${s.buttonTextColor}!important;}
.admin-nav a:hover,.nav a:hover{background:${s.accentColor}!important;color:${s.buttonTextColor}!important;}
.card,.stat,.table-wrap,.modal-card,.form-card,.admin-email-settings,.payment-alert{background:${s.cardBackgroundColor}!important;border-color:${s.borderColor}!important;border-radius:${Number(s.cardRadius)}px!important;box-shadow:${shadow(s.shadow)}!important;}
button,.btn,.refresh,.primary-button,.action-button{border-radius:${Number(s.buttonRadius)}px!important;}
button:not(.danger):not(.logout),.btn,.refresh{background:${s.primaryColor}!important;color:${s.buttonTextColor}!important;}
.secondary,.communication-tab,.badge{background:${s.accentColor}!important;}
.danger,.error,.badge[style*="red"]{color:${s.dangerColor}!important;}
input,select,textarea{border-color:${s.borderColor}!important;border-radius:${Number(s.buttonRadius)}px!important;}
table th{color:${s.primaryColor}!important;}table td,table th{border-color:${s.borderColor}!important;}
${s.compactTables?'table td,table th{padding-top:7px!important;padding-bottom:7px!important;font-size:12px!important;}':''}
@media(max-width:700px){.page,.admin-shell,.wrap{padding-left:${Number(s.mobilePagePadding)}px!important;padding-right:${Number(s.mobilePagePadding)}px!important;}.admin-nav,.nav{display:grid!important;grid-template-columns:repeat(${cols},minmax(0,1fr))!important;}.admin-nav>* ,.nav>*{width:100%!important;min-width:0!important;}}
${String(s.customCss||'')}`;document.documentElement.dataset.adminPageDesignerReady='true';}
async function load(){if(new URLSearchParams(location.search).has('adminDesignerPreview'))return;try{const r=await fetch(API,{cache:'no-store',headers:{Accept:'application/json'}}),d=await r.json();if(!r.ok||!d?.success)throw Error(d?.message||`HTTP ${r.status}`);apply(d.data);}catch(e){console.warn('Admin page design unavailable; using built-in admin design.',e);}}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='ca-smart-admin-page-preview')return;apply(e.data.settings);});
window.CASmartAdminPageDesigner={apply,load,current:()=>current};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
