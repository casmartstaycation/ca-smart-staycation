const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Voucher = require("../models/Voucher");

const router = express.Router();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (ADMIN_PASSWORD ? crypto.createHash("sha256").update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest("hex") : "");

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

function generateCode() {
  return `CA${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function nightsBetween(a, b) {
  const start = new Date(a), end = new Date(b);
  if (!a || !b || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end - start) / 86400000));
}

function normalizeScope(value) {
  return String(value || "").toLowerCase() === "parking" ? "parking" : "booking";
}

function publicVoucher(voucher) {
  return {
    code: voucher.code,
    discountPercent: voucher.discountPercent,
    discountScope: normalizeScope(voucher.discountScope),
    maxNights: voucher.maxNights,
    specialGuestName: voucher.specialGuestName,
    certificateTitle: voucher.certificateTitle
  };
}

function validateParkingScope(voucher, hasParking) {
  if (normalizeScope(voucher.discountScope) === "parking" && !hasParking) {
    return "This voucher is for parking only. Please select a parking lot before applying it.";
  }
  return "";
}

router.get("/vouchers", requireAdmin, async (req, res) => {
  try {
    const data = await Voucher.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: data.map(v => ({ ...v, discountScope: normalizeScope(v.discountScope) })) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/vouchers", requireAdmin, async (req, res) => {
  try {
    const discountPercent = Number(req.body.discountPercent);
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      return res.status(400).json({ success: false, message: "Discount must be between 1% and 100%." });
    }

    const discountScope = normalizeScope(req.body.discountScope);
    let code = String(req.body.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!code) code = generateCode();
    if (await Voucher.findOne({ code })) return res.status(409).json({ success: false, message: "Voucher code already exists." });

    const usageLimit = Math.max(1, Number(req.body.usageLimit || 1));
    const maxNights = req.body.maxNights ? Math.max(1, Number(req.body.maxNights)) : null;
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return res.status(400).json({ success: false, message: "Invalid expiry date." });

    const defaultTitle = discountScope === "parking"
      ? (discountPercent === 100 ? "Free Parking Voucher" : "Parking Discount Voucher")
      : "Special Guest Voucher";

    const voucher = await Voucher.create({
      code,
      discountPercent,
      discountScope,
      usageLimit,
      maxNights,
      expiresAt,
      specialGuestName: String(req.body.specialGuestName || "").trim(),
      certificateTitle: String(req.body.certificateTitle || defaultTitle).trim(),
      createdBy: req.admin.email
    });

    res.status(201).json({ success: true, message: "Voucher generated successfully.", data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/vouchers/:id", requireAdmin, async (req, res) => {
  try {
    const update = { active: Boolean(req.body.active) };
    if (req.body.specialGuestName !== undefined) update.specialGuestName = String(req.body.specialGuestName || "").trim();
    if (req.body.certificateTitle !== undefined) update.certificateTitle = String(req.body.certificateTitle || "Special Guest Voucher").trim();
    const voucher = await Voucher.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found." });
    res.json({ success: true, data: voucher });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/vouchers/:id", requireAdmin, async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found." });
    res.json({ success: true, message: "Voucher deleted successfully.", data: { _id: voucher._id, code: voucher.code } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/vouchers/validate", async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: "Enter a voucher code." });

    const voucher = await Voucher.findOne({ code }).lean();
    if (!voucher || !voucher.active) return res.status(404).json({ success: false, message: "Invalid or inactive voucher code." });
    if (voucher.expiresAt && new Date(voucher.expiresAt) <= new Date()) return res.status(410).json({ success: false, message: "This voucher has expired." });
    if (voucher.usedCount >= voucher.usageLimit) return res.status(409).json({ success: false, message: "This voucher has reached its usage limit." });

    const parkingError = validateParkingScope(voucher, Boolean(req.body.hasParking));
    if (parkingError) return res.status(422).json({ success: false, message: parkingError });

    const nights = nightsBetween(req.body.checkIn, req.body.checkOut);
    if (voucher.maxNights && nights > voucher.maxNights) {
      return res.status(422).json({ success: false, message: `This voucher is valid for a maximum of ${voucher.maxNights} night${voucher.maxNights === 1 ? "" : "s"}. Your booking is ${nights} nights.` });
    }

    res.json({ success: true, data: publicVoucher(voucher) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/vouchers/redeem", async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: "Voucher code is required." });

    const current = await Voucher.findOne({ code, active: true }).lean();
    if (!current) return res.status(404).json({ success: false, message: "Voucher not found or inactive." });
    if (current.expiresAt && new Date(current.expiresAt) <= new Date()) return res.status(410).json({ success: false, message: "This voucher has expired." });

    const parkingError = validateParkingScope(current, Boolean(req.body.hasParking));
    if (parkingError) return res.status(422).json({ success: false, message: parkingError });

    const nights = nightsBetween(req.body.checkIn, req.body.checkOut);
    if (current.maxNights && nights > current.maxNights) {
      return res.status(422).json({ success: false, message: `This voucher is valid for a maximum of ${current.maxNights} night${current.maxNights === 1 ? "" : "s"}.` });
    }

    const voucher = await Voucher.findOneAndUpdate(
      { code, active: true, usedCount: { $lt: current.usageLimit } },
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    if (!voucher) return res.status(409).json({ success: false, message: "Voucher is no longer available." });

    res.json({ success: true, data: { ...publicVoucher(voucher), usedCount: voucher.usedCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
