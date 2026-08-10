const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const GuestAccount = require("../models/GuestAccount");

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads/guest-documents");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, uploadDir); },
  filename(req, file, cb) { const safeRef = String(req.params.id || "booking").replace(/[^a-zA-Z0-9_-]/g, ""); cb(null, `${safeRef}-${file.fieldname}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`); }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) { const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"]; if (!allowed.includes(file.mimetype)) return cb(new Error("Documents must be JPG, PNG, WEBP, or PDF.")); cb(null, true); }
});
function guestFromToken(req) { const header = req.headers.authorization || ""; if (!header.startsWith("Bearer ")) throw new Error("Authentication required."); return jwt.verify(header.slice(7), process.env.JWT_SECRET || "ca-smart-staycation-guest-secret"); }

router.post("/bookings/:id/reschedule-payment", upload.single("reschedulePaymentProof"), async (req, res) => {
  try {
    const payload = guestFromToken(req); const account = await GuestAccount.findById(payload.accountId).lean(); if (!account) return res.status(401).json({ success: false, message: "Account not found." });
    const booking = await Booking.findById(req.params.id); if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    if (String(booking.email || "").trim().toLowerCase() !== String(account.email || "").trim().toLowerCase()) return res.status(403).json({ success: false, message: "You are not allowed to update this booking." });
    if (!booking.reschedulePending || !booking.reschedulePendingCheckIn || !booking.reschedulePendingCheckOut) return res.status(409).json({ success: false, message: "There is no pending date-change request for this booking." });
    if (booking.reschedulePaymentStatus === "Verified") return res.status(409).json({ success: false, message: "The date-change fee has already been submitted." });
    if (!req.file) return res.status(400).json({ success: false, message: "Proof of payment for the convenience fee is required." });
    const oldCheckIn = booking.checkIn; const oldCheckOut = booking.checkOut; const newCheckIn = booking.reschedulePendingCheckIn; const newCheckOut = booking.reschedulePendingCheckOut;
    booking.reschedulePaymentProof = req.file.filename; booking.reschedulePaymentSubmittedAt = new Date(); booking.reschedulePaymentStatus = "Pending Verification"; booking.checkIn = newCheckIn; booking.checkOut = newCheckOut;
    booking.rescheduleHistory = booking.rescheduleHistory || []; booking.rescheduleHistory.push({ previousCheckIn: oldCheckIn, previousCheckOut: oldCheckOut, newCheckIn, newCheckOut, changedAt: new Date(), policyRule: booking.reschedulePolicyRule, inconvenienceFee: booking.rescheduleFee, refundAmount: booking.rescheduleRefundAmount });
    booking.reschedulePending = false; booking.reschedulePendingCheckIn = null; booking.reschedulePendingCheckOut = null; await booking.save();
    res.json({ success: true, message: `Proof of payment uploaded successfully. Your booking dates have been changed to ${new Date(newCheckIn).toLocaleDateString("en-PH")} to ${new Date(newCheckOut).toLocaleDateString("en-PH")}. The ₱${Number(booking.rescheduleFee || 0).toLocaleString()} convenience fee is now waiting for admin verification.`, data: booking });
  } catch (err) { console.error("RESCHEDULE PAYMENT UPLOAD ERROR:", err); if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") return res.status(401).json({ success: false, message: "Session expired or invalid." }); res.status(400).json({ success: false, message: err.message || "Convenience fee proof upload failed." }); }
});

router.post("/bookings/:id/documents", upload.fields([{ name: "governmentId", maxCount: 1 }, { name: "driversLicense", maxCount: 1 }]), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id); if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    const governmentId = req.files?.governmentId?.[0]; const driversLicense = req.files?.driversLicense?.[0];
    if (!governmentId && !booking.governmentId && !booking.parkingOnly) return res.status(400).json({ success: false, message: "Government-issued ID is required." });
    if (booking.parking && !driversLicense && !booking.driversLicense) return res.status(400).json({ success: false, message: "Driver's license is required for parking bookings." });
    if (governmentId) booking.governmentId = governmentId.filename; if (driversLicense) booking.driversLicense = driversLicense.filename;
    booking.vehicleBrand = String(req.body.vehicleBrand || booking.vehicleBrand || "").trim(); booking.vehicleModel = String(req.body.vehicleModel || booking.vehicleModel || "").trim(); booking.vehicleColor = String(req.body.vehicleColor || booking.vehicleColor || "").trim(); booking.plateNumber = String(req.body.plateNumber || booking.plateNumber || "").trim(); await booking.save();
    res.json({ success: true, message: "Guest documents uploaded successfully.", data: { governmentId: booking.governmentId, driversLicense: booking.driversLicense, vehicleBrand: booking.vehicleBrand, vehicleModel: booking.vehicleModel, vehicleColor: booking.vehicleColor, plateNumber: booking.plateNumber } });
  } catch (err) { console.error("GUEST DOCUMENT UPLOAD ERROR:", err); res.status(400).json({ success: false, message: err.message || "Document upload failed." }); }
});

router.get("/bookings/:id/documents/:type", async (req, res) => {
  try { const booking = await Booking.findById(req.params.id).lean(); if (!booking) return res.status(404).send("Booking not found."); const field = req.params.type === "driversLicense" ? "driversLicense" : req.params.type === "governmentId" ? "governmentId" : null; if (!field || !booking[field]) return res.status(404).send("Document not found."); const filePath = path.join(uploadDir, path.basename(booking[field])); if (!fs.existsSync(filePath)) return res.status(404).send("Document file not found."); res.sendFile(filePath); }
  catch (err) { res.status(500).send("Unable to open document."); }
});

module.exports = router;
