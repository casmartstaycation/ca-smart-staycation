/* Admin refund controls and unread notification badge. Loaded after bookings.js. */
(function(){
  const API="https://ca-smart-staycation-muqd.onrender.com/api",tokenKey="caSmartAdminToken";
  const token=()=>sessionStorage.getItem(tokenKey)||"";
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function addNotificationBadge(){const nav=document.querySelector('.admin-nav'),link=nav?.querySelector('a[href="notifications.html"]');if(!link)return;let badge=link.querySelector('.admin-unread-badge');if(!badge){badge=document.createElement('span');badge.className='admin-unread-badge';badge.style.cssText='display:none;margin-left:6px;min-width:18px;padding:2px 6px;border-radius:999px;background:#b42318;color:#fff;font-size:11px;text-align:center;line-height:1.2;';link.appendChild(badge);}}
  async function refreshUnread(){if(!token())return;addNotificationBadge();try{const r=await fetch(`${API}/admin/inbox`,{headers:{Authorization:`Bearer ${token()}`},cache:'no-store'}),d=await r.json();if(!r.ok)return;const unread=(d.notifications||[]).filter(n=>!n.read).length+(d.messages||[]).filter(m=>!m.readByAdmin).length,badge=document.querySelector('.admin-unread-badge');if(badge){badge.textContent=unread>99?'99+':String(unread);badge.style.display=unread?'inline-block':'none';}}catch(e){console.warn('ADMIN UNREAD CHECK:',e.message);}}
  async function processRefund(id,reference,amount,fee,button){if(!confirm(`Process refund for ${reference}?\n\nRefund amount: ₱${Number(amount||0).toLocaleString('en-PH')}\nConvenience fee: ₱${Number(fee||0).toLocaleString('en-PH')}\n\nOnly click OK after you have actually sent the refund to the guest.`))return;button.disabled=true;button.textContent='Processing...';try{const r=await fetch(`${API}/admin/bookings/${encodeURIComponent(id)}/refund`,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'}}),d=await r.json();if(!r.ok)throw new Error(d.message||'Unable to process refund.');alert(d.message||'Refund processed.');if(typeof window.loadBookings==='function')await window.loadBookings(true);await refreshUnread();}catch(e){alert(e.message);button.disabled=false;button.textContent='Process Refund';}}
  function installRefundAction(){if(typeof window.actionButtons!=='function'||window.actionButtons.__refundWrapped)return;const original=window.actionButtons;const wrapped=function(booking){let html=original(booking);if(booking&&booking.refundRequested&&booking.refundStatus!=='Refunded')html+=`<button class="refund-action" style="background:#b08a3c;color:#fff;border:0;border-radius:6px;padding:7px 9px;font-weight:700;cursor:pointer" onclick="processAdminRefund('${esc(booking._id)}','${esc(booking.bookingReference)}',${Number(booking.refundAmount||0)},${Number(booking.refundFee||0)},this)">Process Refund<br><small>₱${Number(booking.refundAmount||0).toLocaleString('en-PH')}</small></button>`;else if(booking&&booking.refundStatus==='Refunded')html+=`<span style="display:inline-block;padding:6px 8px;border-radius:6px;background:#e9f3ee;color:#0b5d4d;font-size:12px;font-weight:700">Refunded</span>`;return html;};wrapped.__refundWrapped=true;window.actionButtons=wrapped;}
  window.processAdminRefund=function(id,reference,amount,fee,button){processRefund(id,reference,amount,fee,button);};
  function boot(){installRefundAction();addNotificationBadge();refreshUnread();setInterval(refreshUnread,15000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

(function loadSecurityDepositRefundControls(){
  if (document.querySelector('script[data-security-deposit-refund-controls]')) return;
  const script = document.createElement('script');
  script.src = 'admin-security-deposit.js?v=20260822-1';
  script.dataset.securityDepositRefundControls = '1';
  document.head.appendChild(script);
})();
