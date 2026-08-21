const mongoose = require("mongoose");
const sendEmail = require("../mail/sendEmail");
const { getAdminContactContext, appendAdminContactToText } = require("../services/adminContact");

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "casmartstaycation@gmail.com").trim().toLowerCase();

// Booking-status notifications already have dedicated email delivery in
// bookingStatusNotifier.js. They are excluded here to prevent duplicate emails.
const DIRECT_EMAIL_TYPES = new Set([
  "booking-received",
  "booking-confirmed",
  "payment-rejected",
  "booking-cancelled",
  "booking-expired",
  "booking-status"
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const notificationSchema = new mongoose.Schema({
  recipientType: { type: String, enum: ["guest", "admin"], required: true },
  recipientEmail: { type: String, default: "" },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: "general" },
  read: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.pre("validate", async function addAdminContactToGuestMessage() {
  if (this.recipientType !== "guest") return;
  try {
    const { contact } = await getAdminContactContext();
    if (contact) this.message = appendAdminContactToText(this.message, contact);
  } catch (err) {
    console.error("GUEST NOTIFICATION ADMIN CONTACT ERROR:", err?.message || err);
  }
});

notificationSchema.post("save", function sendNotificationEmail(doc) {
  // Status emails are already handled by bookingStatusNotifier.js.
  if (DIRECT_EMAIL_TYPES.has(String(doc.type || ""))) return;

  const recipient = String(
    doc.recipientEmail || (doc.recipientType === "admin" ? ADMIN_EMAIL : "")
  ).trim().toLowerCase();
  if (!recipient) return;

  const title = escapeHtml(doc.title);
  const message = escapeHtml(doc.message).replace(/\n/g, "<br>");
  const audience = doc.recipientType === "admin" ? "Admin" : "Guest";

  // Email delivery must never make creation of an in-app notification fail.
  Promise.resolve()
    .then(() => sendEmail(
      recipient,
      `CA Smart Staycation — ${doc.title}`,
      `<!doctype html><html><body><h2>CA Smart Staycation</h2><p><strong>${title}</strong></p><p>${message}</p><p><small>This notification was sent to the ${audience} account.</small></p></body></html>`
    ))
    .then(() => console.log(`NOTIFICATION EMAIL SENT: ${doc.type || "general"} -> ${recipient}`))
    .catch(err => console.error(`NOTIFICATION EMAIL FAILED (${recipient}, ${doc.type || "general"}):`, err.message));
});

module.exports = mongoose.model("Notification", notificationSchema);
