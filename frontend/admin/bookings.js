const API = "https://ca-smart-staycation-muqd.onrender.com/api";
let bookings = [];
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const formatDate = value => { if(!value) return "—"; const d=new Date(value); return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"}); };
const formatDateTime = value => { if(!value) return "—"; const d=new Date(value); return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-PH",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); };
const money = value => `₱${Number(value||0).toLocaleString("en-PH")}`;
const TOKEN_KEY = "caSmartAdminToken";
const getAdminToken = () => sessionStorage.getItem(TOKEN_KEY) || "";
function setAdminToken(token){ if(token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); }
function showAdminShell(){ $("adminAuth").hidden=true; $("adminShell").hidden=false; }
function showAdminLogin(message=""){ setAdminToken(""); $("adminShell").hidden=true; $("adminAuth").hidden=false; $("adminAuthError").textContent=message; }
async function adminLogin(event){
  event.preventDefault();
  const email=$("adminEmail").value.trim();
  const password=$("adminPassword").value;
  $("adminAuthError").textContent="Signing in…";
  try{
    const res=await fetch(`${API}/admin-auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    const json=await res.json();
    if(!res.ok) throw new Error(json.message||"Admin login failed.");
    setAdminToken(json.token);
    $("adminPassword").value="";
    showAdminShell();
    await loadBookings();
  }catch(err){ $("adminAuthError").textContent=err.message||"Unable to sign in."; }
}
function authHeaders(json=false){ const headers={}; if(json) headers["Content-Type"]="application/json"; const token=getAdminToken(); if(token) headers.Authorization=`Bearer ${token}`; return headers; }
function statusClass(status){ if(status === "Pending Payment Verification") return "pending"; if(status === "Payment Rejected") return "cancelled"; if(status === "Checked In") return "checked"; if(status === "Checked Out") return "out"; if(status === "Cancelled") return "cancelled"; return "reserved"; }
function renderStats(){ $("totalCount").textContent=bookings.length; $("reservedCount").textContent=bookings.filter(b=>b.bookingStatus==="Reserved").length; $("pendingCount").textContent=bookings.filter(b=>b.bookingStatus==="Pending Payment Verification").length; $("checkedInCount").textContent=bookings.filter(b=>b.bookingStatus==="Checked In").length; }
function filteredBookings(){ const search=$("searchInput").value.trim().toLowerCase(); const status=$("statusFilter").value; const payment=$("paymentFilter").value; return bookings.filter(b=>{ const guest=`${b.firstName||""} ${b.lastName||""}`.toLowerCase(); const haystack=`${b.bookingReference||""} ${guest} ${b.mobile||""} ${b.email||""}`.toLowerCase(); return (!search||haystack.includes(search))&&(!status||b.bookingStatus===status)&&(!payment||b.paymentStatus===payment); }); }
function actionButtons(booking){ const id=esc(booking._id); const actions=[`<button class="view" onclick="viewBooking('${id}')">View</button>`]; if(booking.bookingStatus==="Pending Payment Verification"){ actions.push(`<button class="approve" onclick="approvePayment('${id}')">Approve Payment</button>`); actions.push(`<button class="cancel" onclick="rejectPayment('${id}')">Reject Payment</button>`); } if(booking.bookingStatus==="Payment Rejected"){ actions.push(`<button class="view" onclick="viewBooking('${id}')">Review</button>`); } if(booking.bookingStatus==="Reserved"){ actions.push(`<button class="checkin" onclick="checkIn('${id}')">Check In</button>`); actions.push(`<button class="cancel" onclick="cancelBooking('${id}')">Cancel</button>`); } if(booking.bookingStatus==="Checked In") actions.push(`<button class="checkout" onclick="checkOut('${id}')">Check Out</button>`); if(booking.bookingStatus==="Checked Out"&&booking.housekeepingStatus!=="Clean") actions.push(`<button class="clean" onclick="markClean('${id}')">Mark Clean</button>`); return actions.join(""); }
function renderBookings(){ const tbody=document.querySelector("#bookingTable tbody"); const rows=filteredBookings(); tbody.innerHTML=""; $("emptyState").hidden=rows.length!==0; rows.forEach(booking=>{ const guest=`${esc(booking.firstName)} ${esc(booking.lastName)}`.trim()||"Guest"; const room=booking.room?`${esc(booking.room.unitNumber||booking.room.roomNumber||"Room")}<div class="muted">${esc(booking.room.unitName||booking.room.roomName||"")}</div>`:"—"; const parking=booking.parking?`${esc(booking.parking.parkingNumber||booking.parking.parkingName||"Reserved")}<div class="muted">${esc(booking.parking.parkingName||"")}</div>`:(booking.parkingOnly?"Reserved":"—"); const proof=booking.paymentProof?`<a class="proof" target="_blank" rel="noopener" href="${API}/uploads/payments/${encodeURIComponent(booking.paymentProof)}">View proof</a>`:`<span class="muted">No upload</span>`; tbody.innerHTML+=`<tr><td><div class="ref">${esc(booking.bookingReference||"—")}</div><div class="muted">${esc(booking._id||"")}</div></td><td>${guest}<div class="muted">${esc(booking.mobile||booking.email||"")}</div></td><td>${formatDate(booking.checkIn)}<div class="muted">to ${formatDate(booking.checkOut)}</div></td><td>${room}</td><td>${parking}</td><td class="money">${money(booking.totalAmount)}</td><td>${esc(booking.paymentStatus||"Pending")}</td><td><span class="badge ${statusClass(booking.bookingStatus)}">${esc(booking.bookingStatus||"Reserved")}</span><div class="muted">${esc(booking.housekeepingStatus||"")}</div></td><td>${proof}</td><td><div class="actions">${actionButtons(booking)}</div></td></tr>`; }); }
function viewBooking(id){ const booking=bookings.find(b=>String(b._id)===String(id)); if(!booking)return; $("modalTitle").textContent=booking.bookingReference||"Booking Details"; const guest=`${booking.firstName||""} ${booking.lastName||""}`.trim()||"Guest"; const room=booking.room?`${booking.room.unitNumber||booking.room.roomNumber||"Room"} — ${booking.room.unitName||booking.room.roomName||""}`:"Parking Only"; const parking=booking.parking?`${booking.parking.parkingNumber||"Parking"} — ${booking.parking.parkingName||""}`:(booking.parkingOnly?"Parking reserved":"None"); const proof=booking.paymentProof?`<div class="notes"><span>Payment Proof</span><p><a class="proof" target="_blank" rel="noopener" href="${API}/uploads/payments/${encodeURIComponent(booking.paymentProof)}">Open uploaded payment proof</a></p></div>`:"<div class="notes"><span>Payment Proof</span><p>No payment proof uploaded.</p></div>"; $("bookingDetails").innerHTML=`<div class="detail-grid"><div><span>Guest</span><strong>${esc(guest)}</strong></div><div><span>Mobile</span><strong>${esc(booking.mobile||"—")}</strong></div><div><span>Email</span><strong>${esc(booking.email||"—")}</strong></div><div><span>Booking Status</span><strong>${esc(booking.bookingStatus||"—")}</strong></div><div><span>Check-in</span><strong>${formatDate(booking.checkIn)}</strong></div><div><span>Check-out</span><strong>${formatDate(booking.checkOut)}</strong></div><div><span>Accommodation</span><strong>${esc(room)}</strong></div><div><span>Parking</span><strong>${esc(parking)}</strong></div><div><span>Guests</span><strong>${esc(booking.adults??booking.guests??0)} adults · ${esc(booking.children||0)} children</strong></div><div><span>Payment</span><strong>${esc(booking.paymentStatus||"Pending")}</strong></div><div><span>Total</span><strong>${money(booking.totalAmount)}</strong></div><div><span>Housekeeping</span><strong>${esc(booking.housekeepingStatus||"—")}</strong></div><div><span>Payment Date</span><strong>${formatDateTime(booking.paymentDate)}</strong></div><div><span>Created</span><strong>${formatDateTime(booking.createdAt)}</strong></div></div>${proof}<div class="notes"><span>Notes</span><p>${esc(booking.notes||"No notes.")}</p></div>`; const actions=[]; const eid=esc(id); if(booking.bookingStatus==="Pending Payment Verification"){actions.push(`<button class="approve" onclick="approvePayment('${eid}');closeModal()">Approve Payment</button>`);actions.push(`<button class="cancel" onclick="rejectPayment('${eid}');closeModal()">Reject Payment</button>`);} if(booking.bookingStatus==="Reserved")actions.push(`<button class="checkin" onclick="checkIn('${eid}');closeModal()">Check In</button>`); if(booking.bookingStatus==="Checked In")actions.push(`<button class="checkout" onclick="checkOut('${eid}');closeModal()">Check Out</button>`); if(booking.bookingStatus==="Checked Out"&&booking.housekeepingStatus!=="Clean")actions.push(`<button class="clean" onclick="markClean('${eid}');closeModal()">Mark Clean</button>`); if(["Reserved","Pending Payment Verification","Payment Rejected"].includes(booking.bookingStatus))actions.push(`<button class="cancel" onclick="cancelBooking('${eid}');closeModal()">Cancel Booking</button>`); $("modalActions").innerHTML=actions.join(""); $("bookingModal").hidden=false; }
function closeModal(){ $("bookingModal").hidden=true; }
async function loadBookings(){ try{const res=await fetch(`${API}/bookings`);const json=await res.json();if(!res.ok)throw new Error(json.message||"Unable to load bookings.");bookings=Array.isArray(json.data)?json.data:[];renderStats();renderBookings();}catch(err){console.error(err);alert("Unable to load bookings. Please check the API connection.");} }
async function updateBooking(id,body,successMessage){ try{const res=await fetch(`${API}/bookings/${encodeURIComponent(id)}`,{method:"PUT",headers:authHeaders(true),body:JSON.stringify(body)});const json=await res.json();if(res.status===401||res.status===403){showAdminLogin("Your admin session expired. Please sign in again.");return;}if(!res.ok)throw new Error(json.message||"Update failed.");alert(successMessage||json.message||"Booking updated.");await loadBookings();}catch(err){console.error(err);alert(err.message||"Unable to update booking.");} }
async function protectedAction(path,successMessage){
  const token=getAdminToken();
  if(!token){showAdminLogin("Please sign in as admin to continue.");return false;}
  try{
    const res=await fetch(`${API}${path}`,{method:"PUT",headers:authHeaders()});
    const json=await res.json();
    if(res.status===401||res.status===403){showAdminLogin("Your admin session expired. Please sign in again.");return false;}
    if(!res.ok) throw new Error(json.message||"Action failed.");
    alert(successMessage||json.message||"Action completed.");
    await loadBookings();
    return true;
  }catch(err){alert(err.message||"Unable to complete action.");return false;}
}
async function approvePayment(id){if(!confirm("Approve this payment proof and confirm the booking?"))return;await protectedAction(`/bookings/${encodeURIComponent(id)}/approve-payment`,"Payment approved and booking confirmed.");}
async function rejectPayment(id){if(!confirm("Reject this payment proof? The guest will be emailed and can submit a new proof."))return;await protectedAction(`/bookings/${encodeURIComponent(id)}/reject-payment`,"Payment proof rejected.");}
async function checkIn(id){await updateBooking(id,{bookingStatus:"Checked In",housekeepingStatus:"Clean"},"Guest checked in.");}
async function checkOut(id){await updateBooking(id,{bookingStatus:"Checked Out",housekeepingStatus:"Needs Cleaning"},"Guest checked out.");}
async function markClean(id){await updateBooking(id,{housekeepingStatus:"Clean"},"Room marked clean.");}
async function cancelBooking(id){if(!confirm("Cancel this booking? It will no longer block availability."))return;await updateBooking(id,{bookingStatus:"Cancelled"},"Booking cancelled.");}
function logoutAdmin(){setAdminToken("");bookings=[];showAdminLogin("");}
$("adminLoginForm").addEventListener("submit",adminLogin);
$("refreshBtn").addEventListener("click",loadBookings);
$("logoutBtn").addEventListener("click",logoutAdmin);
$("searchInput").addEventListener("input",renderBookings);
$("statusFilter").addEventListener("change",renderBookings);
$("paymentFilter").addEventListener("change",renderBookings);
$("closeModal").addEventListener("click",closeModal);
$("bookingModal").addEventListener("click",e=>{if(e.target.id==="bookingModal")closeModal();});
if(getAdminToken()){showAdminShell();loadBookings();}else{showAdminLogin("");}
