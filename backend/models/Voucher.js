const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  discountPercent: { type: Number, required: true, enum: [10, 20, 50, 100] },
  active: { type: Boolean, default: true },
  usageLimit: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  createdBy: { type: String, default: "admin" }
}, { timestamps: true });

module.exports = mongoose.model("Voucher", voucherSchema);
