const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const GuestAccount = require("../models/GuestAccount");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";

function publicAccount(account) {
  return {
    id: account._id,
    email: account.email,
    bookingReference: account.bookingReference,
    mustChangePassword: account.defaultPassword === true
  };
}

// Fast login: authenticate and return immediately. Booking data is loaded by the dashboard.
router.post("/guest-auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const account = await GuestAccount.findOne({ email }).sort({ createdAt: -1 }).lean();
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Do not wait for lastLoginAt or booking queries before responding.
    GuestAccount.updateOne({ _id: account._id }, { $set: { lastLoginAt: new Date() } }).catch(err => {
      console.error("FAST GUEST LAST LOGIN UPDATE ERROR:", err.message);
    });

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      account: publicAccount(account)
    });
  } catch (err) {
    console.error("FAST GUEST LOGIN ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
