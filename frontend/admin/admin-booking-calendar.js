(() => {
  const API="https://ca-smart-staycation-muqd.onrender.com/api";
  let bookings=[], month=new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedRoom="", checkIn="", checkOut="", selecting="checkIn";
  const $=id=>document.getElementById(id), pad=n=>String(n).padStart(2,"0");
  const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parse=v=>{if(!v)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const [y,m,d]=v.split("-").map(Number);return new Date(y,m-1,d)}const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate())};
  const terminal=b=>["Cancelled","Checked Out","Expired"].includes(String(b?.bookingStatus||""));
  const roomId=b=>String(b?.room?._id||b?.room||"");
  const activeAccommodationBookings=()=>bookings.filter(b=>!terminal(b)&&b?.room&&roomId(b)===String(selectedRoom));
  const occupied=d=>activeAccommodationBookings().some(b=>{const a=parse(b.checkIn),z=parse(b.checkOut);return a&&z&&d>=a&&d<z});

  async function load(){try{const r=await fetch(`${API}/bookings`,{cache:"no-store",headers:{Accept:"application/json"}});const j=await r.json();bookings=r.ok&&Array.isArray(j.data)?j.data:[];render()}catch(e){console.warn("Admin availability load failed",e);bookings=[];render()}}

  function ensure(){if($("adminBookingCalendar"))return;const ci=$("abCheckIn");if(!ci)return;const wrap=document.createElement("div");wrap.id="adminBookingCalendar";wrap.className="admin-booking-calendar";ci.closest(".admin-booking-grid")?.insertAdjacentElement("afterend",wrap)}

  function render(){ensure();const root=$("adminBookingCalendar");if(!root)return;const y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=first.getDay(),today=new Date();today.setHours(0,0,0,0);const names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    let h=`<div class="abc-mode"><strong>${selecting==="checkOut"?"Select Check-out Date":"Select Check-in Date"}</strong><span>${selectedRoom?"Availability is synchronized with guest bookings":"Select an accommodation to view availability"}</span></div>`;
    h+=`<div class="abc-head"><button type="button" data-prev>‹</button><strong>${month.toLocaleString("en-US",{month:"long",year:"numeric"})}</strong><button type="button" data-next>›</button></div><div class="abc-week">${names.map(n=>`<span>${n}</span>`).join("")}</div><div class="abc-grid">`;
    for(let i=0;i<start;i++)h+="<span class=abc-empty></span>";
    for(let d=1;d<=days;d++){const date=new Date(y,m,d),k=key(date),past=date<today,busy=selectedRoom&&occupied(date),badOut=selecting==="checkOut"&&checkIn&&k<=checkIn,sel=k===checkIn||k===checkOut,between=checkIn&&checkOut&&k>checkIn&&k<checkOut;const cls=["abc-day",past?"past":"",busy?"booked":"",sel?"selected":"",between?"between":"",badOut?"invalid":""].filter(Boolean).join(" ");h+=`<button type="button" class="${cls}" data-date="${k}" ${past||busy||badOut?"disabled":""}>${d}${busy?"<small>Booked</small>":""}</button>`}
    h+=`</div><div class=abc-legend><span><i class=free></i>Available</span><span><i class=busy></i>Booked</span></div>`;root.innerHTML=h;
    root.querySelector("[data-prev]").onclick=()=>{month=new Date(y,m-1,1);render()};root.querySelector("[data-next]").onclick=()=>{month=new Date(y,m+1,1);render()};root.querySelectorAll("[data-date]").forEach(b=>b.onclick=()=>pick(b.dataset.date));
  }

  function pick(v){if(selecting==="checkIn"){checkIn=v;checkOut="";selecting="checkOut"}else{if(v<=checkIn)return;checkOut=v}const ci=$("abCheckIn"),co=$("abCheckOut");if(ci)ci.value=checkIn;if(co)co.value=checkOut;if(typeof updateAdminBookingSummary==="function")updateAdminBookingSummary();render()}
  function sync(){const room=$("abRoom");selectedRoom=room?.value||"";checkIn=$("abCheckIn")?.value||"";checkOut=$("abCheckOut")?.value||"";selecting=checkIn&&!checkOut?"checkOut":"checkIn";const d=parse(checkIn||checkOut);if(d)month=new Date(d.getFullYear(),d.getMonth(),1);render()}

  function init(){ensure();const ci=$("abCheckIn"),co=$("abCheckOut");
    [ci,co].forEach(input=>{if(!input)return;input.type="text";input.setAttribute("readonly","readonly");input.setAttribute("autocomplete","off");input.removeAttribute("min");input.removeAttribute("max");input.addEventListener("click",()=>{selecting=input.id==="abCheckOut"?"checkOut":"checkIn";render()});input.addEventListener("focus",()=>input.click())});
    $("abRoom")?.addEventListener("change",()=>{selectedRoom=$("abRoom").value||"";load()});$("navNewBooking")?.addEventListener("click",()=>setTimeout(()=>{sync();load()},100));window.addEventListener("admin-booking-options-loaded",()=>{sync();load()});document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});window.addEventListener("focus",load);setTimeout(()=>{sync();load()},0);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();