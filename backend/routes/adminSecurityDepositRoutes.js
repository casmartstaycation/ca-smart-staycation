const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Setting = require("../models/Setting");
const Notification = require("../models/Notification");
const sendEmail = require("../mail/sendEmail");

const router = express.Router();
const DEFAULT_ADMIN_EMAIL = "markryantamayo@gmail.com";
const REFUND_DELAY_MS = 24 * 60 * 60 * 1000;

function adminConfig() {
  const password = String(process.env.ADMIN_PASSWORD || "");
  const email = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const secret = String(process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (password ? crypto.createHash("sha256").update(`ca-smart-admin:${password}`).digest("hex") : ""));
  return { email, secret };
}

function requireAdmin(req, res, next) {
  const { email, secret } = adminConfig();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !secret) return res.status(401).json({ success: false, message: "Admin authentication required." });
  try {
    const payload = jwt.verify(token, secret);
    if (payload.role !== "admin" || String(payload.email || "").toLowerCase() !== email) return res.status(403).json({ success: false, message: "Admin access required." });
    req.admin = payload;
    next();
  } catch (_) {
    return res.status(401).json({ success: false, message: "Admin session expired or invalid." });
  }
}

async function findBooking(rawId) {
  const id = String(rawId || "").trim();
  if (mongoose.Types.ObjectId.isValid(id)) return Booking.findById(id);
  return Booking.findOne({ bookingReference: id });
}

async function getDepositAmount(booking) {
  const stored = Number(booking.securityDepositAmount || 0);
  if (stored > 0) return stored;
  const settings = await Setting.findOne().select("securityDeposit").lean();
  return Math.max(0, Number(settings?.securityDeposit ?? 1000) || 0);
}

async function ensureSecurityDepositWindow(booking) {
  if (!booking || booking.parkingOnly || booking.bookingStatus !== "Checked Out") return;
  let changed = false;
  if (!booking.checkedOutAt) {
    const fallback = booking.updatedAt || booking.checkOut || new Date();
    booking.checkedOutAt = new Date(fallback);
    changed = true;
  }
  if (!booking.securityDepositRefundAvailableAt) {
    booking.securityDepositRefundAvailableAt = new Date(new Date(booking.checkedOutAt).getTime() + REFUND_DELAY_MS);
    changed = true;
  }
  if (!(Number(booking.securityDepositAmount || 0) > 0)) {
    booking.securityDepositAmount = await getDepositAmount(booking);
    changed = true;
  }
  if (!booking.securityDepositStatus) {
    booking.securityDepositStatus = "Held";
    changed = true;
  }
  if (changed) await booking.save();
}

function serializeStatus(booking) {
  const availableAt = booking.securityDepositRefundAvailableAt ? new Date(booking.securityDepositRefundAvailableAt) : null;
  const available = Boolean(
    !booking.parkingOnly &&
    booking.bookingStatus === "Checked Out" &&
    booking.securityDepositStatus !== "Refunded" &&
    availableAt &&
    Date.now() >= availableAt.getTime()
  );
  return {
    bookingId: booking._id,
    bookingReference: booking.bookingReference,
    bookingStatus: booking.bookingStatus,
    parkingOnly: Boolean(booking.parkingOnly),
    checkedOutAt: booking.checkedOutAt || null,
    securityDepositAmount: Number(booking.securityDepositAmount || 0),
    securityDepositStatus: booking.securityDepositStatus || "Held",
    securityDepositRefundAvailableAt: availableAt,
    securityDepositRefundedAt: booking.securityDepositRefundedAt || null,
    securityDepositRefundedBy: booking.securityDepositRefundedBy || "",
    available,
    remainingMs: availableAt ? Math.max(0, availableAt.getTime() - Date.now()) : null
  };
}

router.get("/admin/bookings/:id/security-deposit-status", requireAdmin, async (req, res) => {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    await ensureSecurityDepositWindow(booking);
    return res.json({ success: true, data: serializeStatus(booking) });
  } catch (err) {
    console.error("SECURITY DEPOSIT STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Unable to load security deposit status." });
  }
});

router.post("/admin/bookings/:id/security-deposit-refund", requireAdmin, async (req, res) => {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    if (booking.parkingOnly) return res.status(400).json({ success: false, message: "Parking-only bookings do not have a unit security deposit." });
    if (booking.bookingStatus !== "Checked Out") return res.status(409).json({ success: false, message: "Security deposit refund is only available after the guest has checked out." });

    await ensureSecurityDepositWindow(booking);

    if (booking.securityDepositStatus === "Refunded") {
      return res.status(409).json({
        success: false,
        message: `Security deposit was already marked refunded${booking.securityDepositRefundedAt ? ` on ${new Date(booking.securityDepositRefundedAt).toLocaleString("en-PH")}` : ""}.`,
        data: serializeStatus(booking)
      });
    }

    const availableAt = new Date(booking.securityDepositRefundAvailableAt);
    if (Date.now() < availableAt.getTime()) {
      return res.status(409).json({
        success: false,
        code: "SECURITY_DEPOSIT_REFUND_LOCKED",
        message: "Security deposit refund is still locked during the 24-hour unit inspection period.",
        data: serializeStatus(booking)
      });
    }

    const amount = await getDepositAmount(booking);
    booking.securityDepositAmount = amount;
    booking.securityDepositStatus = "Refunded";
    booking.securityDepositRefundedAt = new Date();
    booking.securityDepositRefundedBy = String(req.admin?.email || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
    await booking.save();

    const guestEmail = String(booking.email || "").trim().toLowerCase();
    const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
    const message = `${booking.bookingReference} — Your ₱${amount.toLocaleString("en-PH")} security deposit has been marked as refunded after the post-checkout inspection period.`;
    if (guestEmail) {
      await Promise.allSettled([
        Notification.create({
          recipientType: "guest",
          recipientEmail: guestEmail,
          booking: booking._id,
          title: "Security Deposit Refunded",
          message,
          type: "security-deposit-refunded",
          read: false
        }),
        sendEmail(
          guestEmail,
          `Security Deposit Refunded — ${booking.bookingReference}`,
          `<h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>Your security deposit of <strong>₱${amount.toLocaleString("en-PH")}</strong> has been marked as refunded.</p><p><strong>Booking Reference:</strong> ${booking.bookingReference}</p><p><strong>Refund processed:</strong> ${new Date(booking.securityDepositRefundedAt).toLocaleString("en-PH")}</p><p>Please allow your bank or payment provider's normal processing time for the returned funds to appear.</p>`
        )
      ]);
    }

    return res.json({
      success: true,
      message: `Security deposit refund recorded for ${booking.bookingReference}.`,
      data: serializeStatus(booking)
    });
  } catch (err) {
    console.error("SECURITY DEPOSIT REFUND ERROR:", err);
    return res.status(500).json({ success: false, message: err.message || "Unable to process security deposit refund." });
  }
});

module.exports = router;
