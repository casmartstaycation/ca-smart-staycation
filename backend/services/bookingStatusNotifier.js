const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const Setting = require("../models/Setting");
const GuestAccount = require("../models/GuestAccount");
const bcrypt = require("bcryptjs");
const sendEmail = require("../mail/sendEmail");

const FALLBACK_ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "casmartstaycation@gmail.com";
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

async function getAdminNotificationEmail() {
  try {
    const settings = await Setting.findOne().select("adminNotificationEmail").lean();
    return String(settings?.adminNotificationEmail || FALLBACK_ADMIN_EMAIL).trim().toLowerCase();
  } catch (err) {
    console.error("ADMIN NOTIFICATION EMAIL LOOKUP ERROR:", err);
    return FALLBACK_ADMIN_EMAIL;
  }
}

async function ensureGuestAccount(booking) {
  if (!booking.email || !booking.bookingReference) return null;
  const email = String(booking.email).trim().toLowerCase();
  let account = await GuestAccount.findOne({ bookingReference: booking.bookingReference });
  if (!account) {
    const passwordHash = await bcrypt.hash(String(booking.bookingReference).trim(), 12);
    account = await GuestAccount.create({ guest: null, bookingReference: booking.bookingReference, email, passwordHash, defaultPassword: true });
  } else if (account.email !== email) {
    account.email = email;
    await account.save();
  }
  return account;
}

async function sendNewBookingEmail(booking) {
  if (!booking.email) return;
  const guestEmail = String(booking.email).trim().toLowerCase();
  const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
  const password = String(booking.bookingReference).trim();
  const html = `<h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>Your booking request has been received successfully.</p><h3>Guest Account</h3><p><strong>Login email:</strong> ${guestEmail}<br><strong>Temporary password:</strong> ${password}</p><p>Please change this temporary password after your first login.</p><p><strong>Booking Reference:</strong> ${booking.bookingReference}<br><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString("en-PH")}<br><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString("en-PH")}<br><strong>Total:</strong> ₱${Number(booking.totalAmount || 0).toLocaleString("en-PH")}</p><p>Your booking is currently <strong>${booking.bookingStatus || "Waiting for Payment"}</strong>. Please follow the payment instructions on the booking page.</p><p><a href="${LOGIN_URL}">Open Guest Account</a></p>`;
  await sendEmail(guestEmail, `Booking Received — ${booking.bookingReference}`, html);
}

async function sendGuestStatusEmail(booking, info) {
  const guestEmail = String(booking.email || "").trim().toLowerCase();
  if (!guestEmail) return;
  const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
  await sendEmail(guestEmail, `${info.title} — ${booking.bookingReference}`, `<h2>CA Smart Staycation</h2><p>Dear ${guestName},</p><p>${info.message}</p><p><strong>Booking Reference:</strong> ${booking.bookingReference}<br><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString("en-PH")}<br><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString("en-PH")}<br><strong>Total:</strong> ₱${Number(booking.totalAmount || 0).toLocaleString("en-PH")}</p><p><a href="${LOGIN_URL}">Open Guest Account</a></p>`);
}

async function sendAdminStatusEmail(booking, info, adminEmail) {
  if (!adminEmail) return;
  const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
  const adminMessage = `${booking.bookingReference} — ${guestName}: ${info.message}`;
  await sendEmail(adminEmail, `Booking Status Update — ${booking.bookingReference}`, `<h2>CA Smart Staycation Admin Notification</h2><p>${adminMessage}</p><p><strong>Booking Status:</strong> ${booking.bookingStatus}<br><strong>Payment Status:</strong> ${booking.paymentStatus}<br><strong>Refund Status:</strong> ${booking.refundStatus || "Not Requested"}<br><strong>Guest Email:</strong> ${booking.email || ""}</p>`);
}

async function processBookingStatusNotifications() {
  const adminEmail = await getAdminNotificationEmail();
  const bookings = await Booking.find().select("bookingReference firstName lastName email bookingStatus paymentStatus refundStatus checkIn checkOut totalAmount lastStatusNotificationKey lastGuestEmailNotificationKey lastAdminEmailNotificationKey").lean();

  for (const booking of bookings) {
    const key = statusKey(booking);
    const isNewBooking = !booking.lastStatusNotificationKey;
    const guestEmail = String(booking.email || "").trim().toLowerCase();

    // Web notifications are created once per status state.
    if (isNewBooking || booking.lastStatusNotificationKey !== key) {
      const info = isNewBooking ? { title: "Booking Received", message: `Your booking ${booking.bookingReference} has been received.`, type: "booking-received" } : statusMessage(booking);
      const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
      const adminMessage = `${booking.bookingReference} — ${guestName}: ${isNewBooking ? "New booking received." : info.message}`;

      if (guestEmail) await Notification.create({ recipientType: "guest", recipientEmail: guestEmail, booking: booking._id, title: info.title, message: info.message, type: info.type });
      if (adminEmail) await Notification.create({ recipientType: "admin", recipientEmail: adminEmail, booking: booking._id, title: isNewBooking ? `New Booking — ${booking.bookingReference}` : `Booking Update — ${booking.bookingReference}`, message: adminMessage, type: info.type });
      await Booking.updateOne({ _id: booking._id }, { $set: { lastStatusNotificationKey: key } });
    }

    // Email delivery is tracked independently, so SMTP failures are retried without duplicating web notifications.
    if (guestEmail && booking.lastGuestEmailNotificationKey !== key) {
      try {
        if (isNewBooking) {
          await ensureGuestAccount(booking);
          await sendNewBookingEmail(booking);
          console.log(`NEW BOOKING EMAIL SENT: ${booking.bookingReference} -> ${guestEmail}`);
        } else {
          const info = statusMessage(booking);
          await sendGuestStatusEmail(booking, info);
          console.log(`GUEST STATUS EMAIL SENT: ${booking.bookingReference} -> ${guestEmail} (${info.title})`);
        }
        await Booking.updateOne({ _id: booking._id }, { $set: { lastGuestEmailNotificationKey: key } });
      } catch (err) {
        console.error(`GUEST EMAIL FAILED (${guestEmail}, ${booking.bookingReference}, key=${key}):`, err.message);
      }
    }

    if (adminEmail && booking.lastAdminEmailNotificationKey !== key) {
      try {
        if (isNewBooking) {
          const guestName = `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Guest";
          const adminMessage = `${booking.bookingReference} — ${guestName}: New booking received from ${guestEmail || "no email"}.`;
          await sendEmail(adminEmail, `New Booking — ${booking.bookingReference}`, `<h2>CA Smart Staycation Admin Notification</h2><p>${adminMessage}</p><p><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString("en-PH")}<br><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString("en-PH")}<br><strong>Total:</strong> ₱${Number(booking.totalAmount || 0).toLocaleString("en-PH")}</p>`);
        } else {
          const info = statusMessage(booking);
          await sendAdminStatusEmail(booking, info, adminEmail);
          console.log(`ADMIN STATUS EMAIL SENT: ${booking.bookingReference} -> ${adminEmail} (${info.title})`);
        }
        await Booking.updateOne({ _id: booking._id }, { $set: { lastAdminEmailNotificationKey: key } });
      } catch (err) {
        console.error(`ADMIN EMAIL FAILED (${adminEmail}, ${booking.bookingReference}, key=${key}):`, err.message);
      }
    }
  }
}

module.exports = { processBookingStatusNotifications };
