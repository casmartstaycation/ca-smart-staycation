const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const GuestAccount = require("../models/GuestAccount");
const Booking = require("../models/Booking");
const sendEmail = require("../mail/sendEmail");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
const RESET_MINUTES = 30;
const ACTIVE_STATUSES = ["Reserved", "Pending Payment Verification", "Payment Rejected"];

function getToken(req) { const header = req.headers.authorization || ""; return header.startsWith("Bearer ") ? header.slice(7) : ""; }
function verifyToken(req) { const token = getToken(req); if (!token) throw new Error("Authentication required."); return jwt.verify(token, JWT_SECRET); }
function publicAccount(account) { return { id: account._id, email: account.email, bookingReference: account.bookingReference, mustChangePassword: account.defaultPassword === true }; }
function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
async function bookingsForEmail(email) { return Booking.find({ email: String(email || "").trim().toLowerCase() }).populate("room").populate("parking").sort({ createdAt: -1 }).lean(); }
function dateOnly(value) { const d = new Date(value); if (Number.isNaN(d.getTime())) return null; d.setHours(0, 0, 0, 0); return d; }
function overlaps(startA, endA, startB, endB) { return startA < endB && endA > startB; }

// Cancellation and date-change policy uses the payment-proof submission time when available.
function cancellationPolicy(booking) {
  const total = Math.max(0, Number(booking.totalAmount || 0));
  const paymentAt = booking.paymentProofSubmittedAt || booking.paymentDate || booking.createdAt;
  const hoursSincePayment = paymentAt ? (Date.now() - new Date(paymentAt).getTime()) / 3600000 : Infinity;
  const daysUntilCheckIn = (new Date(booking.checkIn).getTime() - Date.now()) / 86400000;
  if (hoursSincePayment <= 1) return { rule: "Within 1 hour after payment proof submission", fee: Math.min(500, total), refund: Math.max(0, total - 500) };
  if (daysUntilCheckIn >= 3) return { rule: "3 days or more before check-in", fee: Math.min(1000, total), refund: Math.max(0, total - 1000) };
  if (daysUntilCheckIn >= 0) return { rule: "2 days before check-in through check-in date", fee: Math.round(total * 0.5), refund: Math.round(total * 0.5) };
  return { rule: "Past check-in", fee: total, refund: 0 };
}

router.post("/guest-auth/login", async (req, res) => {
  try { const email = String(req.body.email || "").trim().toLowerCase(); const password = String(req.body.password || "").trim(); if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." }); const accounts = await GuestAccount.find({ email }).sort({ createdAt: -1 }); let account = null; for (const candidate of accounts) { if (await bcrypt.compare(password, candidate.passwordHash)) { account = candidate; break; } } if (!account) return res.status(401).json({ success: false, message: "Invalid email or password." }); account.lastLoginAt = new Date(); await account.save(); const token = jwt.sign({ accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" }); res.json({ success: true, message: "Login successful.", token, account: publicAccount(account), bookings: await bookingsForEmail(account.email) }); }
  catch (err) { console.error("GUEST LOGIN ERROR:", err); res.status(500).json({ success: false, message: err.message }); }
});

router.post("/guest-auth/change-password", async (req, res) => {
  try { const payload = verifyToken(req); const currentPassword = String(req.body.currentPassword || "").trim(); const newPassword = String(req.body.newPassword || ""); const confirmPassword = String(req.body.confirmPassword || ""); if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "All password fields are required." }); if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New passwords do not match." }); if (newPassword.length < 8) return res.status(400).json({ success: false, message: "Your new password must be at least 8 characters." }); if (newPassword === currentPassword) return res.status(400).json({ success: false, message: "Your new password must be different from the default password." }); const account = await GuestAccount.findById(payload.accountId); if (!account) return res.status(404).json({ success: false, message: "Account not found." }); if (!(await bcrypt.compare(currentPassword, account.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." }); account.passwordHash = await bcrypt.hash(newPassword, 12); account.defaultPassword = false; await account.save(); res.json({ success: true, message: "Password changed successfully.", account: publicAccount(account) }); }
  catch (err) { console.error("GUEST CHANGE PASSWORD ERROR:", err); res.status(401).json({ success: false, message: err.message || "Session expired or invalid." }); }
});

router.post("/guest-auth/forgot-password", async (req, res) => {
  try { const email = String(req.body.email || "").trim().toLowerCase(); if (!email) return res.status(400).json({ success: false, message: "Email address is required." }); const account = await GuestAccount.findOne({ email }).sort({ createdAt: -1 }); const genericMessage = "If an account exists for this email, a password reset email will be sent shortly."; if (!account) return res.json({ success: true, message: genericMessage }); const rawToken = crypto.randomBytes(32).toString("hex"); account.resetPasswordTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex"); account.resetPasswordExpiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000); await account.save(); const resetPage = process.env.GUEST_RESET_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/reset-password.html"; const resetUrl = `${resetPage}?token=${encodeURIComponent(rawToken)}`; const guestName = escapeHtml(account.email.split("@")[0] || "Guest"); const bookingReference = escapeHtml(account.bookingReference); const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#333;line-height:1.6;max-width:620px;margin:auto;padding:24px"><h2 style="color:#0b5d4d">CA Smart Staycation</h2><p>Dear ${guestName},</p><p>We received a request to reset the password for your guest account.</p><p><strong>Booking Reference:</strong> ${bookingReference}</p><p>This password reset link is valid for <strong>${RESET_MINUTES} minutes</strong> and can only be used once.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#0b5d4d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px">Reset My Password</a></p><p>If the button does not work, copy and paste this address into your browser:</p><p style="word-break:break-all;font-size:13px">${escapeHtml(resetUrl)}</p><p>If you did not request this, you can safely ignore this email. Your current password will remain unchanged.</p><p>CA Smart Staycation</p></body></html>`; try { await sendEmail(account.email, "Reset Your CA Smart Staycation Password", html); } catch (emailErr) { console.error("GUEST PASSWORD RESET EMAIL ERROR:", emailErr); account.resetPasswordTokenHash = null; account.resetPasswordExpiresAt = null; await account.save(); return res.status(503).json({ success: false, message: "We could not send the password reset email right now. Please try again later." }); } res.json({ success: true, message: genericMessage }); }
  catch (err) { console.error("GUEST FORGOT PASSWORD ERROR:", err); res.status(500).json({ success: false, message: "Unable to process password reset." }); }
});

router.post("/guest-auth/reset-password", async (req, res) => {
  try { const token = String(req.body.token || "").trim(); const newPassword = String(req.body.newPassword || ""); const confirmPassword = String(req.body.confirmPassword || ""); if (!token || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "Reset token and password fields are required." }); if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New passwords do not match." }); if (newPassword.length < 8) return res.status(400).json({ success: false, message: "Your new password must be at least 8 characters." }); const hash = crypto.createHash("sha256").update(token).digest("hex"); const account = await GuestAccount.findOne({ resetPasswordTokenHash: hash, resetPasswordExpiresAt: { $gt: new Date() } }); if (!account) return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired." }); account.passwordHash = await bcrypt.hash(newPassword, 12); account.defaultPassword = false; account.resetPasswordTokenHash = null; account.resetPasswordExpiresAt = null; await account.save(); res.json({ success: true, message: "Password reset successfully. You can now log in." }); }
  catch (err) { console.error("GUEST RESET PASSWORD ERROR:", err); res.status(500).json({ success: false, message: "Unable to reset password." }); }
});

router.get("/guest-auth/me", async (req, res) => {
  try { const payload = verifyToken(req); const account = await GuestAccount.findById(payload.accountId).lean(); if (!account) return res.status(401).json({ success: false, message: "Account not found." }); res.json({ success: true, account: publicAccount(account), bookings: await bookingsForEmail(account.email) }); }
  catch (err) { res.status(401).json({ success: false, message: "Session expired or invalid." }); }
});

router.post("/guest-auth/bookings/:id/cancel", async (req, res) => {
  try {
    const payload = verifyToken(req); const account = await GuestAccount.findById(payload.accountId).lean(); if (!account) return res.status(401).json({ success: false, message: "Account not found." }); const booking = await Booking.findById(req.params.id); if (!booking) return res.status(404).json({ success: false, message: "Booking not found." }); if (String(booking.email || "").trim().toLowerCase() !== String(account.email || "").trim().toLowerCase()) return res.status(403).json({ success: false, message: "You are not allowed to cancel this booking." }); if (!ACTIVE_STATUSES.includes(booking.bookingStatus)) return res.status(409).json({ success: false, message: "This booking can no longer be cancelled from the guest account." }); if (new Date(booking.checkIn).getTime() <= Date.now()) return res.status(409).json({ success: false, message: "A booking that has reached its check-in date can no longer be cancelled online." }); if (["Requested", "Processing", "Refunded"].includes(booking.refundStatus)) return res.status(409).json({ success: false, message: "A refund request has already been submitted for this booking." });
    const reason = String(req.body.reason || "Guest requested cancellation").trim().slice(0, 500); const hasPayment = booking.paymentStatus === "Paid" || Boolean(booking.paymentProof); booking.bookingStatus = "Cancelled"; booking.cancellationRequestedAt = new Date(); booking.cancellationReason = reason;
    if (hasPayment) { const policy = cancellationPolicy(booking); booking.refundRequested = true; booking.refundRequestedAt = new Date(); booking.refundAmount = policy.refund; booking.refundFee = policy.fee; booking.refundPolicyRule = policy.rule; booking.refundStatus = "Requested"; }
    await booking.save();
    res.json({ success: true, refundRequested: hasPayment, refundAmount: hasPayment ? booking.refundAmount : 0, inconvenienceFee: hasPayment ? booking.refundFee : 0, refundPolicyRule: hasPayment ? booking.refundPolicyRule : null, message: hasPayment ? `Booking cancelled. ${booking.refundPolicyRule}. Inconvenience fee: ₱${booking.refundFee.toLocaleString()}. Refund due: ₱${booking.refundAmount.toLocaleString()}. Your refund request has been submitted for admin processing.` : "Booking cancelled successfully. No payment was recorded, so no refund is required.", data: booking });
  } catch (err) { console.error("GUEST CANCEL BOOKING ERROR:", err); if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") return res.status(401).json({ success: false, message: "Session expired or invalid." }); res.status(500).json({ success: false, message: "Unable to cancel this booking." }); }
});

router.post("/guest-auth/bookings/:id/reschedule", async (req, res) => {
  try {
    const payload = verifyToken(req); const account = await GuestAccount.findById(payload.accountId).lean(); if (!account) return res.status(401).json({ success: false, message: "Account not found." }); const booking = await Booking.findById(req.params.id).populate("room").populate("parking"); if (!booking) return res.status(404).json({ success: false, message: "Booking not found." }); if (String(booking.email || "").trim().toLowerCase() !== String(account.email || "").trim().toLowerCase()) return res.status(403).json({ success: false, message: "You are not allowed to change this booking." }); if (!ACTIVE_STATUSES.includes(booking.bookingStatus)) return res.status(409).json({ success: false, message: "Only active bookings can be rescheduled." }); if (new Date(booking.checkIn).getTime() <= Date.now()) return res.status(409).json({ success: false, message: "A booking that has reached its check-in date can no longer be rescheduled online." });
    const newCheckIn = dateOnly(req.body.checkIn); const newCheckOut = dateOnly(req.body.checkOut); const today = dateOnly(new Date()); if (!newCheckIn || !newCheckOut || newCheckOut <= newCheckIn) return res.status(400).json({ success: false, message: "Please choose valid check-in and check-out dates." }); if (newCheckIn < today) return res.status(400).json({ success: false, message: "The new check-in date cannot be in the past." });
    const candidates = await Booking.find({ _id: { $ne: booking._id }, bookingStatus: { $in: ACTIVE_STATUSES }, $or: [...(booking.room ? [{ room: booking.room._id }] : []), ...(booking.parking ? [{ parking: booking.parking._id }] : [])] }).lean();
    const roomConflict = Boolean(booking.room) && candidates.some(other => other.room && String(other.room) === String(booking.room._id) && overlaps(newCheckIn, newCheckOut, new Date(other.checkIn), new Date(other.checkOut)));
    const parkingConflict = Boolean(booking.parking) && candidates.some(other => other.parking && String(other.parking) === String(booking.parking._id) && overlaps(newCheckIn, newCheckOut, new Date(other.checkIn), new Date(other.checkOut)));
    if (roomConflict || parkingConflict) return res.status(409).json({ success: false, message: roomConflict && parkingConflict ? "The accommodation and parking are already booked for the selected dates." : roomConflict ? "The accommodation is already booked for the selected dates." : "The parking is already booked for the selected dates." });
    const hasPayment = booking.paymentStatus === "Paid" || Boolean(booking.paymentProof); const policy = hasPayment ? cancellationPolicy(booking) : { rule: "No payment recorded", fee: 0, refund: 0 };
    const previousCheckIn = booking.checkIn; const previousCheckOut = booking.checkOut; booking.checkIn = newCheckIn; booking.checkOut = newCheckOut; booking.rescheduleHistory = booking.rescheduleHistory || []; booking.rescheduleHistory.push({ previousCheckIn, previousCheckOut, newCheckIn, newCheckOut, changedAt: new Date(), policyRule: policy.rule, inconvenienceFee: policy.fee, refundAmount: policy.refund });
    if (hasPayment) { booking.rescheduleFee = policy.fee; booking.reschedulePolicyRule = policy.rule; booking.rescheduleRefundAmount = policy.refund; booking.rescheduleRequestedAt = new Date(); }
    await booking.save();
    res.json({ success: true, inconvenienceFee: policy.fee, refundAmount: policy.refund, refundPolicyRule: policy.rule, message: hasPayment ? `Booking dates changed successfully. ${policy.rule}. Applicable inconvenience fee: ₱${policy.fee.toLocaleString()}. Refund basis: ₱${policy.refund.toLocaleString()}.` : "Booking dates changed successfully. No payment was recorded, so no inconvenience fee applies.", data: booking });
  } catch (err) { console.error("GUEST RESCHEDULE ERROR:", err); if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") return res.status(401).json({ success: false, message: "Session expired or invalid." }); res.status(500).json({ success: false, message: "Unable to change the booking dates." }); }
});

module.exports = router;
