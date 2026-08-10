(() => {
  const API = "https://ca-smart-staycation-muqd.onrender.com/api";
  let bookings = [];
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedRoom = "";
  let checkIn = "";
  let checkOut = "";
  let selecting = "checkIn";

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, "0");
  const key = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parse = v => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y,m,d] = v.split("-").map(Number);
      return new Date(y,m-1,d);
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(),d.getMonth(),d.getDate());
  };
  const terminal = b => ["Cancelled","Checked Out","Expired"].includes(String(b?.bookingStatus || ""));
  const roomId = b => String(b?.room?._id || b?.room || "");

  const bookedForRoom = date => bookings.some(b => {
    if (terminal(b) || !b?.room || !selectedRoom) return false;
    if (roomId(b) !== String(selectedRoom)) return false;
    const a=parse(b.checkIn), z=parse(b.checkOut);
    if(!a||!z) return false;
    return date >= a && date < z;
  });

  async function load() {
    try {
      const r = await fetch(`${API}/bookings`, {cache:"no-store",headers:{Accept:"application/json"}});
      const j = await r.json();
      bookings = r.ok && Array.isArray(j.data) ? j.data : [];
      render();
    } catch(e) {
      console.warn("Admin booking calendar availability load failed",e);
      bookings=[];
      render();
    }
  }

  function ensureCalendar() {
    if ($("adminBookingCalendar")) return;
    const ci=$("abCheckIn");
    if(!ci) return;
    const wrap=document.createElement("div");
    wrap.id="adminBookingCalendar";
    wrap.className="admin-booking-calendar";
    ci.parentElement?.parentElement?.insertAdjacentElement("afterend",wrap);
  }

  function render() {
    ensureCalendar();
    const root=$("adminBookingCalendar");
    if(!root)return;
    const y=month.getFullYear(), m=month.getMonth();
    const first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(), start=first.getDay();
    const today=new Date(); today.setHours(0,0,0,0);
    const names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    let html=`<div class="abc-mode"><strong>${selecting === "checkOut" ? "Select Check-out Date" : "Select Check-in Date"}</strong><span>${selecting === "checkOut" && checkIn ? `Check-in: ${checkIn}` : "Choose your dates below"}</span></div>`;
    html+=`<div class="abc-head"><button type="button" data-prev aria-label="Previous month">‹</button><strong>${month.toLocaleString("en-US",{month:"long",year:"numeric"})}</strong><button type="button" data-next aria-label="Next month">›</button></div><div class="abc-week">${names.map(n=>`<span>${n}</span>`).join("")}</div><div class="abc-grid">`;
    for(let i=0;i<start;i++) html+="<span class=abc-empty></span>";

    for(let d=1;d<=days;d++) {
      const date=new Date(y,m,d), k=key(date);
      const past=date<today;
      const booked=bookedForRoom(date);
      const invalidCheckout=selecting === "checkOut" && checkIn && k <= checkIn;
      const selected=k===checkIn||k===checkOut;
      const between=checkIn&&checkOut&&k>checkIn&&k<checkOut;
      const cls=["abc-day",past?"past":"",booked?"booked":"",selected?"selected":"",between?"between":"",invalidCheckout?"invalid":""].filter(Boolean).join(" ");
      html+=`<button type="button" class="${cls}" data-date="${k}" ${past||booked||invalidCheckout?"disabled":""}>${d}${booked?'<small>Booked</small>':''}</button>`;
    }
    html+="</div><div class=abc-legend><span><i class=free></i>Available</span><span><i class=busy></i>Booked</span></div>";
    root.innerHTML=html;

    root.querySelector("[data-prev]").onclick=()=>{month=new Date(y,m-1,1);render()};
    root.querySelector("[data-next]").onclick=()=>{month=new Date(y,m+1,1);render()};
    root.querySelectorAll("[data-date]").forEach(b=>b.onclick=()=>pick(b.dataset.date));
  }

  function pick(v) {
    if(selecting === "checkIn") {
      checkIn=v;
      checkOut="";
      selecting="checkOut";
    } else {
      if(v<=checkIn)return;
      checkOut=v;
    }

    const ci=$("abCheckIn"),co=$("abCheckOut");
    if(ci)ci.value=checkIn;
    if(co){co.value=checkOut;co.min=checkIn||"";}
    if(typeof updateAdminBookingSummary==="function") updateAdminBookingSummary();
    render();
  }

  function syncFromInputs() {
    const ci=$("abCheckIn"),co=$("abCheckOut"),room=$("abRoom");
    checkIn=ci?.value||"";
    checkOut=co?.value||"";
    selectedRoom=room?.value||"";
    selecting=checkIn && !checkOut ? "checkOut" : "checkIn";
    const d=parse(checkIn||checkOut);
    if(d)month=new Date(d.getFullYear(),d.getMonth(),1);
    render();
  }

  function init() {
    ensureCalendar();
    const ci=$("abCheckIn"),co=$("abCheckOut");

    // Both fields use the same custom availability calendar so booked-date
    // markings and selection rules are identical for check-in and check-out.
    [ci,co].forEach(input=>{
      if(!input)return;
      input.setAttribute("readonly","readonly");
      input.addEventListener("click",()=>{
        selecting=input.id === "abCheckOut" ? "checkOut" : "checkIn";
        const d=parse(selecting === "checkOut" ? (checkOut||checkIn) : (checkIn||checkOut));
        if(d)month=new Date(d.getFullYear(),d.getMonth(),1);
        render();
      });
      input.addEventListener("focus",()=>input.click());
    });

    $("abRoom")?.addEventListener("change",()=>{
      selectedRoom=$("abRoom").value||"";
      load();
    });
    $("navNewBooking")?.addEventListener("click",()=>{
      setTimeout(()=>{syncFromInputs();load()},100);
    });
    window.addEventListener("admin-booking-options-loaded",()=>{
      selectedRoom=$("abRoom")?.value||"";
      load();
    });
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
    window.addEventListener("focus",load);
    syncFromInputs();
    load();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
