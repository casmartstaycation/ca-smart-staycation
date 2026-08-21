const mongoose = require("mongoose");
const GuestAccount = require("./GuestAccount");
const Setting = require("./Setting");

const bookingSchema = new mongoose.Schema({
  bookingReference: { type: String, required: true, unique: true },
  firstName: { type: String, required: true }, lastName: { type: String, required: true }, email: { type: String, required: true }, mobile: { type: String, required: true }, address: { type: String, required: true },
  governmentId: { type: String, default: "" }, driversLicense: { type: String, default: "" }, vehicleBrand: { type: String, default: "" }, vehicleModel: { type: String, default: "" }, vehicleColor: { type: String, default: "" }, plateNumber: { type: String, default: "" },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null }, checkIn: { type: Date, required: true }, checkOut: { type: Date, required: true }, adults: { type: Number, default: 1 }, children: { type: Number, default: 0 },
  subtotalAmount: { type: Number, default: 0 }, voucherCode: { type: String, default: "" }, voucherDiscountPercent: { type: Number, min: 0, max: 100, default: 0 }, voucherDiscountScope: { type: String, enum: ["booking", "parking"], default: "booking" }, voucherDiscountAmount: { type: Number, default: 0 }, voucherMaxNights: { type: Number, default: null }, complimentaryNonCancellable: { type: Boolean, default: false },
  totalAmount: { type: Number, required: true }, paymentStatus: { type: String, enum: ["Pending", "Partial", "Paid", "Refunded"], default: "Pending" }, bookingStatus: { type: String, enum: ["Waiting for Payment", "Reserved", "Pending Payment Verification", "Payment Rejected", "Checked In", "Checked Out", "Cancelled", "Expired"], default: "Waiting for Payment" }, housekeepingStatus: { type: String, enum: ["Clean", "Needs Cleaning"], default: "Clean" }, parkingOnly: { type: Boolean, default: false }, parking: { type: mongoose.Schema.Types.ObjectId, ref: "Parking", default: null }, notes: { type: String, default: "" }, paymentProof: { type: String, default: "" },
  paymentProofHistory: [{ filename: { type: String, required: true }, rejectedAt: { type: Date, default: Date.now }, rejectionReason: { type: String, default: "" } }], paymentDate: { type: Date, default: null }, paymentReference: { type: String, default: "" }, paymentRejectionReason: { type: String, default: "" }, paymentDeadline: { type: Date, default: null }, paymentProofSubmittedAt: { type: Date, default: null }, paymentVerifiedAt: { type: Date, default: null }, cancellationRequestedAt: { type: Date, default: null }, cancellationReason: { type: String, default: "" }, refundRequested: { type: Boolean, default: false }, refundRequestedAt: { type: Date, default: null }, refundAmount: { type: Number, default: 0 }, refundFee: { type: Number, default: 0 }, refundPolicyRule: { type: String, default: "" }, refundStatus: { type: String, enum: ["Not Requested", "Requested", "Processing", "Refunded", "Not Eligible"], default: "Not Requested" }, refundProcessedAt: { type: Date, default: null }, refundProcessedBy: { type: String, default: "" }, rescheduleHistory: [{ previousCheckIn: { type: Date }, previousCheckOut: { type: Date }, newCheckIn: { type: Date }, newCheckOut: { type: Date }, changedAt: { type: Date, default: Date.now }, policyRule: { type: String, default: "" }, inconvenienceFee: { type: Number, default: 0 }, refundAmount: { type: Number, default: 0 } }], reschedulePending: { type: Boolean, default: false }, reschedulePendingCheckIn: { type: Date, default: null }, reschedulePendingCheckOut: { type: Date, default: null }, rescheduleFee: { type: Number, default: 0 }, reschedulePolicyRule: { type: String, default: "" }, rescheduleRefundAmount: { type: Number, default: 0 }, rescheduleRequestedAt: { type: Date, default: null }, reschedulePaymentProof: { type: String, default: "" }, reschedulePaymentSubmittedAt: { type: Date, default: null }, reschedulePaymentStatus: { type: String, enum: ["Not Required", "Pending Verification", "Verified", "Rejected"], default: "Not Required" },
  extraRequests: [{
    type: { type: String, enum: ["extra_guest", "extra_set"], required: true },
    quantity: { type: Number, min: 1, max: 2, required: true },
    nightlyRate: { type: Number, default: 300 },
    nights: { type: Number, min: 1, default: 1 },
    amount: { type: Number, min: 0, default: 0 },
    paymentProof: { type: String, default: "" },
    paymentProofFileName: { type: String, default: "" },
    paymentSubmittedAt: { type: Date, default: null },
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Paid"], default: "Pending" },
    requestedAt: { type: Date, default: Date.now },
    adminNote: { type: String, default: "" }
  }],
  lastStatusNotificationKey: { type: String, default: "" },
  lastGuestEmailNotificationKey: { type: String, default: "" },
  lastAdminEmailNotificationKey: { type: String, default: "" }
}, { timestamps: true });

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ email: 1, createdAt: -1 });
bookingSchema.index({ checkIn: 1, checkOut: 1, bookingStatus: 1 });
bookingSchema.index({ paymentDeadline: 1, bookingStatus: 1 });

bookingSchema.pre("validate", function(next) {
  if (typeof this.email === "string") this.email = this.email.trim().toLowerCase();
  const voucherScope = String(this.voucherDiscountScope || "booking").toLowerCase() === "parking" ? "parking" : "booking";
  if (voucherScope === "booking" && Number(this.voucherDiscountPercent || 0) === 100) this.complimentaryNonCancellable = true;
  if (voucherScope === "parking") this.complimentaryNonCancellable = false;
  if (this.bookingStatus === "Cancelled" && this.complimentaryNonCancellable) return next(new Error("Bookings using a 100% complimentary voucher cannot be cancelled."));
  next();
});

bookingSchema.pre("validate", async function() {
  if (!this.room || this.parkingOnly) return;
  if (!(this.isNew || this.isModified("checkIn") || this.isModified("checkOut"))) return;
  const start = new Date(this.checkIn), end = new Date(this.checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return;
  const settings = await Setting.findOne().select("blockedDates").lean();
  const blocked = new Set((settings?.blockedDates || []).map(item => String(item?.date || "").trim()).filter(Boolean));
  if (!blocked.size) return;
  let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (cursor < endDay) {
    const date = new Date(cursor);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    if (blocked.has(key)) throw new Error(`Selected date ${key} is unavailable because the unit is blocked by the admin.`);
    cursor += 86400000;
  }
});

bookingSchema.pre(/^find/, async function(next) {
  try {
    const query = this.getQuery();
    if (typeof query.email === "string" && query.email) {
      const normalizedEmail = query.email.trim().toLowerCase();
      const escaped = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const emailRegex = new RegExp(`^${escaped}$`, "i");
      const guestAccount = await GuestAccount.findOne({ email: normalizedEmail }).select("bookingReference").lean();
      const bookingReference = String(guestAccount?.bookingReference || "").trim();
      if (bookingReference && !query.$or) {
        const withoutEmail = { ...query }; delete withoutEmail.email;
        this.setQuery({ ...withoutEmail, $or: [{ email: emailRegex }, { bookingReference }] });
      } else this.setQuery({ ...query, email: emailRegex });
    }
    next();
  } catch (err) { next(err); }
});

module.exports = mongoose.model("Booking", bookingSchema);
