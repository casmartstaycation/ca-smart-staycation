console.log("MONGODB_URI =", process.env.MONGODB_URI);
require('dotenv').config();
console.log("MONGODB_URI =", process.env.MONGODB_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const Booking = require("./models/Booking");
const Parking = require("./models/Parking");
const settingsRoutes = require("./routes/settingsRoutes");

app.use(helmet());
app.use(cors({
  origin: [
    "https://casmartstaycation.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("MongoDB Error:", err));

app.get('/', (req, res) => res.json({ status: 'success', message: 'CA Smart Staycation API is running' }));
app.get('/api/health', (req, res) => res.json({ status: 'success', message: 'CA Smart Staycation API is running', timestamp: new Date() }));

async function expireUnpaidBookings() {
  try {
    const result = await Booking.updateMany(
      {
        paymentDeadline: { $ne: null, $lte: new Date() },
        paymentProof: { $in: [null, ""] },
        paymentStatus: { $ne: "Paid" },
        bookingStatus: { $in: ["Reserved", "Payment Rejected"] }
      },
      { $set: { bookingStatus: "Expired" } }
    );
    if (result.modifiedCount) console.log(`⏰ Auto-expired ${result.modifiedCount} unpaid booking(s).`);
  } catch (err) {
    console.error("BOOKING EXPIRATION ERROR:", err);
  }
}

app.get('/api/bookings', async (req, res) => {
  try {
    await expireUnpaidBookings();
    const [bookings, currentParking] = await Promise.all([
      Booking.find().populate("room").lean().sort({ createdAt: -1 }),
      Parking.findOne({ parkingNumber: "SLOT 9" }).lean().then(slot => slot || Parking.findOne().lean())
    ]);
    const normalizedBookings = bookings.map(booking => booking.parking && currentParking ? { ...booking, parking: currentParking } : booking);
    res.json({ success: true, data: normalizedBookings });
  } catch (err) {
    console.error("Guest calendar bookings error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use('/api', require('./routes/adminRoutes'));
app.use('/api', require('./routes/roomRoutes'));
app.use('/api', require('./routes/guestRoutes'));
app.use('/api', require('./routes/guestAuthRoutes'));
app.use('/api', require('./routes/paymentRecoveryRoutes'));
app.use('/api', require('./routes/bookingRoutes'));
app.use('/api', require('./routes/parkingRoutes'));
app.use('/api/settings', settingsRoutes);

app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CA Smart Staycation API running on port ${PORT}`);
  setInterval(expireUnpaidBookings, 60 * 1000);
  expireUnpaidBookings();
});
