const ADMIN_DETAILS_API = "https://ca-smart-staycation-muqd.onrender.com/api";
const originalAdminViewBooking = window.viewBooking;
function adminDetailsEscape(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function adminDetailsDate(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }); }
function adminDetailsDateTime(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function adminDetailsMoney(value) { return `₱${Number(value || 0).toLocaleString("en-PH")}`; }
function adminToken() {
    return sessionStorage.getItem("caSmartAdminToken") ||
        localStorage.getItem("caSmartAdminToken") ||
        sessionStorage.getItem("adminToken") ||
        sessionStorage.getItem("admin_token") ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token") || "";
}
function adminUploadUrl(filename, folder = "guest-documents") { return filename ? `${ADMIN_DETAILS_API}/uploads/${folder}/${encodeURIComponent(filename)}` : ""; }

window.viewBooking = async function(id) {
    if (typeof originalAdminViewBooking === "function") originalAdminViewBooking(id);
    try {
        const token = adminToken();
        if (!token) throw new Error("Your admin session is not available. Please sign in again, then open the booking.");
        const response = await fetch(`${ADMIN_DETAILS_API}/admin/bookings/${encodeURIComponent(id)}/full`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.message || "Unable to load complete booking details.");
        const booking = json.data;
        const uploads = json.uploads || {};
        const room = booking.room ? `${booking.room.unitNumber || booking.room.roomNumber || "Room"} — ${booking.room.unitName || booking.room.roomName || ""}` : "None";
        const parking = booking.parking ? `${booking.parking.parkingNumber || "Parking"} — ${booking.parking.parkingName || ""}` : "None";
        const bookingType = booking.parkingOnly ? "Parking Only" : (booking.parking ? "Accommodation + Parking" : "Accommodation Only");
        const documentLink = (label, filename) => filename ? `<div class="notes"><span>${label}</span><p><a class="proof" target="_blank" rel="noopener" href="${adminUploadUrl(filename)}">View ${label}</a></p></div>` : `<div class="notes"><span>${label}</span><p>No upload available.</p></div>`;
        const paymentLink = filename => filename ? `<a class="proof" target="_blank" rel="noopener" href="${adminUploadUrl(filename, "payments")}">View photo/file</a>` : "—";
        const history = Array.isArray(uploads.paymentProofHistory) && uploads.paymentProofHistory.length ? uploads.paymentProofHistory.map((item, i) => `<li>Proof ${i + 1}: ${paymentLink(item.filename)}${item.rejectedAt ? ` · ${adminDetailsDateTime(item.rejectedAt)}` : ""}${item.rejectionReason ? ` · ${adminDetailsEscape(item.rejectionReason)}` : ""}</li>`).join("") : "<li>No previous payment proofs.</li>";
        document.getElementById("modalTitle").textContent = booking.bookingReference || "Booking Details";
        document.getElementById("bookingDetails").innerHTML = `<div class="detail-grid"><div><span>First Name</span><strong>${adminDetailsEscape(booking.firstName || "—")}</strong></div><div><span>Last Name</span><strong>${adminDetailsEscape(booking.lastName || "—")}</strong></div><div><span>Email</span><strong>${adminDetailsEscape(booking.email || "—")}</strong></div><div><span>Mobile</span><strong>${adminDetailsEscape(booking.mobile || "—")}</strong></div><div><span>Complete Address</span><strong>${adminDetailsEscape(booking.address || "—")}</strong></div><div><span>Booking Type</span><strong>${bookingType}</strong></div><div><span>Booking Status</span><strong>${adminDetailsEscape(booking.bookingStatus || "—")}</strong></div><div><span>Check-in</span><strong>${adminDetailsDate(booking.checkIn)}</strong></div><div><span>Check-out</span><strong>${adminDetailsDate(booking.checkOut)}</strong></div><div><span>Accommodation</span><strong>${adminDetailsEscape(room)}</strong></div><div><span>Parking</span><strong>${adminDetailsEscape(parking)}</strong></div><div><span>Adults</span><strong>${adminDetailsEscape(booking.adults ?? 0)}</strong></div><div><span>Children</span><strong>${adminDetailsEscape(booking.children ?? 0)}</strong></div><div><span>Payment Status</span><strong>${adminDetailsEscape(booking.paymentStatus || "Pending")}</strong></div><div><span>Subtotal</span><strong>${adminDetailsMoney(booking.subtotalAmount)}</strong></div><div><span>Voucher</span><strong>${adminDetailsEscape(booking.voucherCode || "—")}</strong></div><div><span>Voucher Discount</span><strong>${adminDetailsMoney(booking.voucherDiscountAmount)}</strong></div><div><span>Total</span><strong>${adminDetailsMoney(booking.totalAmount)}</strong></div><div><span>Payment Reference</span><strong>${adminDetailsEscape(booking.paymentReference || "—")}</strong></div><div><span>Payment Date</span><strong>${adminDetailsDateTime(booking.paymentDate)}</strong></div><div><span>Payment Deadline</span><strong>${adminDetailsDateTime(booking.paymentDeadline)}</strong></div><div><span>Payment Submitted</span><strong>${adminDetailsDateTime(booking.paymentProofSubmittedAt)}</strong></div><div><span>Payment Verified</span><strong>${adminDetailsDateTime(booking.paymentVerifiedAt)}</strong></div><div><span>Created</span><strong>${adminDetailsDateTime(booking.createdAt)}</strong></div><div><span>Updated</span><strong>${adminDetailsDateTime(booking.updatedAt)}</strong></div></div><div class="notes"><span>Vehicle Information</span><p>Brand: ${adminDetailsEscape(booking.vehicleBrand || "—")} · Model: ${adminDetailsEscape(booking.vehicleModel || "—")} · Color: ${adminDetailsEscape(booking.vehicleColor || "—")} · Plate: ${adminDetailsEscape(booking.plateNumber || "—")}</p></div>${documentLink("Government-Issued ID", uploads.governmentId)}${documentLink("Driver's License", uploads.driversLicense)}<div class="notes"><span>Current Payment Proof</span><p>${paymentLink(uploads.paymentProof)}</p></div><div class="notes"><span>Previous Payment Proofs</span><ul>${history}</ul></div><div class="notes"><span>Reschedule Payment Proof</span><p>${paymentLink(uploads.reschedulePaymentProof)}</p></div><div class="notes"><span>Payment Rejection Reason</span><p>${adminDetailsEscape(booking.paymentRejectionReason || "—")}</p></div><div class="notes"><span>Cancellation</span><p>${adminDetailsEscape(booking.cancellationReason || "—")} · Requested: ${adminDetailsDateTime(booking.cancellationRequestedAt)}</p></div><div class="notes"><span>Refund</span><p>Status: ${adminDetailsEscape(booking.refundStatus || "Not Requested")} · Amount: ${adminDetailsMoney(booking.refundAmount)} · Fee: ${adminDetailsMoney(booking.refundFee)} · Processed: ${adminDetailsDateTime(booking.refundProcessedAt)}</p></div><div class="notes"><span>Reschedule History</span><p>${Array.isArray(booking.rescheduleHistory) && booking.rescheduleHistory.length ? booking.rescheduleHistory.map(x => `${adminDetailsDate(x.previousCheckIn)}–${adminDetailsDate(x.previousCheckOut)} → ${adminDetailsDate(x.newCheckIn)}–${adminDetailsDate(x.newCheckOut)} · ${adminDetailsDateTime(x.changedAt)}`).join("<br>") : "No reschedule history."}</p></div><div class="notes"><span>Notes</span><p>${adminDetailsEscape(booking.notes || "No notes.")}</p></div>${booking.email ? `<div class="notes"><span>Guest Account</span><p><button type="button" id="resetGuestPasswordBtn" class="refresh">Reset Guest Password</button></p><small id="resetGuestPasswordStatus" aria-live="polite"></small></div>` : ""}`;
        document.getElementById("bookingModal").hidden = false;
        const resetButton = document.getElementById("resetGuestPasswordBtn");
        if (resetButton) resetButton.addEventListener("click", async () => {
            if (!confirm(`Reset the guest account password for ${booking.email}?`)) return;
            resetButton.disabled = true; resetButton.textContent = "Resetting…";
            const status = document.getElementById("resetGuestPasswordStatus");
            try {
                const resetResponse = await fetch(`${ADMIN_DETAILS_API}/admin/bookings/${encodeURIComponent(booking._id)}/reset-guest-password`, { method: "POST", headers: { Authorization: `Bearer ${adminToken()}` } });
                const resetJson = await resetResponse.json();
                if (!resetResponse.ok || !resetJson.success) throw new Error(resetJson.message || "Unable to reset guest password.");
                status.textContent = resetJson.emailSent ? "Password reset and emailed to the guest." : "Email could not be sent. The temporary password is shown in the alert.";
                alert(`Guest password reset successfully.\n\nEmail: ${resetJson.email}\nTemporary password: ${resetJson.temporaryPassword}\n\n${resetJson.emailSent ? "The temporary password was also emailed to the guest." : "Email was not sent; give this temporary password to the guest securely."}`);
            } catch (err) { console.error("ADMIN RESET GUEST PASSWORD ERROR:", err); status.textContent = err.message || "Unable to reset guest password."; alert(err.message || "Unable to reset guest password."); }
            finally { resetButton.disabled = false; resetButton.textContent = "Reset Guest Password"; }
        });
    } catch (err) { console.error("ADMIN BOOKING DETAILS ERROR:", err); alert(err.message || "Unable to load complete booking details."); }
};
