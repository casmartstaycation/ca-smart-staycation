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
    if (payload.role !== "admin" || String(payload.email || "").toLowerCase() !== String(ADMIN_EMAIL).toLowerCase()) return res.status(403).json({ success: false, message: "Admin access required." });
    req.admin = payload;
    next();
  } catch (err) { return res.status(401).json({ success: false, message: "Admin session expired or invalid." }); }
}

function generateCode() {
  return `CA${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

router.get("/vouchers", requireAdmin, async (req, res) => {
  try { const vouchers = await Voucher.find().sort({ createdAt: -1 }).lean(); res.json({ success: true, data: vouchers }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post("/vouchers", requireAdmin, async (req, res) => {
  try {
    const discountPercent = Number(req.body.discountPercent);
    if (![10, 20, 50, 100].includes(discountPercent)) return res.status(400).json({ success: false, message: "Discount must be 10%, 20%, 50%, or 100%." });
    let code = String(req.body.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!code) code = generateCode();
    const exists = await Voucher.findOne({ code });
    if (exists) return res.status(409).json({ success: false, message: "Voucher code already exists." });
    const usageLimit = Math.max(1, Number(req.body.usageLimit || 1));
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return res.status(400).json({ success: false, message: "Invalid expiry date." });
    const voucher = await Voucher.create({ code, discountPercent, usageLimit, expiresAt, createdBy: req.admin.email });
    res.status(201).json({ success: true, message: "Voucher generated successfully.", data: voucher });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put("/vouchers/:id", requireAdmin, async (req, res) => {
  try { const voucher = await Voucher.findByIdAndUpdate(req.params.id, { active: Boolean(req.body.active) }, { new: true }); if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found." }); res.json({ success: true, data: voucher }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post("/vouchers/validate", async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: "Enter a voucher code." });
    const voucher = await Voucher.findOne({ code }).lean();
    if (!voucher || !voucher.active) return res.status(404).json({ success: false, message: "Invalid or inactive voucher code." });
    if (voucher.expiresAt && new Date(voucher.expiresAt) <= new Date()) return res.status(410).json({ success: false, message: "This voucher has expired." });
    if (voucher.usedCount >= voucher.usageLimit) return res.status(409).json({ success: false, message: "This voucher has reached its usage limit." });
    res.json({ success: true, data: { code: voucher.code, discountPercent: voucher.discountPercent } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
