const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const sendEmail = require("../mail/sendEmail");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "markryantamayo@gmail.com";
const LOGIN_URL = process.env.GUEST_LOGIN_URL || "https://casmartstaycation.github.io/cassbooking/guest-booking/guest-login.html";

function statusKey(booking) {
  return [booking.bookingStatus || "", booking.paymentStatus || "", booking.refundStatus || ""].join("|");
}

function statusMessage(booking) {
  const status = booking.bookingStatus || "Updated";
  const payment = booking.paymentStatus || "Pending";
  if (status === "Reserved" && payment === "Paid") return { title: "Booking Confirmed", message: `Your payment has been approved and booking ${booking.bookingReference} is confirmed.`, type: "booking-confirmed" };
  if (status === "Payment Rejected") return { title: "Payment Proof Rejected", message: `Payment proof for booking ${booking.bookingReference} was rejected. Please log in and upload a new proof of payment.`, type: "payment-rejected" };
  if (status === "Cancelled") return { title: "Booking Cancelled", message: `Booking ${booking.bookingReference} has been cancelled.`, type: "booking-cancelled" };
  if (status === "Expired") return { title: "Booking Expired", message: `Booking ${booking.bookingReference} has expired because payment was not completed within the required period.`, type: "booking-expired" };
  if (status === "Checked In") return { title: "Guest Checked In", message: `Booking ${booking.bookingReference} has been checked in.`, type: "booking-status" };
  if (status === "Checked Out") return { title: "Guest Checked Out", message: `Booking ${booking.bookingReference} has been checked out.`, type: "booking-status" };
  return { title: "Booking Status Updated", message: `Booking ${booking.bookingReference} status changed to ${status}. Payment status: ${payment}.`, type: "booking-status" };
}

async function processBookingStatusNotifications() {
  const bookings = await Booking.find().select("bookingReference firstName lastName email bookingStatus paymentStatus refundStatus checkIn checkOut totalAmount lastStatusNotificationKey").lean();
  for (const booking of bookings) {
    const key = statusKey(booking);
    if (!booking.lastStatusNotificationKey) {
      await Booking.updateOne({ _id: booking._id }, { $set: { lastStatusNotificationKey: key } });
      continue;
    }
    if (booking.lastStatusNotificationKey === key) continue;

    const info = statusMessage(booking);
    const guestEmail = String(booking.email || "").trim().toLowerCase();
    const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
    const adminMessage = `${booking.bookingReference} — ${guestName}: ${info.message}`;

    if (guestEmail) {
      await Notification.create({ recipientType: "guest", recipientEmail: guestEmail, booking: booking._id, title: info.title, message: info.message, type: info.type });
      await sendEmail(guestEmail, `${info.title} — ${booking.bookingReference}`, `<h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>${info.message}</p><p><strong>Booking Reference:</strong> ${booking.bookingReference}<br><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString("en-PH")}<br><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString("en-PH")}<br><strong>Total:</strong> ₱${Number(booking.totalAmount || 0).toLocaleString("en-PH")}</p><p><a href="${LOGIN_URL}">Open Guest Account</a></p>`);
    }

    if (ADMIN_EMAIL) {
      await Notification.create({ recipientType: "admin", recipientEmail: ADMIN_EMAIL, booking: booking._id, title: `Booking Update — ${booking.bookingReference}`, message: adminMessage, type: info.type });
      await sendEmail(ADMIN_EMAIL, `Booking Status Update — ${booking.bookingReference}`, `<h2>CA Smart Staycation Admin Notification</h2><p>${adminMessage}</p><p><strong>Booking Status:</strong> ${booking.bookingStatus}<br><strong>Payment Status:</strong> ${booking.paymentStatus}<br><strong>Refund Status:</strong> ${booking.refundStatus || "Not Requested"}</p>`);
    }

    await Booking.updateOne({ _id: booking._id }, { $set: { lastStatusNotificationKey: key } });
  }
}

module.exports = { processBookingStatusNotifications };
