const ADMIN_BOOKING_API = "https://ca-smart-staycation-muqd.onrender.com/api";
const AB_ROOM_RATE_FALLBACK = 2800;
const AB_EXTRA_GUEST_FEE = 300;
const AB_PARKING_RATE = 500;
const AB_SECURITY_DEPOSIT = 1000;
let adminRooms = [];
let adminParking = [];

const ab = id => document.getElementById(id);
const abMoney = value => `₱${Number(value || 0).toLocaleString("en-PH")}`;
const abEscape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

function adminToken(){ return sessionStorage.getItem("caSmartAdminToken") || ""; }
function adminHeaders(){ return { "Content-Type":"application/json", Authorization:`Bearer ${adminToken()}` }; }
function localDateString(d=new Date()){
  const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function nights(){
  const a=ab("abCheckIn").value, b=ab("abCheckOut").value;
  if(!a||!b) return 0;
  const diff=(new Date(`${b}T00:00:00`)-new Date(`${a}T00:00:00`))/86400000;
  return Number.isFinite(diff)&&diff>0?diff:0;
}
function selectedRoom(){ return adminRooms.find(r=>String(r._id)===ab("abRoom").value) || null; }
function selectedParking(){ return adminParking.find(p=>String(p._id)===ab("abParking").value) || null; }
function adminBookingTotal(){
  const n=nights();
  const adults=Math.max(1,Number(ab("abAdults").value||1));
  const parkingOnly=ab("abParkingOnly").value==="true";
  const room=selectedRoom();
  const parking=selectedParking();
  const roomRate=Number(room?.price||AB_ROOM_RATE_FALLBACK);
  const extraAdults=Math.max(0,adults-2);
  const roomCharge=parkingOnly?0:roomRate*n;
  const extraCharge=parkingOnly?0:extraAdults*AB_EXTRA_GUEST_FEE*n;
  const parkingCharge=parking?n*AB_PARKING_RATE:0;
  const deposit=AB_SECURITY_DEPOSIT;
  return {n,roomCharge,extraCharge,parkingCharge,deposit,total:roomCharge+extraCharge+parkingCharge+deposit,extraAdults,roomRate,parkingOnly};
}
function updateAdminBookingSummary(){
  const x=adminBookingTotal();
  ab("abSummary").innerHTML=`<div><span>Nights</span><strong>${x.n||0}</strong></div><div><span>Accommodation</span><strong>${abMoney(x.roomCharge)}</strong></div>${x.extraCharge?`<div><span>Extra adults (${x.extraAdults})</span><strong>${abMoney(x.extraCharge)}</strong></div>`:""}${x.parkingCharge?`<div><span>Parking</span><strong>${abMoney(x.parkingCharge)}</strong></div>`:""}<div><span>Refundable security deposit</span><strong>${abMoney(x.deposit)}</strong></div><div class="grand"><span>TOTAL AMOUNT</span><strong>${abMoney(x.total)}</strong></div>`;
}
function updateParkingOnlyUI(){
  const only=ab("abParkingOnly").value==="true";
  ab("abRoom").disabled=only;
  if(only) ab("abRoom").value="";
  updateAdminBookingSummary();
}
async function loadAdminBookingOptions(){
  const token=adminToken();
  if(!token) return;
  try{
    const [roomsRes,parkingRes]=await Promise.all([
      fetch(`${ADMIN_BOOKING_API}/rooms`,{cache:"no-store"}),
      fetch(`${ADMIN_BOOKING_API}/parking`,{cache:"no-store"})
    ]);
    const roomsJson=await roomsRes.json(); const parkingJson=await parkingRes.json();
    adminRooms=Array.isArray(roomsJson.data)?roomsJson.data:[];
    adminParking=Array.isArray(parkingJson.data)?parkingJson.data:[];
    ab("abRoom").innerHTML=`<option value="">Select accommodation</option>${adminRooms.map(r=>`<option value="${abEscape(r._id)}">${abEscape(r.unitNumber)} — ${abEscape(r.unitName)} (${abMoney(r.price)}/night)</option>`).join("")}`;
    ab("abParking").innerHTML=`<option value="">No parking</option>${adminParking.map(p=>`<option value="${abEscape(p._id)}">${abEscape(p.parkingNumber||p.parkingName||"Parking")}</option>`).join("")}`;
  }catch(err){
    console.error("ADMIN BOOKING OPTIONS ERROR:",err);
    ab("abError").textContent="Unable to load accommodations or parking options.";
  }
}
function openAdminBooking(){
  ab("adminBookingModal").hidden=false;
  ab("abError").textContent="";
  const today=localDateString();
  ab("abCheckIn").min=today; ab("abCheckOut").min=today;
  loadAdminBookingOptions();
  updateAdminBookingSummary();
}
function closeAdminBooking(){ ab("adminBookingModal").hidden=true; }
async function submitAdminBooking(event){
  event.preventDefault();
  const x=adminBookingTotal();
  const room=selectedRoom();
  const parking=selectedParking();
  const parkingOnly=ab("abParkingOnly").value==="true";
  const checkIn=ab("abCheckIn").value;
  const checkOut=ab("abCheckOut").value;
  const adults=Math.max(1,Number(ab("abAdults").value||1));
  if(!adminToken()){ ab("abError").textContent="Your admin session has expired. Please sign in again."; return; }
  if(!x.n){ ab("abError").textContent="Please select a valid check-in and check-out date."; return; }
  if(!parkingOnly&&!room){ ab("abError").textContent="Please select an accommodation or choose Parking Only."; return; }
  if(adults>4){ ab("abError").textContent="Maximum occupancy is 4 adults."; return; }
  const button=event.submitter; button.disabled=true; button.textContent="Creating…"; ab("abError").textContent="";
  try{
    const body={
      firstName:ab("abFirstName").value.trim(), lastName:ab("abLastName").value.trim(),
      email:ab("abEmail").value.trim(), mobile:ab("abMobile").value.trim(), address:ab("abAddress").value.trim(),
      room:parkingOnly?null:room?._id||null, parking:parking?._id||null, parkingOnly,
      checkIn, checkOut, adults, children:Math.max(0,Number(ab("abChildren").value||0)),
      totalAmount:x.total, paymentStatus:ab("abPaymentStatus").value,
      paymentReference:ab("abPaymentReference").value.trim(), notes:ab("abNotes").value.trim()
    };
    const res=await fetch(`${ADMIN_BOOKING_API}/admin/bookings`,{method:"POST",headers:adminHeaders(),body:JSON.stringify(body)});
    const json=await res.json();
    if(res.status===401||res.status===403){ ab("abError").textContent="Your admin session has expired. Please sign in again."; return; }
    if(!res.ok) throw new Error(json.message||"Unable to create booking.");
    alert(`Booking created successfully.\nReference: ${json.data?.bookingReference||"—"}`);
    closeAdminBooking();
    if(typeof loadBookings==="function") await loadBookings();
    ab("adminBookingForm").reset();
    ab("abAdults").value="2";
    ab("abPaymentStatus").value="Paid";
    ab("abParkingOnly").value="false";
    updateParkingOnlyUI();
  }catch(err){
    console.error("ADMIN CREATE BOOKING ERROR:",err);
    ab("abError").textContent=err.message||"Unable to create booking.";
  }finally{
    button.disabled=false; button.textContent="Create Booking";
  }
}

ab("newBookingBtn").addEventListener("click",openAdminBooking);
ab("adminBookingClose").addEventListener("click",closeAdminBooking);
ab("adminBookingCancel").addEventListener("click",closeAdminBooking);
ab("adminBookingForm").addEventListener("submit",submitAdminBooking);
ab("abParkingOnly").addEventListener("change",updateParkingOnlyUI);
["abCheckIn","abCheckOut","abRoom","abParking","abAdults","abChildren"].forEach(id=>ab(id).addEventListener("input",updateAdminBookingSummary));
ab("abCheckIn").addEventListener("change",()=>{
  const value=ab("abCheckIn").value;
  ab("abCheckOut").min=value||localDateString();
  if(ab("abCheckOut").value&&value&&ab("abCheckOut").value<=value) ab("abCheckOut").value="";
  updateAdminBookingSummary();
});
ab("adminBookingModal").addEventListener("click",e=>{if(e.target.id==="adminBookingModal")closeAdminBooking();});
