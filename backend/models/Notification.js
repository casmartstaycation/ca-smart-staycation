const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipientType: { type: String, enum: ["guest", "admin"], required: true },
  recipientEmail: { type: String, default: "" },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: "general" },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
