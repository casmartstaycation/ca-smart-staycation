const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  discountPercent: { type: Number, required: true, min: 1, max: 100 },
  maxNights: { type: Number, default: null, min: 1 },
  active: { type: Boolean, default: true },
  usageLimit: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  specialGuestName: { type: String, default: "" },
  certificateTitle: { type: String, default: "Special Guest Voucher" },
  createdBy: { type: String, default: "admin" }
}, { timestamps: true });

module.exports = mongoose.model("Voucher", voucherSchema);
