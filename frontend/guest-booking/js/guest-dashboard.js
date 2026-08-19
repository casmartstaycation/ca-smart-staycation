/* Guest dashboard enhancements: account settings + additional guest/amenity payment uploads. */
(function(){
  const API='/api';
  const tokenKey='guestAuthToken';
  const UNIT_MAX_CAPACITY=4;
  const EXTRA_RATE=300;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let bookingMap=new Map();
  function auth(){return {Authorization:`Bearer ${localStorage.getItem(tokenKey)||''}`};}

  // The guest Message Inbox is a conversation area, not a booking-details view.
  // Remove sender/booking metadata that older inbox renderers may add and keep
  // only the actual message body and its attachments.
  function cleanMessageInbox(){
    const list=document.getElementById('messagesList');
    if(!list)return;
    list.querySelectorAll('.message').forEach(message=>{
      message.querySelectorAll('small,.booking-details,.booking-summary,.booking-card,.booking-info,[data-booking-details]').forEach(el=>el.remove());
    });
  }

  function addAccountSettings(){if(document.getElementById('accountSettingsBtn'))return true;const nav=document.querySelector('#bookingsBtn')?.parentElement||document.querySelector('.tabs,.tab-nav,.dashboard-tabs,nav');if(!nav)return false;const btn=document.createElement('button');btn.type='button';btn.id='accountSettingsBtn';btn.className='tab-button';btn.textContent='Account Settings';btn.title='Manage your email address and password';btn.addEventListener('click',()=>{location.href='account-settings.html'});nav.appendChild(btn);return true;}
  async function loadBookingMap(){try{const r=await fetch(`${API}/guest-auth/me`,{headers:auth(),cache:'no-store'}),d=await r.json();if(!r.ok||!Array.isArray(d.bookings))return;bookingMap=new Map(d.bookings.map(b=>[String(b.bookingReference||'').trim(),b]));decorateBookings()}catch(e){console.warn('Unable to load extra-request booking data',e)}}
  function decorateBookings(){document.querySelectorAll('.booking-card').forEach(card=>{if(card.querySelector('.extra-request-box'))return;const ref=card.querySelector('.reference')?.textContent?.trim(),booking=bookingMap.get(ref),details=card.querySelector('.details');if(!booking||!booking._id||!details)return;
    const bookingType=String(booking.bookingType||'').trim().toLowerCase();
    const parkingOnly=Boolean(booking.parkingOnly)||bookingType==='parking'||bookingType==='parking only';
    if(parkingOnly)return;
    const currentAdults=Math.max(0,Number(booking.adults||0));
    const maxCapacity=Math.max(1,Number(booking.room?.capacity||UNIT_MAX_CAPACITY));
    const existingExtraGuests=(booking.extraRequests||[]).filter(r=>['Pending','Approved','Paid'].includes(r.status)&&r.type==='extra_guest').reduce((sum,r)=>sum+Number(r.quantity||0),0);
    const remainingGuestCapacity=Math.max(0,maxCapacity-currentAdults-existingExtraGuests);
    const noExtraGuest=remainingGuestCapacity<=0;
    const box=document.createElement('div');box.className='extra-request-box';box.style.cssText='margin-top:14px;padding:14px;border:1px solid #dfe5e2;border-radius:8px;background:#fff;';
    box.innerHTML=`<div style="font-weight:700;color:#0b5d4d;margin-bottom:8px">Additional Guest / Amenity Request</div><div style="font-size:13px;color:#68736e;margin-bottom:10px">Choose an additional guest or an extra set of towels, toiletries, blanket and bedsheet, then upload your payment proof.</div><div style="display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:end"><label style="font-size:13px">Request<select class="extra-type" style="width:100%;box-sizing:border-box;height:40px;margin-top:5px;padding:8px;border:1px solid #d5ddd9;border-radius:6px;background:#fff"><option value="extra_guest" ${noExtraGuest?'disabled':''}>Extra Guest — ₱300 per night</option><option value="extra_set">Extra Set of Amenities — ₱300 per set</option></select></label><label style="font-size:13px">Quantity<select class="extra-qty" style="width:100%;box-sizing:border-box;height:40px;margin-top:5px;padding:8px;border:1px solid #d5ddd9;border-radius:6px;background:#fff"></select></label></div>${noExtraGuest?`<div style="margin-top:10px;padding:9px 10px;background:#fff8e8;border-left:4px solid #c9a44c;font-size:12px;line-height:1.5;color:#5f553b"><strong>Maximum guest capacity reached.</strong> This booking already has ${currentAdults+existingExtraGuests} guest${currentAdults+existingExtraGuests===1?'':'s'}. The unit maximum is ${maxCapacity}.</div>`:''}<div class="extra-request-total" style="font-weight:700;margin-top:10px">Additional amount: ₱0</div><input class="extra-payment-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style="display:none"><button type="button" class="secondary extra-upload-payment" style="margin-top:10px">Upload Payment</button><div class="extra-request-status" style="margin-top:8px;font-size:13px"></div><div style="margin-top:12px;padding:10px;background:#fff8e8;border-left:4px solid #c9a44c;font-size:12px;line-height:1.5;color:#5f553b"><strong>Reminder:</strong> This request is subject to payment verification. It will only be processed after CA Smart Staycation verifies the uploaded payment.</div>`;
    details.appendChild(box);
    const typeEl=box.querySelector('.extra-type'),qtyEl=box.querySelector('.extra-qty'),totalEl=box.querySelector('.extra-request-total'),fileEl=box.querySelector('.extra-payment-file'),btn=box.querySelector('.extra-upload-payment'),status=box.querySelector('.extra-request-status');
    const nights=Math.max(1,Math.ceil((new Date(booking.checkOut)-new Date(booking.checkIn))/86400000)||1);
    function updateQuantity(){const isGuest=typeEl.value==='extra_guest';const max=isGuest?Math.min(2,remainingGuestCapacity):2;qtyEl.innerHTML=Array.from({length:Math.max(1,max)},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');if(isGuest&&remainingGuestCapacity<=0){qtyEl.disabled=true;btn.disabled=true;}else{qtyEl.disabled=false;btn.disabled=false;}}
    const updateTotal=()=>{updateQuantity();const q=Number(qtyEl.value||1),amount=typeEl.value==='extra_guest'?EXTRA_RATE*q*nights:EXTRA_RATE*q;totalEl.textContent=`Additional amount: ₱${amount.toLocaleString()} ${typeEl.value==='extra_guest'?`total for ${nights} night(s)`:'total per set'}`};
    typeEl.addEventListener('change',updateTotal);qtyEl.addEventListener('change',updateTotal);updateTotal();
    const existing=booking.extraRequests||[];if(existing.length){const labels={extra_guest:'Extra Guest',extra_set:'Extra Set of Amenities'};status.innerHTML=existing.map(r=>`${esc(labels[r.type]||r.type)} × ${Number(r.quantity||0)} — <strong>${esc(r.status)}</strong> (₱${Number(r.amount||0).toLocaleString()})`).join('<br>')}
    btn.addEventListener('click',()=>{if(typeEl.value==='extra_guest'&&remainingGuestCapacity<=0){status.textContent=`Maximum guest capacity reached. The unit maximum is ${maxCapacity}.`;status.style.color='#b42318';return}fileEl.click()});
    fileEl.addEventListener('change',async()=>{const file=fileEl.files?.[0];if(!file)return;if(file.size>10*1024*1024){status.textContent='Payment proof must be 10 MB or smaller.';status.style.color='#b42318';fileEl.value='';return}const reader=new FileReader();reader.onload=async()=>{btn.disabled=true;btn.textContent='Uploading Payment...';status.textContent='';try{const type=typeEl.value,quantity=Number(qtyEl.value||1);if(type==='extra_guest'&&quantity>remainingGuestCapacity)throw new Error(`Only ${remainingGuestCapacity} additional guest${remainingGuestCapacity===1?'':'s'} can be requested. The unit maximum is ${maxCapacity}.`);const r=await fetch(`${API}/guest-auth/bookings/${encodeURIComponent(booking._id)}/extra-requests`,{method:'POST',headers:{...auth(),'Content-Type':'application/json'},body:JSON.stringify({type,quantity,paymentProof:reader.result,paymentProofFileName:file.name}),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Unable to upload payment proof.');status.innerHTML='<strong>Payment proof uploaded successfully.</strong> Subject to payment verification.';status.style.color='#0b5d4d';btn.textContent='Payment Uploaded';booking.extraRequests=booking.extraRequests||[];booking.extraRequests.push(d.request||{type,quantity,status:'Pending'});if(type==='extra_guest')window.location.reload()}catch(e){status.textContent=e.message;status.style.color='#b42318';btn.disabled=false;btn.textContent='Upload Payment'}};reader.readAsDataURL(file)});
  })}
  function installObserver(){const root=document.getElementById('bookingsList');if(!root)return false;new MutationObserver(()=>decorateBookings()).observe(root,{childList:true,subtree:true});decorateBookings();return true}
  function start(){addAccountSettings();installObserver();loadBookingMap();setTimeout(addAccountSettings,500);
    const messageList=document.getElementById('messagesList');
    if(messageList)new MutationObserver(cleanMessageInbox).observe(messageList,{childList:true,subtree:true});
    cleanMessageInbox();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
