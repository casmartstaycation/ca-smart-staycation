const API = "https://ca-smart-staycation-muqd.onrender.com/api";
let bookings = [];

const $ = id => document.getElementById(id);

function escapeHtml(value){
    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

function formatDate(value){
    if(!value) return "—";
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"});
}

function statusClass(status){
    if(status === "Pending Payment Verification") return "pending";
    if(status === "Checked In") return "checked";
    if(status === "Checked Out") return "out";
    if(status === "Cancelled") return "cancelled";
    return "reserved";
}

function renderStats(){
    $("totalCount").textContent = bookings.length;
    $("reservedCount").textContent = bookings.filter(b=>b.bookingStatus === "Reserved").length;
    $("pendingCount").textContent = bookings.filter(b=>b.bookingStatus === "Pending Payment Verification").length;
    $("checkedInCount").textContent = bookings.filter(b=>b.bookingStatus === "Checked In").length;
}

function filteredBookings(){
    const search = $("searchInput").value.trim().toLowerCase();
    const status = $("statusFilter").value;
    const payment = $("paymentFilter").value;

    return bookings.filter(b=>{
        const guest = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
        const matchesSearch = !search ||
            String(b.bookingReference || "").toLowerCase().includes(search) ||
            guest.includes(search);
        return matchesSearch &&
            (!status || b.bookingStatus === status) &&
            (!payment || b.paymentStatus === payment);
    });
}

function actionButtons(booking){
    const id = escapeHtml(booking._id);
    const actions = [];

    if(booking.bookingStatus === "Pending Payment Verification"){
        actions.push(`<button class="approve" onclick="approvePayment('${id}')">Approve Payment</button>`);
    }
    if(booking.bookingStatus === "Reserved"){
        actions.push(`<button class="checkin" onclick="checkIn('${id}')">Check In</button>`);
        actions.push(`<button class="cancel" onclick="cancelBooking('${id}')">Cancel</button>`);
    }
    if(booking.bookingStatus === "Checked In"){
        actions.push(`<button class="checkout" onclick="checkOut('${id}')">Check Out</button>`);
    }
    return actions.join("") || `<span class="muted">No action</span>`;
}

function renderBookings(){
    const tbody = document.querySelector("#bookingTable tbody");
    const rows = filteredBookings();
    tbody.innerHTML = "";

    $("emptyState").hidden = rows.length !== 0;

    rows.forEach(booking=>{
        const guest = `${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}`.trim() || "Guest";
        const room = booking.room
            ? `${escapeHtml(booking.room.unitNumber || booking.room.roomNumber || "Room")}<div class="muted">${escapeHtml(booking.room.unitName || booking.room.roomName || "")}</div>`
            : "—";
        const parking = booking.parking
            ? escapeHtml(booking.parking.parkingNumber || booking.parking.parkingName || "Reserved")
            : "—";
        const proof = booking.paymentProof
            ? `<a class="proof" target="_blank" rel="noopener" href="https://ca-smart-staycation-muqd.onrender.com/uploads/payments/${encodeURIComponent(booking.paymentProof)}">View proof</a>`
            : `<span class="muted">No upload</span>`;

        tbody.innerHTML += `
        <tr>
            <td><div class="ref">${escapeHtml(booking.bookingReference || "—")}</div><div class="muted">${escapeHtml(booking._id || "")}</div></td>
            <td>${guest}<div class="muted">${escapeHtml(booking.mobile || booking.email || "")}</div></td>
            <td>${formatDate(booking.checkIn)}<div class="muted">to ${formatDate(booking.checkOut)}</div></td>
            <td>${room}</td>
            <td>${parking}</td>
            <td class="money">₱${Number(booking.totalAmount || 0).toLocaleString("en-PH")}</td>
            <td>${escapeHtml(booking.paymentStatus || "Pending")}</td>
            <td><span class="badge ${statusClass(booking.bookingStatus)}">${escapeHtml(booking.bookingStatus || "Reserved")}</span></td>
            <td>${proof}</td>
            <td><div class="actions">${actionButtons(booking)}</div></td>
        </tr>`;
    });
}

async function loadBookings(){
    try{
        const res = await fetch(`${API}/bookings`);
        const json = await res.json();
        if(!res.ok) throw new Error(json.message || "Unable to load bookings.");
        bookings = Array.isArray(json.data) ? json.data : [];
        renderStats();
        renderBookings();
    }catch(err){
        console.error(err);
        alert("Unable to load bookings. Please check the API connection.");
    }
}

async function updateBooking(id, body, successMessage){
    try{
        const res = await fetch(`${API}/bookings/${encodeURIComponent(id)}`,{
            method:"PUT",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(body)
        });
        const json = await res.json();
        if(!res.ok) throw new Error(json.message || "Update failed.");
        alert(successMessage || json.message || "Booking updated.");
        await loadBookings();
    }catch(err){
        console.error(err);
        alert(err.message || "Unable to update booking.");
    }
}

async function approvePayment(id){
    try{
        const res = await fetch(`${API}/bookings/${encodeURIComponent(id)}/approve-payment`,{method:"PUT"});
        const json = await res.json();
        if(!res.ok) throw new Error(json.message || "Payment approval failed.");
        alert(json.message || "Payment approved.");
        await loadBookings();
    }catch(err){ alert(err.message); }
}

async function checkIn(id){
    try{
        const res = await fetch(`${API}/bookings/${encodeURIComponent(id)}/checkin`,{method:"PUT"});
        const json = await res.json();
        if(!res.ok) throw new Error(json.message || "Check-in failed.");
        alert(json.message || "Guest checked in.");
        await loadBookings();
    }catch(err){ alert(err.message); }
}

async function checkOut(id){
    try{
        const res = await fetch(`${API}/bookings/${encodeURIComponent(id)}/checkout`,{method:"PUT"});
        const json = await res.json();
        if(!res.ok) throw new Error(json.message || "Check-out failed.");
        alert(json.message || "Guest checked out.");
        await loadBookings();
    }catch(err){ alert(err.message); }
}

async function cancelBooking(id){
    if(!confirm("Cancel this booking? It will no longer block availability.")) return;
    await updateBooking(id,{bookingStatus:"Cancelled"},"Booking cancelled.");
}

$("refreshBtn").addEventListener("click",loadBookings);
$("searchInput").addEventListener("input",renderBookings);
$("statusFilter").addEventListener("change",renderBookings);
$("paymentFilter").addEventListener("change",renderBookings);

loadBookings();
