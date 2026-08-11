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
            ${booking.email ? `<div class="notes"><span>Guest Account</span><p><button type="button" id="resetGuestPasswordBtn" class="refresh">Reset Guest Password</button></p><small id="resetGuestPasswordStatus" aria-live="polite"></small></div>` : ""}
        `;
        document.getElementById("bookingModal").hidden = false;

        const resetButton = document.getElementById("resetGuestPasswordBtn");
        if (resetButton) {
            resetButton.addEventListener("click", async () => {
                if (!confirm(`Reset the guest account password for ${booking.email}?`)) return;
                resetButton.disabled = true;
                resetButton.textContent = "Resetting…";
                const status = document.getElementById("resetGuestPasswordStatus");
                try {
                    const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || sessionStorage.getItem("adminToken") || sessionStorage.getItem("admin_token") || "";
                    const resetResponse = await fetch(`${ADMIN_DETAILS_API}/admin/bookings/${encodeURIComponent(booking._id)}/reset-guest-password`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const resetJson = await resetResponse.json();
                    if (!resetResponse.ok || !resetJson.success) throw new Error(resetJson.message || "Unable to reset guest password.");
                    status.textContent = resetJson.emailSent
                        ? "Password reset and emailed to the guest."
                        : "Email could not be sent. The temporary password is shown in the alert.";
                    alert(`Guest password reset successfully.\n\nEmail: ${resetJson.email}\nTemporary password: ${resetJson.temporaryPassword}\n\n${resetJson.emailSent ? "The temporary password was also emailed to the guest." : "Email was not sent; give this temporary password to the guest securely."}\n\nThe guest must change the password after logging in.`);
                } catch (err) {
                    console.error("ADMIN RESET GUEST PASSWORD ERROR:", err);
                    status.textContent = err.message || "Unable to reset guest password.";
                    alert(err.message || "Unable to reset guest password.");
                } finally {
                    resetButton.disabled = false;
                    resetButton.textContent = "Reset Guest Password";
                }
            });
        }
    } catch (err) {
        console.error("ADMIN BOOKING DETAILS ERROR:", err);
        alert(err.message || "Unable to load booking details.");
    }
};
