const express = require("express");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const GuestAccount = require("../models/GuestAccount");
const BookingCompanion = require("../models/BookingCompanion");
const Notification = require("../models/Notification");
const { saveBuffer, openDownload, getFileInfo } = require("../services/gridfsStorage");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10 }, fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.mimetype)) return cb(new Error("IDs must be JPG, PNG, WEBP, or PDF."));
  cb(null, true);
} });
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "casmartstaycation@gmail.com").trim().toLowerCase();
function verifyGuest(req) { const header = req.headers.authorization || ""; if (!header.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status: 401 }); try { return jwt.verify(header.slice(7), JWT_SECRET); } catch (err) { throw Object.assign(new Error("Session expired or invalid."), { status: 401 }); } }
async function getGuestBooking(req) {
  const payload = verifyGuest(req);
  let account = null;
  if (payload.accountId) account = await GuestAccount.findById(String(payload.accountId)).lean().catch(() => null);
  if (!account && payload.email) account = await GuestAccount.findOne({ email: String(payload.email).trim().toLowerCase() }).sort({ createdAt: -1 }).lean();
  if (!account) throw Object.assign(new Error("Guest account not found. Please log in again."), { status: 401 });
  const key = String(req.params.id || "").trim();
  const booking = /^[a-f0-9]{24}$/i.test(key) ? await Booking.findById(key) : await Booking.findOne({ bookingReference: key });
  if (!booking) throw Object.assign(new Error("Booking not found."), { status: 404 });
  const accountEmail = String(account.email || payload.email || "").trim().toLowerCase();
  const bookingEmail = String(booking.email || "").trim().toLowerCase();
  if (!accountEmail || !bookingEmail || accountEmail !== bookingEmail) throw Object.assign(new Error("You are not allowed to access this booking."), { status: 403 });
  return booking;
}

// Companion information is for the primary guest's other qualifying guests.
// The primary guest is not entered as a companion. Adults age 3+ are counted;
// children age 0–2 are never counted and never create a companion requirement.
// Studio capacity is 4 qualifying guests, so the maximum is 3 companions.
function qualifyingAdults(booking) {
  const adults = Number(booking?.adults);
  return Number.isFinite(adults) ? Math.max(0, Math.floor(adults)) : 0;
}
function expectedCompanionCount(booking) {
  return Math.max(0, Math.min(3, qualifyingAdults(booking) - 1));
}

async function saveCompanionFile(file, bookingId, index) { const safe = String(bookingId).replace(/[^a-zA-Z0-9_-]/g, ""); const filename = `${safe}-companion-${index + 1}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`; return saveBuffer(file.buffer, filename, file.mimetype); }
async function notify(booking, message) { try { await Notification.insertMany([{ recipientType: "guest", recipientEmail: booking.email, booking: booking._id, title: `Companion Information Submitted — ${booking.bookingReference}`, message, type: "companion-information" }, { recipientType: "admin", recipientEmail: ADMIN_EMAIL, booking: booking._id, title: `Guest Companion Information Submitted — ${booking.bookingReference}`, message, type: "companion-information" }]); } catch (err) { console.error("COMPANION NOTIFICATION ERROR:", err); } }
router.get("/guest/bookings/:id/companions", async (req, res) => { try { const booking = await getGuestBooking(req); const companions = await BookingCompanion.find({ booking: booking._id }).select("fullName idFileName submittedAt createdAt").sort({ createdAt: 1 }).lean(); res.json({ success: true, required: expectedCompanionCount(booking), qualifyingAdults: qualifyingAdults(booking), children: Number(booking.children || 0), companions }); } catch (err) { console.error("GUEST COMPANIONS GET ERROR:", err); res.status(err.status || 400).json({ success: false, message: err.message || "Unable to load companion information." }); } });
router.post("/guest/bookings/:id/companions", upload.array("companionIds", 10), async (req, res) => { try { const booking = await getGuestBooking(req); if (["Cancelled", "Expired", "Checked Out"].includes(booking.bookingStatus)) return res.status(409).json({ success: false, message: "Companion information can no longer be changed for this booking." }); if (booking.parkingOnly || String(booking.bookingType || "").toLowerCase() === "parking only") return res.status(409).json({ success: false, message: "Companion visitor-pass information is only required for accommodation bookings." }); const required = expectedCompanionCount(booking); let companions = []; try { companions = JSON.parse(String(req.body.companions || "[]")); } catch (_) { return res.status(400).json({ success: false, message: "Invalid companion information." }); } if (!Array.isArray(companions) || companions.length !== required) return res.status(400).json({ success: false, message: `Please provide the full name and ID for all ${required} companion${required === 1 ? "" : "s"}.` }); if (!Array.isArray(req.files) || req.files.length !== required) return res.status(400).json({ success: false, message: `Please upload one valid ID for every companion. ${required} ID upload${required === 1 ? " is" : "s are"} required.` }); const cleaned = companions.map(item => String(item?.fullName || "").trim()); if (cleaned.length !== required || cleaned.some(Boolean) === false || cleaned.some(name => !name)) return res.status(400).json({ success: false, message: "Every companion must have a full name." }); const saved = []; for (let i = 0; i < required; i++) { const file = req.files[i]; const idFile = await saveCompanionFile(file, booking._id, i); saved.push({ booking: booking._id, fullName: cleaned[i], idFile, idFileName: file.originalname, submittedAt: new Date() }); } await BookingCompanion.deleteMany({ booking: booking._id }); await BookingCompanion.insertMany(saved); await notify(booking, `${required} companion record${required === 1 ? "" : "s"} with ID upload${required === 1 ? "" : "s"} was submitted for building gate and visitor-pass processing.`); res.json({ success: true, message: "Companion information and IDs submitted successfully.", required, qualifyingAdults: qualifyingAdults(booking), children: Number(booking.children || 0), companions: saved.map(x => ({ fullName: x.fullName, idFileName: x.idFileName, submittedAt: x.submittedAt })) }); } catch (err) { console.error("GUEST COMPANIONS SAVE ERROR:", err); res.status(err.status || 400).json({ success: false, message: err.message || "Unable to save companion information." }); } });
router.get("/guest/bookings/:id/companions/:companionId/id", async (req, res) => { try { const booking = await getGuestBooking(req); const companion = await BookingCompanion.findOne({ _id: req.params.companionId, booking: booking._id }).lean(); if (!companion || !companion.idFile) return res.status(404).send("ID not found."); const info = await getFileInfo(companion.idFile).catch(() => null); const stream = openDownload(companion.idFile); if (!stream) return res.status(404).send("ID not found."); res.setHeader("Content-Type", info?.contentType || "application/octet-stream"); res.setHeader("Content-Disposition", `inline; filename="${String(companion.idFileName || "companion-id").replace(/[^a-zA-Z0-9._-]/g, "_")}"`); res.setHeader("Cache-Control", "private, no-store"); stream.pipe(res); } catch (err) { res.status(err.status || 401).send(err.message || "Unable to open ID."); } });
module.exports = router;
