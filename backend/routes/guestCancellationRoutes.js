const express = require("express");
const jwt = require("jsonwebtoken");
const GuestAccount = require("../models/GuestAccount");
const Booking = require("../models/Booking");
const { calculateCancellationRefund, daysUntilCheckIn } = require("../services/cancellationRefundPolicy");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
const ACTIVE_STATUSES = ["Waiting for Payment", "Reserved", "Pending Payment Verification", "Payment Rejected", "Confirmed"];

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function verifyToken(req) {
  const token = getToken(req);
  if (!token) throw new Error("Authentication required.");
  return jwt.verify(token, JWT_SECRET);
}

router.post("/guest-auth/bookings/:id/cancel", async (req, res) => {
  try {
    const payload = verifyToken(req);
    const account = await GuestAccount.findById(payload.accountId).select("email bookingReference").lean();
    if (!account) return res.status(401).json({ success: false, message: "Account not found." });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    const sameEmail = String(booking.email || "").trim().toLowerCase() === String(account.email || "").trim().toLowerCase();
    const sameReference = String(booking.bookingReference || "").trim() === String(account.bookingReference || "").trim();
    if (!sameEmail && !sameReference) return res.status(403).json({ success: false, message: "You are not allowed to cancel this booking." });

    if (!ACTIVE_STATUSES.includes(booking.bookingStatus)) {
      return res.status(409).json({ success: false, message: "This booking can no longer be cancelled from the guest account." });
    }

    if (booking.complimentaryNonCancellable || Number(booking.voucherDiscountPercent || 0) === 100) {
      return res.status(409).json({ success: false, message: "Bookings using a 100% complimentary voucher cannot be cancelled." });
    }

    const dayDifference = daysUntilCheckIn(booking.checkIn, new Date());
    if (dayDifference === null) return res.status(400).json({ success: false, message: "Unable to determine the booking cancellation window." });
    if (dayDifference < 0) return res.status(409).json({ success: false, message: "A booking past its check-in date can no longer be cancelled online." });

    if (["Requested", "Processing", "Refunded"].includes(booking.refundStatus)) {
      return res.status(409).json({ success: false, message: "A refund request has already been submitted for this booking." });
    }

    const reason = String(req.body.reason || "Guest requested cancellation").trim().slice(0, 500);
    const hasPayment = booking.paymentStatus === "Paid" || Boolean(booking.paymentProof);
    const policy = hasPayment ? calculateCancellationRefund(booking, new Date()) : null;

    booking.bookingStatus = "Cancelled";
    booking.cancellationRequestedAt = new Date();
    booking.cancellationReason = reason;

    if (hasPayment && policy) {
      booking.refundAmount = policy.refund;
      booking.refundFee = policy.fee;
      booking.refundPolicyRule = policy.rule;

      if (policy.refundable && policy.refund > 0) {
        booking.refundRequested = true;
        booking.refundRequestedAt = new Date();
        booking.refundStatus = "Requested";
      } else {
        booking.refundRequested = false;
        booking.refundRequestedAt = null;
        booking.refundStatus = "Not Eligible";
      }
    } else {
      booking.refundRequested = false;
      booking.refundRequestedAt = null;
      booking.refundAmount = 0;
      booking.refundFee = 0;
      booking.refundPolicyRule = "No payment recorded";
      booking.refundStatus = "Not Requested";
    }

    await booking.save();

    let message;
    if (!hasPayment) {
      message = "Booking cancelled successfully. No payment was recorded, so no refund is required.";
    } else if (!policy.refundable || policy.refund <= 0) {
      message = `Booking cancelled. ${policy.rule}. Refund due: ₱0.`;
    } else if (policy.type === "percentage") {
      message = `Booking cancelled. ${policy.rule}. Refund due: ₱${policy.refund.toLocaleString("en-PH")}. Your refund request has been submitted for admin processing.`;
    } else {
      message = `Booking cancelled. ${policy.rule}. Convenience fee: ₱${policy.fee.toLocaleString("en-PH")}. Refund due: ₱${policy.refund.toLocaleString("en-PH")}. Your refund request has been submitted for admin processing.`;
    }

    return res.json({
      success: true,
      refundRequested: Boolean(booking.refundRequested),
      refundAmount: booking.refundAmount,
      convenienceFee: booking.refundFee,
      inconvenienceFee: booking.refundFee,
      refundPolicyRule: booking.refundPolicyRule,
      refundStatus: booking.refundStatus,
      message,
      data: booking
    });
  } catch (err) {
    console.error("GUEST CANCELLATION POLICY ERROR:", err);
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Session expired or invalid." });
    }
    return res.status(500).json({ success: false, message: err.message || "Unable to cancel this booking." });
  }
});

module.exports = router;
