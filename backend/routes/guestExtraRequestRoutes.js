const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const GuestAccount = require("../models/GuestAccount");
const Notification = require("../models/Notification");
const Room = require("../models/Room");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
const RATE = 300;
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function verifyToken(req) { const header = req.headers.authorization || ""; if (!header.startsWith("Bearer ")) throw new Error("Authentication required."); return jwt.verify(header.slice(7), JWT_SECRET); }
function nightsFor(booking) { const ms = new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime(); return Math.max(1, Math.ceil(ms / 86400000)); }
function transientMongoError(err) {
  const text = `${err?.name || ""} ${err?.message || ""}`.toLowerCase();
  return Boolean(err?.errorLabels?.includes("RetryableWriteError") || err?.errorLabels?.includes("TransientTransactionError") || /mongo|serverselection|topology|replicaset|tls|ssl|socket|connection|network/.test(text));
}
async function withMongoRetry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await operation(); }
    catch (err) {
      lastError = err;
      if (!transientMongoError(err) || attempt === attempts) throw err;
      await new Promise(resolve => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}
async function getOwnedBooking(req, idOrReference) {
  const payload = verifyToken(req);
  const account = await withMongoRetry(() => GuestAccount.findById(payload.accountId).select("email").lean());
  if (!account) throw new Error("Account not found.");
  const email = String(account.email || "").trim().toLowerCase();
  if (mongoose.Types.ObjectId.isValid(idOrReference)) return withMongoRetry(() => Booking.findOne({ _id: idOrReference, email }));
  return withMongoRetry(() => Booking.findOne({ bookingReference: String(idOrReference).trim(), email }));
}

router.post("/guest-auth/bookings/:id/extra-requests", async (req, res) => {
  try {
    const booking = await getOwnedBooking(req, req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    if (["Cancelled", "Expired", "Checked Out"].includes(booking.bookingStatus)) return res.status(400).json({ success: false, message: "Additional requests are unavailable for this booking." });

    const type = String(req.body.type || "").trim();
    const quantity = Math.max(1, Math.min(2, Number(req.body.quantity || 1)));
    if (!["extra_guest", "extra_set"].includes(type)) return res.status(400).json({ success: false, message: "Invalid request type." });

    // Parking-only reservations have no accommodation entitlement. Reject every
    // extra request type at the API boundary so this cannot be bypassed by editing
    // the guest account page or sending a direct request to the endpoint.
    if (booking.parkingOnly || (!booking.room && booking.parking)) {
      return res.status(400).json({ success: false, message: "Additional guests and amenities are not available for parking-only bookings." });
    }

    // Enforce the actual room capacity, not merely the old generic limit of two
    // extra requests. Approved and pending extra guests both consume capacity.
    if (type === "extra_guest") {
      const room = booking.room ? await withMongoRetry(() => Room.findById(booking.room).select("capacity unitNumber unitName").lean()) : null;
      const maxGuests = Math.max(1, Number(room?.capacity || 4));
      const bookedGuests = Math.max(0, Number(booking.adults || 0));
      const extraGuestsAlreadyRequested = (booking.extraRequests || [])
        .filter(r => ["Pending", "Approved", "Paid"].includes(r.status) && r.type === "extra_guest")
        .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
      const remainingCapacity = maxGuests - bookedGuests - extraGuestsAlreadyRequested;

      if (remainingCapacity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Maximum guest capacity reached. This booking already has ${bookedGuests + extraGuestsAlreadyRequested} guest${bookedGuests + extraGuestsAlreadyRequested === 1 ? "" : "s"}. The unit maximum is ${maxGuests}.`
        });
      }
      if (quantity > remainingCapacity) {
        return res.status(400).json({
          success: false,
          message: `Only ${remainingCapacity} additional guest${remainingCapacity === 1 ? "" : "s"} can be requested. The unit maximum is ${maxGuests}.`
        });
      }
    }

    const paymentProof = String(req.body.paymentProof || "");
    const paymentProofFileName = String(req.body.paymentProofFileName || "").trim().slice(0, 255);
    if (!paymentProof || !paymentProofFileName) return res.status(400).json({ success: false, message: "Payment proof is required." });
    const match = paymentProof.match(/^data:(image\/jpeg|image\/png|image\/webp|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || !ALLOWED_PROOF_TYPES.has(match[1])) return res.status(400).json({ success: false, message: "Invalid payment proof format. Upload JPG, PNG, WEBP, or PDF." });
    const bytes = Math.ceil((match[2].length * 3) / 4);
    if (bytes > MAX_PROOF_BYTES) return res.status(400).json({ success: false, message: "Payment proof must be 10 MB or smaller." });

    const pending = (booking.extraRequests || []).filter(r => r.status === "Pending" && r.type === type).reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    if (pending + quantity > 2 && type === "extra_set") return res.status(400).json({ success: false, message: "Maximum of 2 additional amenity requests is allowed." });

    const nights = nightsFor(booking);
    const amount = type === "extra_set" ? RATE * quantity : RATE * quantity * nights;
    booking.extraRequests.push({ type, quantity, nightlyRate: type === "extra_guest" ? RATE : 0, nights: type === "extra_guest" ? nights : 1, amount, paymentProof, paymentProofFileName, paymentSubmittedAt: new Date(), status: "Pending", requestedAt: new Date() });
    await withMongoRetry(() => booking.save());
    const created = booking.extraRequests[booking.extraRequests.length - 1];

    try {
      const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
      const label = type === "extra_guest" ? "Extra Guest" : "Extra Set of Amenities";
      const adminEmail = String(process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "casmartstaycation@gmail.com").trim().toLowerCase();
      await withMongoRetry(() => Notification.create({
        recipientType: "admin",
        recipientEmail: adminEmail,
        booking: booking._id,
        title: `Payment Proof Uploaded — ${booking.bookingReference}`,
        message: `${booking.bookingReference} — ${guestName} uploaded payment proof for ${label} (₱${Number(amount).toLocaleString("en-PH")}). Payment verification is required.`,
        type: "extra-payment-proof",
        read: false
      }));
    } catch (notificationError) {
      console.error("EXTRA REQUEST ADMIN NOTIFICATION ERROR:", notificationError);
    }

    res.status(201).json({ success: true, message: "Payment proof uploaded. This request is subject to payment verification.", request: { ...created.toObject(), paymentProof: undefined }, nights: type === "extra_guest" ? nights : 1, amount });
  } catch (err) {
    console.error("GUEST EXTRA REQUEST ERROR:", err);
    const status = err.message === "Authentication required." || err.name === "JsonWebTokenError" ? 401 : transientMongoError(err) ? 503 : 400;
    res.status(status).json({ success: false, message: transientMongoError(err) ? "Database connection is temporarily unavailable. Your guest session is still valid; please try the payment upload again." : (err.message || "Unable to upload payment proof.") });
  }
});
module.exports = router;
