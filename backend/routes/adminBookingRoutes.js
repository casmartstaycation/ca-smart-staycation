const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Parking = require("../models/Parking");
const GuestAccount = require("../models/GuestAccount");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../mail/sendEmail");
const path = require("path");
const fs = require("fs");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (ADMIN_PASSWORD ? crypto.createHash("sha256").update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest("hex") : "");
const TERMINAL_STATUSES = ["Cancelled", "Checked Out", "Expired"];
const paymentUploadDir = path.join(__dirname, "../uploads/payments");

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !ADMIN_JWT_SECRET) return res.status(401).json({ success: false, message: "Admin authentication required." });
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload.role !== "admin" || String(payload.email || "").toLowerCase() !== String(ADMIN_EMAIL).toLowerCase()) return res.status(403).json({ success: false, message: "Admin access required." });
    req.admin = payload;
    next();
  } catch (err) { return res.status(401).json({ success: false, message: "Admin session expired or invalid." }); }
}

function makeReference() { return "CA" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000); }
function makeTemporaryPassword() { return `CA${crypto.randomBytes(5).toString("base64url")}!`; }
function deletePaymentProof(filename) { if (!filename) return; const safeName = path.basename(String(filename)); const filePath = path.join(paymentUploadDir, safeName); try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.error("PAYMENT PROOF DELETE ERROR:", err.message); } }

router.post("/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, mobile, address, room, parking, parkingOnly, checkIn, checkOut, adults, children, totalAmount, paymentStatus, notes, paymentReference } = req.body;
    if (!firstName || !lastName || !email || !mobile || !address) return res.status(400).json({ success: false, message: "Guest name, email, mobile and address are required." });
    const startDate = new Date(checkIn), endDate = new Date(checkOut);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return res.status(400).json({ success: false, message: "Invalid booking dates. Check-out must be after check-in." });
    const normalizedAdults = Math.max(1, Number(adults || 1)), normalizedChildren = Math.max(0, Number(children || 0));
    if (normalizedAdults > 4) return res.status(400).json({ success: false, message: "Maximum occupancy is 4 adults." });
    if (!parkingOnly && !room) return res.status(400).json({ success: false, message: "Select an accommodation or choose Parking Only." });
    if (room) {
      const roomExists = await Room.findById(room).lean();
      if (!roomExists) return res.status(400).json({ success: false, message: "Selected accommodation was not found." });
      const conflict = await Booking.findOne({ room, bookingStatus: { $nin: TERMINAL_STATUSES }, checkIn: { $lt: endDate }, checkOut: { $gt: startDate } }).lean();
      if (conflict) return res.status(409).json({ success: false, message: `The selected accommodation is already booked for these dates (${conflict.bookingReference}).` });
    }
    if (parking) {
      const requested = await Parking.findById(parking).lean();
      if (!requested) return res.status(400).json({ success: false, message: "Selected parking slot was not found." });
      const overlaps = await Booking.find({ parking: { $ne: null }, bookingStatus: { $nin: TERMINAL_STATUSES }, checkIn: { $lt: endDate }, checkOut: { $gt: startDate } }).populate("parking").lean();
      const conflict = overlaps.find(b => String(b.parking?._id) === String(requested._id));
      if (conflict) return res.status(409).json({ success: false, message: `The selected parking slot is already reserved (${conflict.bookingReference}).` });
    }
    const amount = Number(totalAmount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, message: "Enter a valid total amount." });
    const booking = new Booking({ bookingReference: makeReference(), firstName: String(firstName).trim(), lastName: String(lastName).trim(), email: String(email).trim().toLowerCase(), mobile: String(mobile).trim(), address: String(address).trim(), room: parkingOnly ? null : room || null, parking: parking || null, parkingOnly: Boolean(parkingOnly), checkIn: startDate, checkOut: endDate, adults: normalizedAdults, children: normalizedChildren, totalAmount: amount, paymentStatus: paymentStatus || "Pending", bookingStatus: "Reserved", housekeepingStatus: "Clean", notes: notes || "", paymentReference: paymentReference || "", paymentDate: paymentStatus === "Paid" ? new Date() : null, paymentDeadline: null });
    await booking.save();
    const saved = await Booking.findById(booking._id).populate("room").populate("parking");
    res.status(201).json({ success: true, message: "Guest booking created successfully.", data: saved });
  } catch (err) { console.error("ADMIN CREATE BOOKING ERROR:", err); res.status(500).json({ success: false, message: err.message }); }
});

router.delete("/bookings/:id", requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    deletePaymentProof(booking.paymentProof);
    for (const item of (booking.paymentProofHistory || [])) deletePaymentProof(item?.filename);
    deletePaymentProof(booking.reschedulePaymentProof);
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Booking deleted." });
  } catch (err) { console.error("ADMIN DELETE BOOKING ERROR:", err); res.status(500).json({ success: false, message: "Unable to delete booking." }); }
});

router.delete("/bookings", requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find({}).select("paymentProof paymentProofHistory reschedulePaymentProof").lean();
    for (const booking of bookings) {
      deletePaymentProof(booking.paymentProof);
      for (const item of (booking.paymentProofHistory || [])) deletePaymentProof(item?.filename);
      deletePaymentProof(booking.reschedulePaymentProof);
    }
    const result = await Booking.deleteMany({});
    res.json({ success: true, message: `${result.deletedCount || 0} booking(s) deleted.`, deletedCount: result.deletedCount || 0 });
  } catch (err) { console.error("ADMIN DELETE ALL BOOKINGS ERROR:", err); res.status(500).json({ success: false, message: "Unable to delete bookings." }); }
});

// Full guest information and upload references are available to authenticated admins only.
router.get("/admin/bookings/:id/full", requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("room").populate("parking").lean();
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    res.json({ success: true, data: booking, uploads: {
      governmentId: booking.governmentId || "",
      driversLicense: booking.driversLicense || "",
      paymentProof: booking.paymentProof || "",
      paymentProofHistory: Array.isArray(booking.paymentProofHistory) ? booking.paymentProofHistory : [],
      reschedulePaymentProof: booking.reschedulePaymentProof || ""
    }});
  } catch (err) { console.error("ADMIN FULL BOOKING ERROR:", err); res.status(500).json({ success: false, message: "Unable to load complete booking information." }); }
});

router.post("/admin/bookings/:id/reset-guest-password", requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select("email firstName lastName bookingReference").lean();
    if (!booking || !booking.email) return res.status(404).json({ success: false, message: "Guest booking or email address not found." });
    const email = String(booking.email).trim().toLowerCase();
    const account = await GuestAccount.findOne({ email }).sort({ createdAt: -1 });
    if (!account) return res.status(404).json({ success: false, message: "No guest account exists for this booking email." });
    const temporaryPassword = makeTemporaryPassword();
    account.passwordHash = await bcrypt.hash(temporaryPassword, 12); account.defaultPassword = true; account.resetPasswordTokenHash = null; account.resetPasswordExpiresAt = null; await account.save();
    let emailSent = false;
    try {
      const guestName = `${booking.firstName || "Guest"} ${booking.lastName || ""}`.trim();
      const html = `<!doctype html><html><body><h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>Your guest account password has been reset by CA Smart Staycation.</p><p><strong>Booking Reference:</strong> ${booking.bookingReference || account.bookingReference || "—"}</p><p><strong>Temporary Password:</strong> ${temporaryPassword}</p><p>Please log in and change your password after signing in.</p><p>CA Smart Staycation</p></body></html>`;
      await sendEmail(email, "Your CA Smart Staycation Guest Account Password", html); emailSent = true;
    } catch (emailErr) { console.error("ADMIN GUEST PASSWORD EMAIL ERROR:", emailErr); }
    res.json({ success: true, email, emailSent, temporaryPassword, mustChangePassword: true, message: emailSent ? "Guest password reset successfully. The temporary password was emailed to the guest." : "Guest password reset successfully, but the email could not be sent. Give the temporary password to the guest securely." });
  } catch (err) { console.error("ADMIN RESET GUEST PASSWORD ERROR:", err); res.status(500).json({ success: false, message: "Unable to reset the guest password." }); }
});

module.exports = router;
