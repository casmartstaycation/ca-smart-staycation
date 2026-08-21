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

function getToken(req) { const header = req.headers.authorization || ""; return header.startsWith("Bearer ") ? header.slice(7) : ""; }
function verifyToken(req) { const token = getToken(req); if (!token) throw new Error("Authentication required."); return jwt.verify(token, JWT_SECRET); }
function publicAccount(account) { return { id: account._id, email: account.email, bookingReference: account.bookingReference, mustChangePassword: account.defaultPassword === true }; }

async function lightweightBookingsForGuest(email, bookingReference) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedReference = String(bookingReference || "").trim();
  const conditions = [];
  if (normalizedEmail) conditions.push({ email: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (normalizedReference) conditions.push({ bookingReference: normalizedReference });
  if (!conditions.length) return [];
  return Booking.find({ $or: conditions })
    .select("_id bookingReference firstName lastName email mobile bookingType room parking parkingOnly checkIn checkOut adults children totalAmount paymentStatus bookingStatus housekeepingStatus paymentProof paymentProofSubmittedAt paymentDate voucherDiscountPercent complimentaryNonCancellable refundStatus refundAmount refundFee refundPolicyRule cancellationRequestedAt cancellationReason extraRequests createdAt updatedAt")
    .populate({ path: "room", select: "_id unitNumber unitName category capacity price weekendPrice holidayPrice status" })
    .populate({ path: "parking", select: "_id parkingNumber parkingName status" })
    .sort({ createdAt: -1 }).lean();
}

router.post("/guest-auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });
    const accounts = await GuestAccount.find({ email }).sort({ createdAt: -1 }); let account = null;
    for (const candidate of accounts) { if (candidate.passwordHash && await bcrypt.compare(password, candidate.passwordHash)) { account = candidate; break; } if (!account && candidate.defaultPassword === true && String(candidate.bookingReference || "").trim() === password) { candidate.passwordHash = await bcrypt.hash(password, 12); candidate.defaultPassword = true; await candidate.save(); account = candidate; break; } }
    if (!account) return res.status(401).json({ success: false, message: "Invalid email or password." });
    account.lastLoginAt = new Date(); await account.save();
    const token = jwt.sign({ accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ success: true, message: "Login successful.", token, account: publicAccount(account), bookings: await lightweightBookingsForGuest(account.email, account.bookingReference) });
  } catch (err) { console.error("GUEST FAST LOGIN ERROR:", err); res.status(500).json({ success: false, message: err.message }); }
});

router.post("/guest-auth/forgot-password", async (req, res) => {
  try { const email = String(req.body.email || "").trim().toLowerCase(); if (!email) return res.status(400).json({ success: false, message: "Email address is required." }); const genericMessage = "If an account exists for this email, a password reset email will be sent shortly."; const account = await GuestAccount.findOne({ email }).sort({ createdAt: -1 }); if (!account) return res.json({ success: true, message: genericMessage }); const rawToken = crypto.randomBytes(32).toString("hex"); account.resetPasswordTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex"); account.resetPasswordExpiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000); await account.save(); const resetPage = process.env.GUEST_RESET_URL || "https://www.casmartstaycation.com/guest-booking/reset-password.html"; const resetUrl = `${resetPage}?token=${encodeURIComponent(rawToken)}`; const guestName = String(account.email.split("@")[0] || "Guest"); const html = `<!doctype html><html><body><h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>We received a request to reset your guest account password.</p><p><strong>Booking Reference:</strong> ${String(account.bookingReference || "")}</p><p>This link is valid for <strong>${RESET_MINUTES} minutes</strong>.</p><p><a href="${resetUrl}">Reset My Password</a></p><p>CA Smart Staycation</p></body></html>`; try { await sendEmail(account.email, "Reset Your CA Smart Staycation Password", html); } catch (emailErr) { console.error("GUEST PASSWORD RESET EMAIL ERROR:", emailErr); account.resetPasswordTokenHash = null; account.resetPasswordExpiresAt = null; await account.save(); return res.status(503).json({ success: false, message: "We could not send the password reset email right now. Please try again later." }); } res.json({ success: true, message: genericMessage }); }
  catch (err) { console.error("GUEST FAST FORGOT PASSWORD ERROR:", err); res.status(500).json({ success: false, message: "Unable to process password reset." }); }
});

router.post("/guest-auth/reset-password", async (req, res) => {
  try { const token = String(req.body.token || "").trim(); const newPassword = String(req.body.newPassword || ""); const confirmPassword = String(req.body.confirmPassword || ""); if (!token || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "Reset token and password fields are required." }); if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New passwords do not match." }); if (newPassword.length < 8) return res.status(400).json({ success: false, message: "Your new password must be at least 8 characters." }); const hash = crypto.createHash("sha256").update(token).digest("hex"); const account = await GuestAccount.findOne({ resetPasswordTokenHash: hash, resetPasswordExpiresAt: { $gt: new Date() } }); if (!account) return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired." }); account.passwordHash = await bcrypt.hash(newPassword, 12); account.defaultPassword = false; account.resetPasswordTokenHash = null; account.resetPasswordExpiresAt = null; await account.save(); res.json({ success: true, message: "Password reset successfully. You can now log in." }); }
  catch (err) { console.error("GUEST FAST RESET PASSWORD ERROR:", err); res.status(500).json({ success: false, message: "Unable to reset password." }); }
});

router.get("/guest-auth/me", async (req, res) => { try { const payload = verifyToken(req); const account = await GuestAccount.findById(payload.accountId).select("_id email bookingReference defaultPassword").lean(); if (!account) return res.status(401).json({ success: false, message: "Account not found." }); const bookings = await lightweightBookingsForGuest(account.email, account.bookingReference); res.json({ success: true, account: publicAccount(account), bookings }); } catch (err) { res.status(401).json({ success: false, message: "Session expired or invalid." }); } });
router.put("/guest-auth/account/email", async (req, res) => { try { const payload = verifyToken(req); const password = String(req.body.password || "").trim(); const email = String(req.body.email || "").trim().toLowerCase(); if (!password || !email) return res.status(400).json({ success: false, message: "New email and current password are required." }); const account = await GuestAccount.findById(payload.accountId); if (!account) return res.status(404).json({ success: false, message: "Account not found." }); if (!(await bcrypt.compare(password, account.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." }); const existing = await GuestAccount.findOne({ email, _id: { $ne: account._id } }).select("_id").lean(); if (existing) return res.status(409).json({ success: false, message: "That email is already registered to another guest account." }); const oldEmail = String(account.email).trim().toLowerCase(); account.email = email; await account.save(); if (oldEmail !== email) await Booking.updateMany({ email: oldEmail }, { $set: { email } }); const token = jwt.sign({ accountId: account._id.toString(), email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" }); res.json({ success: true, message: "Email updated successfully.", token, account: publicAccount(account) }); } catch (err) { console.error("GUEST EMAIL UPDATE ERROR:", err); res.status(400).json({ success: false, message: err.message || "Unable to update email." }); } });
router.put("/guest-auth/account/password", async (req, res) => { try { const payload = verifyToken(req); const currentPassword = String(req.body.currentPassword || "").trim(); const newPassword = String(req.body.newPassword || "").trim(); if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Current and new passwords are required." }); if (newPassword.length < 8) return res.status(400).json({ success: false, message: "New password must be at least 8 characters." }); const account = await GuestAccount.findById(payload.accountId); if (!account) return res.status(404).json({ success: false, message: "Account not found." }); if (!(await bcrypt.compare(password, account.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." }); const existing = await GuestAccount.findOne({ email, _id: { $ne: account._id } }).select("_id").lean(); if (existing) return res.status(409).json({ success: false, message: "That email is already registered to another guest account." }); const oldEmail = String(account.email).trim().toLowerCase(); account.email = email; await account.save(); if (oldEmail !== email) await Booking.updateMany({ email: oldEmail }, { $set: { email } }); const token = jwt.sign({ accountId: account._id.toString(), email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" }); res.json({ success: true, message: "Email updated successfully.", token, account: publicAccount(account) }); } catch (err) { console.error("GUEST EMAIL UPDATE ERROR:", err); res.status(400).json({ success: false, message: err.message || "Unable to update email." }); } });
router.put("/guest-auth/account/password", async (req, res) => { try { const payload = verifyToken(req); const currentPassword = String(req.body.currentPassword || "").trim(); const newPassword = String(req.body.newPassword || "").trim(); if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Current and new passwords are required." }); if (newPassword.length < 8) return res.status(400).json({ success: false, message: "New password must be at least 8 characters." }); const account = await GuestAccount.findById(payload.accountId); if (!account) return res.status(404).json({ success: false, message: "Account not found." }); if (!(await bcrypt.compare(currentPassword, account.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." }); account.passwordHash = await bcrypt.hash(newPassword, 12); account.defaultPassword = false; account.lastPasswordChangeAt = new Date(); await account.save(); res.json({ success: true, message: "Password changed successfully.", account: publicAccount(account) }); } catch (err) { console.error("GUEST PASSWORD UPDATE ERROR:", err); res.status(400).json({ success: false, message: err.message || "Unable to change password." }); } });

// Load the corrected cancellation route before the older guestAuthRoutes module is reached.
router.use(require("./guestCancellationRoutes"));

// Guest additional requests: extra guest or extra amenity set. These are attached to the existing booking.
router.post("/guest-auth/bookings/:id/extra-requests", async (req, res) => {
  try {
    const payload = verifyToken(req);
    const account = await GuestAccount.findById(payload.accountId).select("email bookingReference").lean();
    if (!account) return res.status(401).json({ success: false, message: "Account not found." });
    const booking = await Booking.findOne({ _id: req.params.id, $or: [{ email: String(account.email).trim().toLowerCase() }, { bookingReference: String(account.bookingReference || "").trim() }] });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    if (["Cancelled", "Expired", "Checked Out"].includes(booking.bookingStatus)) return res.status(400).json({ success: false, message: "Additional requests are unavailable for this booking." });
    const type = String(req.body.type || "").trim();
    const quantity = Math.max(1, Math.min(2, Number(req.body.quantity || 1)));
    if (!["extra_guest", "extra_set"].includes(type)) return res.status(400).json({ success: false, message: "Invalid request type." });
    const pending = (booking.extraRequests || []).filter(r => r.status === "Pending" && r.type === type).reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    if (pending + quantity > 2) return res.status(400).json({ success: false, message: "Maximum of 2 additional requests is allowed." });
    const nights = Math.max(1, Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000));
    const amount = 300 * quantity * nights;
    booking.extraRequests.push({ type, quantity, nightlyRate: 300, nights, amount, status: "Pending", requestedAt: new Date() });
    await booking.save();
    res.status(201).json({ success: true, message: "Additional request submitted for administrator approval.", request: booking.extraRequests[booking.extraRequests.length - 1], nights, amount });
  } catch (err) { console.error("GUEST EXTRA REQUEST ERROR:", err); res.status(err.name === "JsonWebTokenError" ? 401 : 400).json({ success: false, message: err.message || "Unable to submit request." }); }
});

module.exports = router;
