const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Parking = require("../models/Parking");
const GuestAccount = require("../models/GuestAccount");
const bcrypt = require("bcryptjs");
const sendEmail = require("../mail/sendEmail");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads/payments");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination(req, file, cb) { cb(null, uploadDir); },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});

const upload = multer({ storage });
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "https://ca-smart-staycation-muqd.onrender.com/api";

function money(value) {
    return `₱${Number(value || 0).toLocaleString("en-PH")}`;
}

function dateText(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

async function ensureGuestAccount(booking) {
    if (!booking.email || !booking.bookingReference) return null;

    const email = String(booking.email).trim().toLowerCase();
    const defaultPassword = String(booking.bookingReference).trim();
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    let account = await GuestAccount.findOne({ bookingReference: booking.bookingReference });

    if (!account) {
        account = await GuestAccount.create({
            guest: null,
            bookingReference: booking.bookingReference,
            email,
            passwordHash,
            defaultPassword: true
        });
    } else {
        account.email = email;
        account.passwordHash = passwordHash;
        account.defaultPassword = true;
        await account.save();
    }

    return account;
}

async function notifyBookingPaymentSubmitted(booking, account) {
    const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
    const subject = `Payment Proof Received — ${booking.bookingReference}`;
    const proofUrl = booking.paymentProof ? `${API_PUBLIC_URL}/uploads/payments/${encodeURIComponent(booking.paymentProof)}` : "";
    const loginUrl = process.env.GUEST_LOGIN_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/guest-login.html";

    const guestHtml = `
        <h2>CA Smart Staycation</h2>
        <p>Dear ${guestName},</p>
        <p>We received your payment proof for booking <strong>${booking.bookingReference}</strong>.</p>
        <p>Your booking is now <strong>Pending Payment Verification</strong>. Our admin will review your uploaded proof.</p>
        <h3>Your Guest Account</h3>
        <p>An account has automatically been created for you.</p>
        <p><strong>Login email:</strong> ${account?.email || booking.email}<br>
        <strong>Default password:</strong> ${booking.bookingReference}</p>
        <p>Use your booking reference as your default password. You can log in to the CA Smart Staycation web/app using the email address you used when booking.</p>
        <p><a href="${loginUrl}">Login to CA Smart Staycation</a></p>
        <p><strong>Booking Reference:</strong> ${booking.bookingReference}<br>
        <strong>Check-in:</strong> ${dateText(booking.checkIn)}<br>
        <strong>Check-out:</strong> ${dateText(booking.checkOut)}<br>
        <strong>Total:</strong> ${money(booking.totalAmount)}</p>
        <p>You will receive another email when your payment has been verified and your booking is confirmed.</p>
        <p>CA Smart Staycation</p>`;

    const adminHtml = `
        <h2>New Payment Proof Requires Verification</h2>
        <p>A guest has uploaded payment proof and the booking is waiting for admin verification.</p>
        <p><strong>Booking Reference:</strong> ${booking.bookingReference}<br>
        <strong>Guest:</strong> ${guestName}<br>
        <strong>Email:</strong> ${booking.email}<br>
        <strong>Mobile:</strong> ${booking.mobile}<br>
        <strong>Check-in:</strong> ${dateText(booking.checkIn)}<br>
        <strong>Check-out:</strong> ${dateText(booking.checkOut)}<br>
        <strong>Total:</strong> ${money(booking.totalAmount)}</p>
        ${proofUrl ? `<p><a href="${proofUrl}">View uploaded payment proof</a></p>` : ""}
        <p><strong>Action required:</strong> Review the proof in the admin booking panel and approve or reject the payment.</p>`;

    const jobs = [];
    if (booking.email) jobs.push(sendEmail(booking.email, subject, guestHtml));
    if (ADMIN_EMAIL) jobs.push(sendEmail(ADMIN_EMAIL, `Payment Verification Required — ${booking.bookingReference}`, adminHtml));
    await Promise.allSettled(jobs);
}

async function notifyBookingConfirmed(booking) {
    if (!booking.email) return;
    const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
    const loginUrl = process.env.GUEST_LOGIN_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/guest-login.html";
    const html = `
        <h2>CA Smart Staycation</h2>
        <p>Dear ${guestName},</p>
        <p>Your payment has been <strong>verified</strong> and your booking is now <strong>Confirmed</strong>.</p>
        <p><strong>Booking Reference:</strong> ${booking.bookingReference}<br>
        <strong>Check-in:</strong> ${dateText(booking.checkIn)}<br>
        <strong>Check-out:</strong> ${dateText(booking.checkOut)}<br>
        <strong>Total:</strong> ${money(booking.totalAmount)}</p>
        <p>You can log in to your guest account using your booking email and your booking reference as the default password.</p>
        <p><a href="${loginUrl}">Login to your guest account</a></p>
        <p>Thank you for choosing CA Smart Staycation.</p>`;
    await sendEmail(booking.email, `Booking Confirmed — ${booking.bookingReference}`, html);
}

router.get("/test", (req, res) => res.json({ status: "success", message: "Booking routes working" }));

router.get("/bookings", async (req, res) => {
    try {
        const bookings = await Booking.find().populate("room").populate("parking").sort({ createdAt: -1 });
        res.json({ success: true, data: bookings });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post("/bookings", async (req, res) => {
    try {
        const { room, parking, checkIn, checkOut } = req.body;
        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return res.status(400).json({ success: false, message: "Invalid booking dates. Check-out must be after check-in." });

        if (room) {
            const roomConflict = await Booking.findOne({ room, bookingStatus: { $nin: ["Cancelled", "Checked Out"] }, checkIn: { $lt: endDate }, checkOut: { $gt: startDate } });
            if (roomConflict) return res.status(400).json({ success: false, message: "Room already booked." });
        }

        if (parking) {
            const overlappingParkingBookings = await Booking.find({ parking: { $ne: null }, bookingStatus: { $nin: ["Cancelled", "Checked Out"] }, checkIn: { $lt: endDate }, checkOut: { $gt: startDate } }).populate("parking").lean();
            const requestedParking = await Parking.findById(parking).lean();
            const parkingConflict = overlappingParkingBookings.find(booking => {
                if (!booking.parking) return true;
                if (requestedParking?.parkingNumber && booking.parking?.parkingNumber) return String(booking.parking.parkingNumber).trim().toUpperCase() === String(requestedParking.parkingNumber).trim().toUpperCase();
                if (requestedParking?.parkingName && booking.parking?.parkingName) return String(booking.parking.parkingName).trim().toUpperCase() === String(requestedParking.parkingName).trim().toUpperCase();
                return true;
            });
            if (parkingConflict) return res.status(400).json({ success: false, message: "Parking slot already reserved." });
        }

        const bookingReference = "CA" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);
        const booking = new Booking({ ...req.body, bookingReference });
        await booking.save();
        res.status(201).json({ success: true, message: "Booking created.", data: booking });
    } catch (err) {
        console.error("CREATE BOOKING ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put("/bookings/:id", async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        res.json({ success: true, data: booking });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete("/bookings/:id", async (req, res) => {
    try {
        const booking = await Booking.findByIdAndDelete(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        res.json({ success: true, message: "Booking deleted." });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put("/bookings/:id/checkin", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        booking.bookingStatus = "Checked In";
        booking.housekeepingStatus = "Clean";
        await booking.save();
        if (booking.room) await Room.findByIdAndUpdate(booking.room, { status: "Occupied" });
        if (booking.parking) await Parking.findByIdAndUpdate(booking.parking, { status: "Occupied" });
        res.json({ success: true, message: "Guest checked in." });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put("/bookings/:id/checkout", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        booking.bookingStatus = "Checked Out";
        booking.housekeepingStatus = "Needs Cleaning";
        await booking.save();
        if (booking.room) await Room.findByIdAndUpdate(booking.room, { status: "Needs Cleaning" });
        if (booking.parking) await Parking.findByIdAndUpdate(booking.parking, { status: "Available" });
        res.json({ success: true, message: "Guest checked out." });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put("/bookings/:id/clean", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        booking.housekeepingStatus = "Clean";
        await booking.save();
        if (booking.room) await Room.findByIdAndUpdate(booking.room, { status: "Available" });
        if (booking.parking) await Parking.findByIdAndUpdate(booking.parking, { status: "Available" });
        res.json({ success: true, message: "Room cleaned." });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post("/bookings/:id/payment", upload.single("paymentProof"), async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        if (!req.file) return res.status(400).json({ success: false, message: "No payment proof uploaded." });

        booking.paymentProof = req.file.filename;
        booking.paymentDate = new Date();
        booking.paymentStatus = "Pending";
        booking.bookingStatus = "Pending Payment Verification";
        await booking.save();

        let account = null;
        try {
            account = await ensureGuestAccount(booking);
        } catch (accountErr) {
            console.error("GUEST ACCOUNT CREATION ERROR:", accountErr);
        }

        try {
            await notifyBookingPaymentSubmitted(booking, account);
        } catch (emailErr) {
            console.error("PAYMENT NOTIFICATION EMAIL ERROR:", emailErr);
        }

        res.json({ success: true, message: "Payment proof uploaded successfully. Guest account created and booking is waiting for admin verification.", data: booking, guestAccountCreated: Boolean(account) });
    } catch (err) {
        console.error("PAYMENT UPLOAD ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put("/bookings/:id/approve-payment", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        if (!booking.paymentProof) return res.status(400).json({ success: false, message: "Cannot confirm booking without payment proof." });
        booking.paymentStatus = "Paid";
        booking.bookingStatus = "Reserved";
        await booking.save();
        try { await notifyBookingConfirmed(booking); } catch (emailErr) { console.error("BOOKING CONFIRMATION EMAIL ERROR:", emailErr); }
        res.json({ success: true, message: "Payment approved and booking confirmed.", data: booking });
    } catch (err) {
        console.error("APPROVE PAYMENT ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put("/bookings/:id/reject-payment", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        booking.paymentStatus = "Pending";
        booking.bookingStatus = "Reserved";
        await booking.save();
        if (booking.email) {
            const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
            const loginUrl = process.env.GUEST_LOGIN_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/guest-login.html";
            const html = `<h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>We could not verify the payment proof submitted for booking <strong>${booking.bookingReference}</strong>.</p><p>Please submit valid payment proof. Your guest account remains available using your booking email and <strong>${booking.bookingReference}</strong> as the default password.</p><p><a href="${loginUrl}">Login to your guest account</a></p>`;
            try { await sendEmail(booking.email, `Payment Verification Update — ${booking.bookingReference}`, html); } catch (emailErr) { console.error("PAYMENT REJECTION EMAIL ERROR:", emailErr); }
        }
        res.json({ success: true, message: "Payment proof rejected. Guest has been notified.", data: booking });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
