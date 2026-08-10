const ADMIN_DETAILS_API = "https://ca-smart-staycation-muqd.onrender.com/api";
const originalAdminViewBooking = window.viewBooking;

function adminDetailsEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function adminDetailsDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}
function adminDetailsDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function adminDetailsMoney(value) { return `₱${Number(value || 0).toLocaleString("en-PH")}`; }

window.viewBooking = async function(id) {
    if (typeof originalAdminViewBooking === "function") originalAdminViewBooking(id);
    try {
        const response = await fetch(`${ADMIN_DETAILS_API}/bookings`, { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || "Unable to load booking details.");
        const booking = (json.data || []).find(b => String(b._id) === String(id));
        if (!booking) throw new Error("Booking not found.");

        const room = booking.room ? `${booking.room.unitNumber || booking.room.roomNumber || "Room"} — ${booking.room.unitName || booking.room.roomName || ""}` : "None";
        const parking = booking.parking ? `${booking.parking.parkingNumber || "Parking"} — ${booking.parking.parkingName || ""}` : "None";
        const bookingType = booking.parkingOnly ? "Parking Only" : (booking.parking ? "Accommodation + Parking" : "Accommodation Only");
        const guest = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
        const documentLink = (label, field, available) => available
            ? `<div class="notes"><span>${label}</span><p><a class="proof" target="_blank" rel="noopener" href="${ADMIN_DETAILS_API}/bookings/${encodeURIComponent(booking._id)}/documents/${field}">Open ${label}</a></p></div>`
            : `<div class="notes"><span>${label}</span><p>No document uploaded.</p></div>`;

        document.getElementById("modalTitle").textContent = booking.bookingReference || "Booking Details";
        document.getElementById("bookingDetails").innerHTML = `
            <div class="detail-grid">
                <div><span>Guest</span><strong>${adminDetailsEscape(guest)}</strong></div>
                <div><span>Mobile</span><strong>${adminDetailsEscape(booking.mobile || "—")}</strong></div>
                <div><span>Email</span><strong>${adminDetailsEscape(booking.email || "—")}</strong></div>
                <div><span>Address</span><strong>${adminDetailsEscape(booking.address || "—")}</strong></div>
                <div><span>Booking Type</span><strong>${bookingType}</strong></div>
                <div><span>Booking Status</span><strong>${adminDetailsEscape(booking.bookingStatus || "—")}</strong></div>
                <div><span>Check-in</span><strong>${adminDetailsDate(booking.checkIn)}</strong></div>
                <div><span>Check-out</span><strong>${adminDetailsDate(booking.checkOut)}</strong></div>
                <div><span>Accommodation</span><strong>${adminDetailsEscape(room)}</strong></div>
                <div><span>Parking</span><strong>${adminDetailsEscape(parking)}</strong></div>
                <div><span>Guests</span><strong>${adminDetailsEscape(booking.adults ?? 0)} adults · ${adminDetailsEscape(booking.children ?? 0)} children</strong></div>
                <div><span>Payment</span><strong>${adminDetailsEscape(booking.paymentStatus || "Pending")}</strong></div>
                <div><span>Total</span><strong>${adminDetailsMoney(booking.totalAmount)}</strong></div>
                <div><span>Payment Reference</span><strong>${adminDetailsEscape(booking.paymentReference || "—")}</strong></div>
                <div><span>Payment Date</span><strong>${adminDetailsDateTime(booking.paymentDate)}</strong></div>
                <div><span>Created</span><strong>${adminDetailsDateTime(booking.createdAt)}</strong></div>
            </div>
            <div class="notes"><span>Vehicle Information</span><p>${booking.parking ? `${adminDetailsEscape(booking.vehicleBrand || "—")} ${adminDetailsEscape(booking.vehicleModel || "")} · ${adminDetailsEscape(booking.vehicleColor || "—")} · Plate: ${adminDetailsEscape(booking.plateNumber || "—")}` : "No parking vehicle information."}</p></div>
            ${documentLink("Government-Issued ID", "governmentId", Boolean(booking.governmentId))}
            ${booking.parking ? documentLink("Driver's License", "driversLicense", Boolean(booking.driversLicense)) : ""}
            <div class="notes"><span>Payment Proof</span><p>${booking.paymentProof ? `<a class="proof" target="_blank" rel="noopener" href="${ADMIN_DETAILS_API}/uploads/payments/${encodeURIComponent(booking.paymentProof)}">Open uploaded payment proof</a>` : "No payment proof uploaded."}</p></div>
            <div class="notes"><span>Notes</span><p>${adminDetailsEscape(booking.notes || "No notes.")}</p></div>
        `;
        document.getElementById("bookingModal").hidden = false;
    } catch (err) {
        console.error("ADMIN BOOKING DETAILS ERROR:", err);
        alert(err.message || "Unable to load booking details.");
    }
};

/* Three-tab admin workspace: My Bookings, Notifications, Messages. */
(function installAdminThreeTabs(){
    function init(){
        const nav=document.querySelector('.admin-nav');
        const shell=document.getElementById('adminShell');
        if(!nav||!shell||document.getElementById('adminThreeTabs')) return;
        const tabs=document.createElement('div');
        tabs.id='adminThreeTabs';
        tabs.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px;padding:6px;background:#eef3f0;border:1px solid #d7e1dc;border-radius:10px;';
        const makeTab=(id,label)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=label;b.style.cssText='flex:1;min-width:150px;border:0;border-radius:7px;padding:12px 16px;background:transparent;color:#173f35;font-weight:700;font-size:15px;cursor:pointer;';return b;};
        const bookingsTab=makeTab('adminTabBookings','My Bookings');
        const notificationsTab=makeTab('adminTabNotifications','Notifications');
        const messagesTab=makeTab('adminTabMessages','Messages');
        tabs.append(bookingsTab,notificationsTab,messagesTab);
        nav.replaceWith(tabs);

        const existingSections=[...shell.children].filter(el=>!['header','adminThreeTabs'].includes(el.tagName.toLowerCase()) && !el.classList.contains('modal') && !el.classList.contains('admin-booking-modal'));
        const bookingContent=document.createElement('div');
        bookingContent.id='adminTabBookingsPanel';
        existingSections.forEach(el=>bookingContent.appendChild(el));
        const notificationPanel=document.createElement('section');
        notificationPanel.id='adminTabNotificationsPanel';
        notificationPanel.style.cssText='display:none;background:#fff;border:1px solid #dfe6e2;border-radius:10px;padding:20px;';
        notificationPanel.innerHTML='<iframe title="Admin Notifications" src="notifications.html?embedded=1" style="width:100%;height:650px;border:0;border-radius:8px;background:#f5f7f6"></iframe>';
        const messagePanel=document.createElement('section');
        messagePanel.id='adminTabMessagesPanel';
        messagePanel.style.cssText='display:none;background:#fff;border:1px solid #dfe6e2;border-radius:10px;padding:20px;';
        messagePanel.innerHTML='<iframe title="Admin Messages" src="messages.html?embedded=1" style="width:100%;height:700px;border:0;border-radius:8px;background:#f5f7f6"></iframe>';
        shell.append(bookingContent,notificationPanel,messagePanel);

        const all=[bookingsTab,notificationsTab,messagesTab],panels=[bookingContent,notificationPanel,messagePanel];
        function activate(index){all.forEach((b,i)=>{b.style.background=i===index?'#173f35':'transparent';b.style.color=i===index?'#fff':'#173f35';});panels.forEach((p,i)=>p.style.display=i===index?'block':'none');if(index>0){const frame=panels[index].querySelector('iframe');if(frame&&frame.contentWindow)try{frame.contentWindow.postMessage({type:'admin-tab-active'},'*')}catch(e){}}}
        bookingsTab.onclick=()=>activate(0);notificationsTab.onclick=()=>activate(1);messagesTab.onclick=()=>activate(2);
        activate(0);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
