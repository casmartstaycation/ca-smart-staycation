const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  data: { type: String, required: true }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  guestEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  senderType: { type: String, enum: ["guest", "admin"], required: true },
  senderName: { type: String, default: "" },
  message: { type: String, default: "", trim: true },
  attachments: { type: [attachmentSchema], default: [] },
  readByGuest: { type: Boolean, default: false },
  readByAdmin: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
