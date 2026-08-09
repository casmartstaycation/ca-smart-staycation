const express = require("express");
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const sendEmail = require("../mail/sendEmail");

const router = express.Router();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

function requireAdmin(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || !ADMIN_JWT_SECRET) return res.status(401).json({ success: false, message: "Admin authentication required." });
    try {
        const payload = jwt.verify(token, ADMIN_JWT_SECRET);
        if (payload.role !== "admin" || (ADMIN_EMAIL && String(payload.email || "").toLowerCase() !== String(ADMIN_EMAIL).toLowerCase())) {
            return res.status(403).json({ success: false, message: "Admin access required." });
        }
        req.admin = payload;
        next();
    } catch (_) {
        return res.status(401).json({ success: false, message: "Admin session expired or invalid." });
    }
}

router.put("/bookings/:id/reject-payment", requireAdmin, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        if (booking.paymentStatus === "Paid") return res.status(400).json({ success: false, message: "A paid booking cannot have its payment proof rejected." });

        const reason = String(req.body?.reason || "Payment proof could not be verified.").trim().slice(0, 500);
        const oldProof = booking.paymentProof;
        if (oldProof) {
            booking.paymentProofHistory.push({
                filename: oldProof,
                rejectedAt: new Date(),
                rejectionReason: reason
            });
        }

        // Clear the active proof so the old receipt cannot accidentally be approved.
        // The rejected receipt remains available in paymentProofHistory for audit/history.
        booking.paymentProof = "";
        booking.paymentDate = null;
        booking.paymentStatus = "Pending";
        booking.bookingStatus = "Payment Rejected";
        booking.paymentRejectionReason = reason;
        // Give the guest a fresh one-hour correction window.
        booking.paymentDeadline = new Date(Date.now() + PAYMENT_WINDOW_MS);
        await booking.save();

        if (booking.email) {
            const loginUrl = process.env.GUEST_LOGIN_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/guest-login.html";
            const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
            const html = `<h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>Your payment proof for booking <strong>${booking.bookingReference}</strong> could not be verified.</p><p><strong>Reason:</strong> ${reason}</p><p>Your reservation has not been cancelled. You have a new <strong>1-hour payment correction window</strong> to submit the correct proof.</p><p>Please log in and upload the correct receipt. The previously rejected receipt will remain in the booking history for record keeping.</p><p><a href="${loginUrl}">Login to your guest account</a></p><p><strong>Booking Reference:</strong> ${booking.bookingReference}</p><p>CA Smart Staycation</p>`;
            await sendEmail(booking.email, `Payment Proof Rejected — Resubmission Required — ${booking.bookingReference}`, html).catch(err => console.error("PAYMENT REJECTION EMAIL ERROR:", err));
        }

        res.json({
            success: true,
            message: "Payment proof rejected. The old proof was archived and the guest received a new 1-hour correction window.",
            data: booking
        });
    } catch (err) {
        console.error("PAYMENT RECOVERY REJECT ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
