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

// Guest dashboard/login payload: intentionally excludes large document/history fields.
async function lightweightBookingsForEmail(email) {
  return Booking.find({ email: String(email || "").trim().toLowerCase() })
    .select("_id bookingReference firstName lastName email mobile bookingType room parking parkingOnly checkIn checkOut adults children totalAmount paymentStatus bookingStatus housekeepingStatus paymentProof paymentProofSubmittedAt paymentDate refundStatus refundAmount refundFee refundPolicyRule cancellationRequestedAt cancellationReason createdAt updatedAt")
    .populate({ path: "room", select: "_id unitNumber unitName category capacity price weekendPrice holidayPrice status images description" })
    .populate({ path: "parking", select: "_id parkingNumber parkingName status" })
    .sort({ createdAt: -1 })
    .lean();
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

    const token = jwt.sign(
      { accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    const bookings = await lightweightBookingsForEmail(account.email);
    res.json({ success: true, message: "Login successful.", token, account: publicAccount(account), bookings });
  } catch (err) {
    console.error("GUEST FAST LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/guest-auth/me", async (req, res) => {
  try {
    const payload = verifyToken(req);
    const account = await GuestAccount.findById(payload.accountId).lean();
    if (!account) return res.status(401).json({ success: false, message: "Account not found." });
    const bookings = await lightweightBookingsForEmail(account.email);
    res.json({ success: true, account: publicAccount(account), bookings });
  } catch (err) {
    res.status(401).json({ success: false, message: "Session expired or invalid." });
  }
});

module.exports = router;
