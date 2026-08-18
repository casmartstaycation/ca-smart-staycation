const ADMIN_DETAILS_API = "/api";

function adminDetailsEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
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
function adminToken() {
  return sessionStorage.getItem("caSmartAdminToken") || localStorage.getItem("caSmartAdminToken") || sessionStorage.getItem("adminToken") || sessionStorage.getItem("admin_token") || localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
}
function adminFileUrl(bookingId, type, subId = "") {
  const base = `${ADMIN_DETAILS_API}/admin/bookings/${encodeURIComponent(bookingId)}/file/${encodeURIComponent(type)}`;
  return subId ? `${base}/${encodeURIComponent(subId)}` : base;
}
function proofLink(value, label = "View Uploaded Payment", bookingId = "", type = "payment", subId = "") {
  if (!value) return "No upload available.";
  const raw = String(value);
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return `<a class="proof" target="_blank" rel="noopener" href="${adminDetailsEscape(raw)}">${label}</a>`;
  if (!bookingId) return "Upload available but no booking ID was supplied.";
  const url = adminFileUrl(bookingId, type, subId);
  return `<a class="proof admin-file-link" href="${adminDetailsEscape(url)}" data-admin-file="1" data-file-url="${adminDetailsEscape(url)}">${label}</a>`;
}

async function openAdminUploadedFile(event) {
  const link = event.target.closest("a[data-admin-file]");
  if (!link) return;
  event.preventDefault();
  const popup = window.open("about:blank", "_blank");
  if (!popup) { alert("Please allow pop-ups for the admin site to view uploaded files."); return; }
  popup.document.write("<p style='font-family:Arial;padding:30px'>Loading uploaded file…</p>");
  const token = adminToken();
  if (!token) { popup.close(); alert("Your admin session is not available. Please sign in again."); return; }
  try {
    const response = await fetch(link.dataset.fileUrl || link.href, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message = "Unable to open uploaded file.";
      try { const json = JSON.parse(text); message = json.message || message; } catch (_) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    popup.location.href = objectUrl;
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch (err) {
    popup.close();
    alert(err.message || "Unable to open uploaded file.");
  }
}

async function adminExtraRequestAction(booking, requestId, action) {
  let reason = "";
  if (action === "reject") {
    reason = prompt("Enter the reason for rejecting this request:") || "";
    if (!reason.trim()) return;
  }
  try {
    const r = await fetch(`${ADMIN_DETAILS_API}/admin/bookings/${encodeURIComponent(booking._id || booking.bookingReference)}/extra-requests/${encodeURIComponent(requestId)}/action`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
      cache: "no-store"
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) throw new Error(d.message || "Unable to process the request.");
    alert(d.message || "Request updated.");
    window.viewBooking(booking._id || booking.bookingReference);
  } catch (e) { alert(e.message || "Unable to process the request."); }
}

function setBookingModalLoading() {
  const modal = document.getElementById("bookingModal");
  const details = document.getElementById("bookingDetails");
  const actions = document.getElementById("modalActions");
  if (!modal || !details) return;
  // Keep the modal closed while the complete booking payload is fetched.
  // This prevents the old partial booking from flashing before full details arrive.
  modal.hidden = true;
  if (actions) actions.innerHTML = "";
  details.innerHTML = "";
}

window.viewBooking = async function(id) {
  // IMPORTANT: Do not call the old bookings.js viewBooking here.
  // It rendered a partial record immediately, then this function rendered
  // the full record later. That caused payment proof to appear first and
  // the remaining booking information to pop in after a delay.
  setBookingModalLoading();

  try {
    const token = adminToken();
    if (!token) throw new Error("Your admin session is not available. Please sign in again, then open the booking.");

    const response = await fetch(`${ADMIN_DETAILS_API}/admin/bookings/${encodeURIComponent(id)}/full`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || "Unable to load complete booking details.");

    // Everything below is prepared from the same /full response and is
    // inserted into the modal in one DOM update.
    const booking = json.data || {};
    const uploads = json.uploads || {};
    const bookingId = booking._id || id;
    const room = booking.room ? `${booking.room.unitNumber || booking.room.roomNumber || "Room"} — ${booking.room.unitName || booking.room.roomName || ""}` : "None";
    const parking = booking.parking ? `${booking.parking.parkingNumber || "Parking"} — ${booking.parking.parkingName || ""}` : "None";
    const bookingType = booking.parkingOnly ? "Parking Only" : (booking.parking ? "Accommodation + Parking" : "Accommodation Only");

    const documentLink = (label, value, type) => value
      ? `<div class="notes"><span>${label}</span><p>${proofLink(value, `View ${label}`, bookingId, type)}</p></div>`
      : `<div class="notes"><span>${label}</span><p>No upload available.</p></div>`;

    const paymentLink = (value, type = "payment") => proofLink(value, "View photo/file", bookingId, type);

    const history = Array.isArray(uploads.paymentProofHistory) && uploads.paymentProofHistory.length
      ? uploads.paymentProofHistory.map((item, i) => `<li>Proof ${i + 1}: ${item.filename ? proofLink(item.data || item.paymentProof || item.url || item.fileUrl || item.path || item.filename, `View ${adminDetailsEscape(item.filename)}`, bookingId, "payment-history", i) : "No file"}${item.rejectedAt ? ` · ${adminDetailsDateTime(item.rejectedAt)}` : ""}${item.rejectionReason ? ` · ${adminDetailsEscape(item.rejectionReason)}` : ""}</li>`).join("")
      : "<li>No previous payment proofs.</li>";

    const extraRequests = Array.isArray(uploads.extraRequests) && uploads.extraRequests.length
      ? uploads.extraRequests.map((r, i) => {
          const label = r.type === "extra_guest" ? "Extra Guest" : "Extra Set of Amenities";
          const action = r.status === "Pending"
            ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="refresh" data-extra-action="approve" data-request-id="${adminDetailsEscape(r.id)}">Approve</button><button type="button" class="refresh" data-extra-action="reject" data-request-id="${adminDetailsEscape(r.id)}">Reject</button></div>`
            : `<div style="margin-top:8px"><strong>Status:</strong> ${adminDetailsEscape(r.status)}${r.adminNote ? ` · ${adminDetailsEscape(r.adminNote)}` : ""}</div>`;
          return `<div class="notes"><span>${label} Request #${i + 1}</span><p>Quantity: ${adminDetailsEscape(r.quantity)} · Amount: ${adminDetailsMoney(r.amount)} · Submitted: ${adminDetailsDateTime(r.paymentSubmittedAt)}</p><p>Payment Proof: ${r.paymentProof ? proofLink(r.paymentProof, r.paymentProofFileName ? `View ${adminDetailsEscape(r.paymentProofFileName)}` : "View Uploaded Payment", bookingId, "extra-request", r.id) : "No upload available."}</p>${action}</div>`;
        }).join("")
      : `<div class="notes"><span>Additional Guest / Amenity Requests</span><p>No additional requests.</p></div>`;

    const detailsHtml = `<div class="detail-grid"><div><span>First Name</span><strong>${adminDetailsEscape(booking.firstName || "—")}</strong></div><div><span>Last Name</span><strong>${adminDetailsEscape(booking.lastName || "—")}</strong></div><div><span>Email</span><strong>${adminDetailsEscape(booking.email || "—")}</strong></div><div><span>Mobile</span><strong>${adminDetailsEscape(booking.mobile || "—")}</strong></div><div><span>Complete Address</span><strong>${adminDetailsEscape(booking.address || "—")}</strong></div><div><span>Booking Type</span><strong>${bookingType}</strong></div><div><span>Booking Status</span><strong>${adminDetailsEscape(booking.bookingStatus || "—")}</strong></div><div><span>Check-in</span><strong>${adminDetailsDate(booking.checkIn)}</strong></div><div><span>Check-out</span><strong>${adminDetailsDate(booking.checkOut)}</strong></div><div><span>Accommodation</span><strong>${adminDetailsEscape(room)}</strong></div><div><span>Parking</span><strong>${adminDetailsEscape(parking)}</strong></div><div><span>Adults</span><strong>${adminDetailsEscape(booking.adults ?? 0)}</strong></div><div><span>Children</span><strong>${adminDetailsEscape(booking.children ?? 0)}</strong></div><div><span>Payment Status</span><strong>${adminDetailsEscape(booking.paymentStatus || "Pending")}</strong></div><div><span>Subtotal</span><strong>${adminDetailsMoney(booking.subtotalAmount)}</strong></div><div><span>Voucher</span><strong>${adminDetailsEscape(booking.voucherCode || "—")}</strong></div><div><span>Voucher Discount</span><strong>${adminDetailsMoney(booking.voucherDiscountAmount)}</strong></div><div><span>Total</span><strong>${adminDetailsMoney(booking.totalAmount)}</strong></div><div><span>Payment Reference</span><strong>${adminDetailsEscape(booking.paymentReference || "—")}</strong></div><div><span>Payment Date</span><strong>${adminDetailsDateTime(booking.paymentDate)}</strong></div><div><span>Payment Deadline</span><strong>${adminDetailsDateTime(booking.paymentDeadline)}</strong></div><div><span>Payment Submitted</span><strong>${adminDetailsDateTime(booking.paymentProofSubmittedAt)}</strong></div><div><span>Payment Verified</span><strong>${adminDetailsDateTime(booking.paymentVerifiedAt)}</strong></div><div><span>Created</span><strong>${adminDetailsDateTime(booking.createdAt)}</strong></div><div><span>Updated</span><strong>${adminDetailsDateTime(booking.updatedAt)}</strong></div></div><div class="notes"><span>Vehicle Information</span><p>Brand: ${adminDetailsEscape(booking.vehicleBrand || "—")} · Model: ${adminDetailsEscape(booking.vehicleModel || "—")} · Color: ${adminDetailsEscape(booking.vehicleColor || "—")} · Plate: ${adminDetailsEscape(booking.plateNumber || "—")}</p></div>${documentLink("Government-Issued ID", uploads.governmentId, "government-id")}${documentLink("Driver's License", uploads.driversLicense, "drivers-license")}<div class="notes"><span>Current Payment Proof</span><p>${paymentLink(uploads.paymentProof)}</p></div><div class="notes"><span>Previous Payment Proofs</span><ul>${history}</ul></div><div class="notes"><span>Reschedule Payment Proof</span><p>${paymentLink(uploads.reschedulePaymentProof, "reschedule-payment")}</p></div>${extraRequests}<div class="notes"><span>Payment Rejection Reason</span><p>${adminDetailsEscape(booking.paymentRejectionReason || "—")}</p></div><div class="notes"><span>Cancellation</span><p>${adminDetailsEscape(booking.cancellationReason || "—")} · Requested: ${adminDetailsDateTime(booking.cancellationRequestedAt)}</p></div><div class="notes"><span>Refund</span><p>Status: ${adminDetailsEscape(booking.refundStatus || "Not Requested")} · Amount: ${adminDetailsMoney(booking.refundAmount)} · Fee: ${adminDetailsMoney(booking.refundFee)} · Processed: ${adminDetailsDateTime(booking.refundProcessedAt)}</p></div><div class="notes"><span>Reschedule History</span><p>${Array.isArray(booking.rescheduleHistory) && booking.rescheduleHistory.length ? booking.rescheduleHistory.map(x => `${adminDetailsDate(x.previousCheckIn)}–${adminDetailsDate(x.previousCheckOut)} → ${adminDetailsDate(x.newCheckIn)}–${adminDetailsDate(x.newCheckOut)} · ${adminDetailsDateTime(x.changedAt)}`).join("<br>") : "No reschedule history."}</p></div><div class="notes"><span>Notes</span><p>${adminDetailsEscape(booking.notes || "No notes.")}</p></div>${booking.email ? `<div class="notes"><span>Guest Account</span><p><button type="button" id="resetGuestPasswordBtn" class="refresh">Reset Guest Password</button></p><small id="resetGuestPasswordStatus" aria-live="polite"></small></div>` : ""}`;

    const actionButtons = [];
    const eid = adminDetailsEscape(bookingId);
    if (booking.bookingStatus === "Pending Payment Verification") {
      actionButtons.push(`<button class="approve" onclick="approvePayment('${eid}');closeModal()">Approve Payment</button>`);
      actionButtons.push(`<button class="cancel" onclick="rejectPayment('${eid}');closeModal()">Reject Payment</button>`);
    }
    if (booking.bookingStatus === "Reserved") actionButtons.push(`<button class="checkin" onclick="checkIn('${eid}');closeModal()">Check In</button>`);
    if (booking.bookingStatus === "Checked In") actionButtons.push(`<button class="checkout" onclick="checkOut('${eid}');closeModal()">Check Out</button>`);
    if (booking.bookingStatus === "Checked Out" && booking.housekeepingStatus !== "Clean") actionButtons.push(`<button class="clean" onclick="markClean('${eid}');closeModal()">Mark Clean</button>`);
    if (["Waiting for Payment", "Pending Payment Verification", "Payment Rejected"].includes(booking.bookingStatus)) actionButtons.push(`<button class="cancel" onclick="cancelBooking('${eid}');closeModal()">Cancel Booking</button>`);

    const details = document.getElementById("bookingDetails");
    const actions = document.getElementById("modalActions");
    const modal = document.getElementById("bookingModal");
    document.getElementById("modalTitle").textContent = booking.bookingReference || "Booking Details";
    details.innerHTML = detailsHtml;
    if (actions) actions.innerHTML = actionButtons.join("");
    details.onclick = openAdminUploadedFile;
    details.querySelectorAll("[data-extra-action]").forEach(button => button.addEventListener("click", () => adminExtraRequestAction(booking, button.dataset.requestId, button.dataset.extraAction)));

    const resetButton = document.getElementById("resetGuestPasswordBtn");
    if (resetButton) resetButton.addEventListener("click", async () => {
      if (!confirm(`Reset the guest account password for ${booking.email}?`)) return;
      resetButton.disabled = true;
      resetButton.textContent = "Resetting…";
      const status = document.getElementById("resetGuestPasswordStatus");
      try {
        const resetResponse = await fetch(`${ADMIN_DETAILS_API}/admin/bookings/${encodeURIComponent(booking._id)}/reset-guest-password`, { method: "POST", headers: { Authorization: `Bearer ${adminToken()}` } });
        const resetJson = await resetResponse.json();
        if (!resetResponse.ok || !resetJson.success) throw new Error(resetJson.message || "Unable to reset guest password.");
        status.textContent = resetJson.emailSent ? "Password reset and emailed to the guest." : "Email could not be sent. The temporary password is shown in the alert.";
        alert(`Guest password reset successfully.\n\nEmail: ${resetJson.email}\nTemporary password: ${resetJson.temporaryPassword}`);
      } catch (err) {
        status.textContent = err.message || "Unable to reset guest password.";
        alert(err.message || "Unable to reset guest password.");
      } finally {
        resetButton.disabled = false;
        resetButton.textContent = "Reset Guest Password";
      }
    });

    // Only reveal the modal after the complete booking + uploads + requests
    // payload has been assembled. There is now no partial second render.
    modal.hidden = false;
  } catch (err) {
    console.error("ADMIN BOOKING DETAILS ERROR:", err);
    alert(err.message || "Unable to load complete booking details.");
  }
};
