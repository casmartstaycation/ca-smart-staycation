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

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
function verifyToken(req) {
  const token = getToken(req);
  if (!token) throw new Error("Authentication required.");
  return jwt.verify(token, JWT_SECRET);
}
function publicAccount(account) {
  return { id: account._id, email: account.email, bookingReference: account.bookingReference, mustChangePassword: account.defaultPassword === true };
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}
async function bookingsForEmail(email) {
  return Booking.find({ email: String(email || "").trim().toLowerCase() }).populate("room").populate("parking").sort({ createdAt: -1 }).lean();
}

router.post("/guest-auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });
    const accounts = await GuestAccount.find({ email }).sort({ createdAt: -1 });
    let account = null;
    for (const candidate of accounts) {
      if (await bcrypt.compare(password, candidate.passwordHash)) { account = candidate; break; }
    }
    if (!account) return res.status(401).json({ success: false, message: "Invalid email or password." });
    account.lastLoginAt = new Date();
    await account.save();
    const token = jwt.sign({ accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" });
    const bookings = await bookingsForEmail(account.email);
    res.json({ success: true, message: "Login successful.", token, account: publicAccount(account), bookings });
  } catch (err) {
    console.error("GUEST LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/guest-auth/change-password", async (req, res) => {
  try {
    const payload = verifyToken(req);
    const currentPassword = String(req.body.currentPassword || "").trim();
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");
    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "All password fields are required." });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New passwords do not match." });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: "Your new password must be at least 8 characters." });
    if (newPassword === currentPassword) return res.status(400).json({ success: false, message: "Your new password must be different from the default password." });
    const account = await GuestAccount.findById(payload.accountId);
    if (!account) return res.status(404).json({ success: false, message: "Account not found." });
    if (!(await bcrypt.compare(currentPassword, account.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." });
    account.passwordHash = await bcrypt.hash(newPassword, 12);
    account.defaultPassword = false;
    await account.save();
    res.json({ success: true, message: "Password changed successfully.", account: publicAccount(account) });
  } catch (err) {
    console.error("GUEST CHANGE PASSWORD ERROR:", err);
    res.status(401).json({ success: false, message: err.message || "Session expired or invalid." });
  }
});

router.post("/guest-auth/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: "Email address is required." });
    const account = await GuestAccount.findOne({ email }).sort({ createdAt: -1 });
    const genericMessage = "If an account exists for this email, a password reset email will be sent shortly.";
    if (!account) return res.json({ success: true, message: genericMessage });
    const rawToken = crypto.randomBytes(32).toString("hex");
    account.resetPasswordTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    account.resetPasswordExpiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    await account.save();
    const resetPage = process.env.GUEST_RESET_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/reset-password.html";
    const resetUrl = `${resetPage}?token=${encodeURIComponent(rawToken)}`;
    const guestName = escapeHtml(account.email.split("@")[0] || "Guest");
    const bookingReference = escapeHtml(account.bookingReference);
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#333;line-height:1.6;max-width:620px;margin:auto;padding:24px"><h2 style="color:#0b5d4d">CA Smart Staycation</h2><p>Dear ${guestName},</p><p>We received a request to reset the password for your guest account.</p><p><strong>Booking Reference:</strong> ${bookingReference}</p><p>This password reset link is valid for <strong>${RESET_MINUTES} minutes</strong> and can only be used once.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#0b5d4d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px">Reset My Password</a></p><p>If the button does not work, copy and paste this address into your browser:</p><p style="word-break:break-all;font-size:13px">${escapeHtml(resetUrl)}</p><p>If you did not request this, you can safely ignore this email. Your current password will remain unchanged.</p><p>CA Smart Staycation</p></body></html>`;
    try { await sendEmail(account.email, "Reset Your CA Smart Staycation Password", html); }
    catch (emailErr) { console.error("GUEST PASSWORD RESET EMAIL ERROR:", emailErr); account.resetPasswordTokenHash = null; account.resetPasswordExpiresAt = null; await account.save(); return res.status(503).json({ success: false, message: "We could not send the password reset email right now. Please try again later." }); }
    res.json({ success: true, message: genericMessage });
  } catch (err) { console.error("GUEST FORGOT PASSWORD ERROR:", err); res.status(500).json({ success: false, message: "Unable to process password reset." }); }
});

router.post("/guest-auth/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");
    if (!token || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "Reset token and password fields are required." });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New passwords do not match." });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: "Your new password must be at least 8 characters." });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const account = await GuestAccount.findOne({ resetPasswordTokenHash: hash, resetPasswordExpiresAt: { $gt: new Date() } });
    if (!account) return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired." });
    account.passwordHash = await bcrypt.hash(newPassword, 12);
    account.defaultPassword = false;
    account.resetPasswordTokenHash = null;
    account.resetPasswordExpiresAt = null;
    await account.save();
    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err) { console.error("GUEST RESET PASSWORD ERROR:", err); res.status(500).json({ success: false, message: "Unable to reset password." }); }
});

router.get("/guest-auth/me", async (req, res) => {
  try {
    const payload = verifyToken(req);
    const account = await GuestAccount.findById(payload.accountId).lean();
    if (!account) return res.status(401).json({ success: false, message: "Account not found." });
    const bookings = await bookingsForEmail(account.email);
    res.json({ success: true, account: publicAccount(account), bookings });
  } catch (err) { res.status(401).json({ success: false, message: "Session expired or invalid." }); }
});

module.exports = router;
