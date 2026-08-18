const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const GuestAccount = require("../models/GuestAccount");
const Booking = require("../models/Booking");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
function getToken(req) { const header = req.headers.authorization || ""; return header.startsWith("Bearer ") ? header.slice(7) : ""; }
function verifyToken(req) { const token = getToken(req); if (!token) throw new Error("Authentication required."); return jwt.verify(token, JWT_SECRET); }
function publicAccount(account) { return { id: account._id, email: account.email, bookingReference: account.bookingReference, mustChangePassword: account.defaultPassword === true }; }
async function lightweightBookingsForEmail(email) { return Booking.find({ email: String(email || "").trim().toLowerCase() }).select("_id bookingReference firstName lastName email mobile bookingType room parking parkingOnly checkIn checkOut adults children totalAmount paymentStatus bookingStatus housekeepingStatus paymentProof paymentProofSubmittedAt paymentDate refundStatus refundAmount refundFee refundPolicyRule cancellationRequestedAt cancellationReason createdAt updatedAt").populate({ path: "room", select: "_id unitNumber unitName category capacity price weekendPrice holidayPrice status" }).populate({ path: "parking", select: "_id parkingNumber parkingName status" }).sort({ createdAt: -1 }).lean(); }

router.post("/guest-auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });

    // Check every account for this email, not only the newest record. This is
    // important when duplicate/legacy GuestAccount documents exist.
    const accounts = await GuestAccount.find({ email }).sort({ createdAt: -1 });
    let matchedAccount = null;
    for (const candidate of accounts) {
      if (candidate.passwordHash && await bcrypt.compare(password, candidate.passwordHash)) {
        matchedAccount = candidate;
        break;
      }
    }
    if (matchedAccount) {
      matchedAccount.lastLoginAt = new Date();
      await matchedAccount.save();
      const token = jwt.sign({ accountId: matchedAccount._id.toString(), email: matchedAccount.email, bookingReference: matchedAccount.bookingReference }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({ success: true, message: "Login successful.", token, account: publicAccount(matchedAccount), bookings: await lightweightBookingsForEmail(matchedAccount.email) });
    }

    // Legacy/default credential fallback: allow the booking reference only for
    // an account that is still marked as using its default password.
    const normalizedRef = password.toUpperCase();
    const bookings = await Booking.find({ email }).select("_id bookingReference email").sort({ createdAt: -1 }).lean();
    const bookingForPassword = bookings.find(b => String(b.bookingReference || "").trim().toUpperCase() === normalizedRef);
    if (bookingForPassword) {
      let account = await GuestAccount.findOne({ bookingReference: bookingForPassword.bookingReference });
      if (!account) {
        account = await GuestAccount.create({ guest: null, bookingReference: bookingForPassword.bookingReference, email, passwordHash: await bcrypt.hash(password, 12), defaultPassword: true });
      } else if (account.defaultPassword === true) {
        account.email = email;
        account.passwordHash = await bcrypt.hash(password, 12);
        await account.save();
      }
      if (account.defaultPassword === true && await bcrypt.compare(password, account.passwordHash)) {
        account.lastLoginAt = new Date();
        await account.save();
        const token = jwt.sign({ accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" });
        return res.json({ success: true, message: "Login successful.", token, account: publicAccount(account), bookings: await lightweightBookingsForEmail(account.email) });
      }
    }
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  } catch (err) { console.error("GUEST FAST LOGIN ERROR:", err); return res.status(500).json({ success: false, message: err.message }); }
});

router.get("/guest-auth/me", async (req, res) => { try { const payload = verifyToken(req); const account = await GuestAccount.findById(payload.accountId).select("_id email bookingReference defaultPassword").lean(); if (!account) return res.status(401).json({ success: false, message: "Account not found." }); res.json({ success: true, account: publicAccount(account), bookings: await lightweightBookingsForEmail(account.email) }); } catch (err) { res.status(401).json({ success: false, message: "Session expired or invalid." }); } });
router.put("/guest-auth/account/email", async (req, res) => { try { const payload = verifyToken(req); const password = String(req.body.password || "").trim(); const email = String(req.body.email || "").trim().toLowerCase(); if (!password || !email) return res.status(400).json({ success: false, message: "New email and current password are required." }); const account = await GuestAccount.findById(payload.accountId); if (!account) return res.status(404).json({ success: false, message: "Account not found." }); if (!(await bcrypt.compare(password, account.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." }); const existing = await GuestAccount.findOne({ email, _id: { $ne: account._id } }).select("_id").lean(); if (existing) return res.status(409).json({ success: false, message: "That email is already registered to another guest account." }); const oldEmail = String(account.email).trim().toLowerCase(); account.email = email; await account.save(); if (oldEmail !== email) await Booking.updateMany({ email: oldEmail }, { $set: { email } }); const token = jwt.sign({ accountId: account._id.toString(), email, bookingReference: account.bookingReference }, JWT_SECRET, { expiresIn: "30d" }); res.json({ success: true, message: "Email updated successfully.", token, account: publicAccount(account) }); } catch (err) { res.status(400).json({ success: false, message: err.message || "Unable to update email." }); } });
router.put("/guest-auth/account/password", async (req, res) => { try { const payload = verifyToken(req); const currentPassword = String(req.body.currentPassword || "").trim(); const newPassword = String(req.body.newPassword || "").trim(); if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Current and new passwords are required." }); if (newPassword.length < 8) return res.status(400).json({ success: false, message: "New password must be at least 8 characters." }); const account = await GuestAccount.findById(payload.accountId); if (!account) return res.status(404).json({ success: false, message: "Account not found." }); if (!(await bcrypt.compare(currentPassword, account.passwordHash))) return res.status(401).json({ success: false, message: "Current password is incorrect." }); account.passwordHash = await bcrypt.hash(newPassword, 12); account.defaultPassword = false; account.lastPasswordChangeAt = new Date(); await account.save(); res.json({ success: true, message: "Password changed successfully.", account: publicAccount(account) }); } catch (err) { res.status(400).json({ success: false, message: err.message || "Unable to change password." }); } });

module.exports = router;
