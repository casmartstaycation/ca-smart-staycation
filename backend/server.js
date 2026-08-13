require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const Booking = require("./models/Booking");
const Parking = require("./models/Parking");
const settingsRoutes = require("./routes/settingsRoutes");
const { processBookingStatusNotifications } = require("./services/bookingStatusNotifier");

const paymentUploadDir = path.join(__dirname, 'uploads/payments');
const guestDocumentUploadDir = path.join(__dirname, 'uploads/guest-documents');

function deleteUploadedFile(dir, filename) {
  if (!filename) return;
  const safeName = path.basename(String(filename));
  const filePath = path.join(dir, safeName);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  catch (err) { console.error(`UPLOAD CLEANUP ERROR (${safeName}):`, err.message); }
}
function listFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name);
  } catch (err) { console.error(`UPLOAD DIRECTORY SCAN ERROR (${dir}):`, err.message); return []; }
}

async function cleanupTerminalBookingUploads() {
  try {
    const bookings = await Booking.find({}).select("_id bookingStatus paymentProof paymentProofHistory governmentId driversLicense reschedulePaymentProof").lean();
    const terminalStatuses = new Set(["Cancelled", "Checked Out", "Expired"]);
    const referencedPaymentFiles = new Set();
    const referencedDocumentFiles = new Set();
    const terminalBookings = [];
    for (const booking of bookings) {
      if (booking.paymentProof) referencedPaymentFiles.add(path.basename(String(booking.paymentProof)));
      for (const item of (booking.paymentProofHistory || [])) if (item.filename) referencedPaymentFiles.add(path.basename(String(item.filename)));
      if (booking.governmentId) referencedDocumentFiles.add(path.basename(String(booking.governmentId)));
      if (booking.driversLicense) referencedDocumentFiles.add(path.basename(String(booking.driversLicense)));
      if (booking.reschedulePaymentProof) referencedPaymentFiles.add(path.basename(String(booking.reschedulePaymentProof)));
      if (terminalStatuses.has(String(booking.bookingStatus || "").trim())) terminalBookings.push(booking);
    }
    for (const booking of terminalBookings) {
      deleteUploadedFile(paymentUploadDir, booking.paymentProof);
      for (const item of (booking.paymentProofHistory || [])) deleteUploadedFile(paymentUploadDir, item.filename);
      deleteUploadedFile(guestDocumentUploadDir, booking.governmentId);
      deleteUploadedFile(guestDocumentUploadDir, booking.driversLicense);
      deleteUploadedFile(paymentUploadDir, booking.reschedulePaymentProof);
      await Booking.updateOne({ _id: booking._id }, { $set: { paymentProof: "", governmentId: "", driversLicense: "", reschedulePaymentProof: "", paymentProofHistory: [] } });
    }
    const orphanPaymentFiles = listFiles(paymentUploadDir).filter(name => !referencedPaymentFiles.has(name));
    const orphanDocumentFiles = listFiles(guestDocumentUploadDir).filter(name => !referencedDocumentFiles.has(name));
    for (const filename of orphanPaymentFiles) deleteUploadedFile(paymentUploadDir, filename);
    for (const filename of orphanDocumentFiles) deleteUploadedFile(guestDocumentUploadDir, filename);
  } catch (err) { console.error("TERMINAL/ORPHAN UPLOAD CLEANUP ERROR:", err); }
}

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Vercel's Express runtime can invoke this app directly for the project root.
// Serve the static frontend from Express as a final fallback so / never returns
// the API's JSON "Route not found" response. API routes remain under /api.
const frontendRoot = path.join(process.cwd(), 'frontend');
app.use(express.static(frontendRoot));
app.get('/', (req, res) => res.sendFile(path.join(frontendRoot, 'index.html')));

const mongoUri = process.env.MONGODB_URI;
let mongoConnectionPromise = null;
function connectMongoDB() {
  if (!mongoUri) return Promise.reject(new Error('MONGODB_URI environment variable is not configured in Vercel.'));
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 5,
      bufferCommands: false
    }).then(() => {
      console.log('✅ MongoDB Connected');
      return mongoose.connection;
    }).catch(err => {
      mongoConnectionPromise = null;
      console.error('MongoDB Error:', err.message);
      throw err;
    });
  }
  return mongoConnectionPromise;
}

app.get('/api/health', async (req, res) => {
  try {
    await connectMongoDB();
    res.json({ status: 'success', message: 'CA Smart Staycation API is running', database: 'connected', timestamp: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unavailable', error: err.message });
  }
});

app.use('/api', async (req, res, next) => {
  try {
    await connectMongoDB();
    next();
  } catch (err) {
    console.error('API DATABASE CONNECTION ERROR:', err.message);
    res.status(503).json({ success: false, message: 'Database connection unavailable. Check the MONGODB_URI and MongoDB Atlas network access settings.' });
  }
});

async function expireUnpaidBookings() {
  try {
    const result = await Booking.updateMany({ paymentDeadline: { $ne: null, $lte: new Date() }, paymentProof: { $in: [null, ""] }, paymentStatus: { $ne: "Paid" }, bookingStatus: { $in: ["Reserved", "Waiting for Payment", "Payment Rejected"] } }, { $set: { bookingStatus: "Expired" } });
    if (result.modifiedCount) console.log(`⏰ Auto-expired ${result.modifiedCount} unpaid booking(s).`);
  } catch (err) { console.error("BOOKING EXPIRATION ERROR:", err); }
}

app.get('/api/bookings', async (req, res) => {
  try {
    await expireUnpaidBookings();
    const bookings = await Booking.find().select("bookingReference firstName lastName email mobile room parking parkingOnly checkIn checkOut adults children totalAmount paymentStatus bookingStatus housekeepingStatus paymentProof paymentProofSubmittedAt paymentDate refundRequested refundRequestedAt refundAmount refundFee refundPolicyRule refundStatus refundProcessedAt refundProcessedBy cancellationRequestedAt cancellationReason createdAt updatedAt").populate({ path: "room", select: "unitNumber unitName category capacity price weekendPrice holidayPrice status" }).populate({ path: "parking", select: "parkingNumber parkingName status" }).lean().sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) { console.error("BOOKING LIST ERROR:", err); res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("room").populate("parking").lean();
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.use('/api', require('./routes/adminRoutes'));
app.use('/api', require('./routes/roomRoutes'));
app.use('/api', require('./routes/guestRoutes'));
app.use('/api', require('./routes/guestFastRoutes'));
app.use('/api', require('./routes/guestAuthRoutes'));
app.use('/api', require('./routes/paymentRecoveryRoutes'));
app.use('/api', require('./routes/bookingRoutes'));
app.use('/api', require('./routes/guestDocumentRoutes'));
app.use('/api', require('./routes/parkingRoutes'));
app.use('/api', require('./routes/voucherRoutes'));
app.use('/api', require('./routes/messagingRoutes'));
app.use('/api/settings', settingsRoutes);

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ status: 'error', message: 'Route not found' });
  return res.sendFile(path.join(frontendRoot, 'index.html'));
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 CA Smart Staycation API running on port ${PORT}`);
    setInterval(expireUnpaidBookings, 60 * 1000);
    setInterval(cleanupTerminalBookingUploads, 60 * 1000);
    setInterval(() => processBookingStatusNotifications().catch(err => console.error("BOOKING STATUS NOTIFICATION ERROR:", err)), 15 * 1000);
    expireUnpaidBookings(); cleanupTerminalBookingUploads(); processBookingStatusNotifications().catch(err => console.error("INITIAL BOOKING STATUS NOTIFICATION ERROR:", err));
  });
}

module.exports = app;
