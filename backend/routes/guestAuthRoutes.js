const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const GuestAccount = require("../models/GuestAccount");
const Booking = require("../models/Booking");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";

router.post("/guest-auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const account = await GuestAccount.findOne({ email });
    if (!account) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    account.lastLoginAt = new Date();
    await account.save();

    const token = jwt.sign({ accountId: account._id.toString(), email: account.email }, JWT_SECRET, { expiresIn: "30d" });
    const bookings = await Booking.find({ email }).populate("room").populate("parking").sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      message: "Login successful.",
      token,
      account: { id: account._id, email: account.email, defaultPassword: account.defaultPassword },
      bookings
    });
  } catch (err) {
    console.error("GUEST LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/guest-auth/me", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ success: false, message: "Authentication required." });

    const payload = jwt.verify(token, JWT_SECRET);
    const account = await GuestAccount.findById(payload.accountId).lean();
    if (!account) return res.status(401).json({ success: false, message: "Account not found." });

    const bookings = await Booking.find({ email: account.email }).populate("room").populate("parking").sort({ createdAt: -1 }).lean();
    res.json({ success: true, account: { id: account._id, email: account.email, defaultPassword: account.defaultPassword }, bookings });
  } catch (err) {
    res.status(401).json({ success: false, message: "Session expired or invalid." });
  }
});

module.exports = router;
