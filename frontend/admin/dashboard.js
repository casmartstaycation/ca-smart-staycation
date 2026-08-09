const API="https://ca-smart-staycation-muqd.onrender.com/api";
let bookings=[],rooms=[],parking=[];
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const dateOnly=v=>{if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10)};
const fmtDate=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})};
const money=v=>`₱${Number(v||0).toLocaleString("en-PH")}`;
async function get(path){const r=await fetch(API+path);const j=await r.json();if(!r.ok)throw new Error(j.message||`Request failed: ${path}`);return j.data||[]}
function active(b){return !["Cancelled","Checked Out"].includes(b.bookingStatus)}
function render(){
 const today=dateOnly(new Date());
 $("todayCheckins").textContent=bookings.filter(b=>active(b)&&dateOnly(b.checkIn)===today).length;
 $("todayCheckouts").textContent=bookings.filter(b=>dateOnly(b.checkOut)===today).length;
 $("activeStays").textContent=bookings.filter(b=>b.bookingStatus==="Checked In").length;
 $("pendingPayments").textContent=bookings.filter(b=>b.paymentStatus==="Pending").length;
 const revenue=bookings.filter(b=>b.paymentStatus==="Paid"&&b.bookingStatus!=="Cancelled").reduce((s,b)=>s+Number(b.totalAmount||0),0);
 $("revenue").textContent=money(revenue);
 $("roomSummary").textContent=`${rooms.length} unit${rooms.length===1?"":"s"}`;
 $("parkingSummary").textContent=`${parking.length} slot${parking.length===1?"":"s"}`;
 $("rooms").innerHTML=rooms.length?rooms.map(r=>`<div class="resource"><div><div class="resource-name">${esc(r.unitNumber||r.roomNumber||"Unit")}</div><div class="resource-meta">${esc(r.unitName||r.roomName||"")} · ${money(r.price)}/night</div></div><span class="badge ${String(r.status||"").toLowerCase()==="available"?"available":"occupied"}">${esc(r.status||"Unknown")}</span></div>`).join(""):"<div class=\"muted\">No accommodation records.</div>";
 $("parking").innerHTML=parking.length?parking.map(p=>`<div class="resource"><div><div class="resource-name">${esc(p.parkingNumber||"Parking")}</div><div class="resource-meta">${esc(p.parkingName||"")} · ${money(p.rate)}/night</div></div><span class="badge ${String(p.status||"").toLowerCase()==="available"?"available":"occupied"}">${esc(p.status||"Unknown")}</span></div>`).join(""):"<div class=\"muted\">No parking records.</div>";
 const events=bookings.filter(b=>dateOnly(b.checkIn)===today||dateOnly(b.checkOut)===today).sort((a,b)=>new Date(a.checkIn)-new Date(b.checkIn));
 $("activity").innerHTML=events.length?events.map(b=>{const type=dateOnly(b.checkIn)===today?"Check-in":"Check-out";const guest=`${b.firstName||""} ${b.lastName||""}`.trim()||"Guest";return `<div class="activity-row"><strong>${type}</strong><div><div>${esc(guest)}</div><div class="muted">${esc(b.bookingReference||"")} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}</div></div><span class="money">${money(b.totalAmount)}</span></div>`}).join(""):"<div class=\"muted\">No check-ins or check-outs today.</div>";
 $("lastUpdated").textContent=`Updated ${new Date().toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}`;
}
async function load(){
 $("refreshBtn").disabled=true;
 try{[bookings,rooms,parking]=await Promise.all([get("/bookings"),get("/rooms"),get("/parking")]);render()}catch(e){console.error(e);alert("Dashboard could not load all data. Please check the API connection.")}finally{$("refreshBtn").disabled=false}
}
$("refreshBtn").addEventListener("click",load);load();
