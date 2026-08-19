const mongoose = require("mongoose");

const bookingCompanionSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 160 },
  idFile: { type: String, required: true },
  idFileName: { type: String, default: "" },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

bookingCompanionSchema.index({ booking: 1, createdAt: 1 });

module.exports = mongoose.model("BookingCompanion", bookingCompanionSchema);
