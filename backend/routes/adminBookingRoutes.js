const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Parking = require("../models/Parking");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (ADMIN_PASSWORD ? crypto.createHash("sha256").update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest("hex") : "");
const TERMINAL_STATUSES = ["Cancelled", "Checked Out", "Expired"];

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !ADMIN_JWT_SECRET) return res.status(401).json({ success: false, message: "Admin authentication required." });
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload.role !== "admin" || String(payload.email || "").toLowerCase() !== String(ADMIN_EMAIL).toLowerCase()) {
      return res.status(403).json({ success: false, message: "Admin access required." });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Admin session expired or invalid." });
  }
}

function makeReference() {
  return "CA" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);
}

router.post("/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const {
      firstName, lastName, email, mobile, address,
      room, parking, parkingOnly, checkIn, checkOut,
      adults, children, totalAmount, paymentStatus, notes, paymentReference
    } = req.body;

    if (!firstName || !lastName || !email || !mobile || !address) {
      return res.status(400).json({ success: false, message: "Guest name, email, mobile and address are required." });
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ success: false, message: "Invalid booking dates. Check-out must be after check-in." });
    }

    const normalizedAdults = Math.max(1, Number(adults || 1));
    const normalizedChildren = Math.max(0, Number(children || 0));
    if (normalizedAdults > 4) return res.status(400).json({ success: false, message: "Maximum occupancy is 4 adults." });

    if (!parkingOnly && !room) return res.status(400).json({ success: false, message: "Select an accommodation or choose Parking Only." });

    if (room) {
      const roomExists = await Room.findById(room).lean();
      if (!roomExists) return res.status(400).json({ success: false, message: "Selected accommodation was not found." });
      const conflict = await Booking.findOne({
        room,
        bookingStatus: { $nin: TERMINAL_STATUSES },
        checkIn: { $lt: endDate },
        checkOut: { $gt: startDate }
      }).lean();
      if (conflict) return res.status(409).json({ success: false, message: `The selected accommodation is already booked for these dates (${conflict.bookingReference}).` });
    }

    if (parking) {
      const requested = await Parking.findById(parking).lean();
      if (!requested) return res.status(400).json({ success: false, message: "Selected parking slot was not found." });
      const overlaps = await Booking.find({
        parking: { $ne: null },
        bookingStatus: { $nin: TERMINAL_STATUSES },
        checkIn: { $lt: endDate },
        checkOut: { $gt: startDate }
      }).populate("parking").lean();
      const conflict = overlaps.find(b => String(b.parking?._id) === String(requested._id));
      if (conflict) return res.status(409).json({ success: false, message: `The selected parking slot is already reserved (${conflict.bookingReference}).` });
    }

    const amount = Number(totalAmount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, message: "Enter a valid total amount." });

    const booking = new Booking({
      bookingReference: makeReference(),
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      mobile: String(mobile).trim(),
      address: String(address).trim(),
      room: parkingOnly ? null : room || null,
      parking: parking || null,
      parkingOnly: Boolean(parkingOnly),
      checkIn: startDate,
      checkOut: endDate,
      adults: normalizedAdults,
      children: normalizedChildren,
      totalAmount: amount,
      paymentStatus: paymentStatus || "Pending",
      bookingStatus: "Reserved",
      housekeepingStatus: "Clean",
      notes: notes || "",
      paymentReference: paymentReference || "",
      paymentDate: paymentStatus === "Paid" ? new Date() : null,
      paymentDeadline: null
    });

    await booking.save();
    const saved = await Booking.findById(booking._id).populate("room").populate("parking");
    res.status(201).json({ success: true, message: "Guest booking created successfully.", data: saved });
  } catch (err) {
    console.error("ADMIN CREATE BOOKING ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
