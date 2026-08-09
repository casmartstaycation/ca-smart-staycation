const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const GuestAccount = require("../models/GuestAccount");
const Booking = require("../models/Booking");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";

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
  return {
    id: account._id,
    email: account.email,
    bookingReference: account.bookingReference,
    mustChangePassword: account.defaultPassword === true
  };
}

router.post("/guest-auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });

    const accounts = await GuestAccount.find({ email }).sort({ createdAt: -1 });
    let account = null;
    for (const candidate of accounts) {
      if (await bcrypt.compare(password, candidate.passwordHash)) {
        account = candidate;
        break;
      }
    }

    if (!account) return res.status(401).json({ success: false, message: "Invalid email or password." });

    account.lastLoginAt = new Date();
    await account.save();

    const token = jwt.sign({ accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" });
    const bookings = await Booking.find({ bookingReference: account.bookingReference }).populate("room").populate("parking").lean();

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

router.get("/guest-auth/me", async (req, res) => {
  try {
    const payload = verifyToken(req);
    const account = await GuestAccount.findById(payload.accountId).lean();
    if (!account) return res.status(401).json({ success: false, message: "Account not found." });

    const bookings = await Booking.find({ bookingReference: account.bookingReference }).populate("room").populate("parking").lean();
    res.json({ success: true, account: publicAccount(account), bookings });
  } catch (err) {
    res.status(401).json({ success: false, message: "Session expired or invalid." });
  }
});

module.exports = router;
