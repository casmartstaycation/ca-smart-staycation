//app.use('/api/auth', require('./routes/authRoutes'));
//app.use('/api/bookings', require('./routes/bookingRoutes'));
//app.use('/api/guests', require('./routes/guestRoutes'));
//app.use('/api/units', require('./routes/unitRoutes'));
//app.use('/api/staff', require('./routes/staffRoutes'));
//app.use('/api/finance', require('./routes/financeRoutes'));
//app.use('/api/housekeeping', require('./routes/housekeepingRoutes'));
//app.use('/api/print', require('./routes/printRoutes'));
//app.use('/api/notifications', require('./routes/notificationRoutes'));
//app.use('/api/promotions', require('./routes/promotionRoutes'));
//app.use('/api/settings', require('./routes/settingsRoutes'));// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/bookings', require('./routes/bookingRoutes'));
// app.use('/api/guests', require('./routes/guestRoutes'));
// app.use('/api/units', require('./routes/unitRoutes'));
// app.use('/api/staff', require('./routes/staffRoutes'));
// app.use('/api/finance', require('./routes/financeRoutes'));
// app.use('/api/housekeeping', require('./routes/housekeepingRoutes'));
// app.use('/api/print', require('./routes/printRoutes'));
// app.use('/api/notifications', require('./routes/notificationRoutes'));
// app.use('/api/promotions', require('./routes/promotionRoutes'));
// app.use('/api/settings', require('./routes/settingsRoutes'));O
// ============================================
// CA SMART STAYCATION - MAIN SERVER
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'CA Smart Staycation API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes (will be added in next phases)
//app.use('/api/auth', require('./routes/authRoutes'));
//app.use('/api/bookings', require('./routes/bookingRoutes'));
//app.use('/api/guests', require('./routes/guestRoutes'));
//app.use('/api/units', require('./routes/unitRoutes'));
//app.use('/api/staff', require('./routes/staffRoutes'));
//app.use('/api/finance', require('./routes/financeRoutes'));
//app.use('/api/housekeeping', require('./routes/housekeepingRoutes'));
//app.use('/api/print', require('./routes/printRoutes'));
//app.use('/api/notifications', require('./routes/notificationRoutes'));
//app.use('/api/promotions', require('./routes/promotionRoutes'));
//app.use('/api/settings', require('./routes/settingsRoutes'));

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   CA SMART STAYCATION - Backend API       ║
  ╠═══════════════════════════════════════════╣
  ║  Server running on port ${PORT}           ║
  ║  Environment: ${process.env.NODE_ENV}     ║
  ║  Database: Connected                      ║
  ╚═══════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});


//app.use('/api/auth', require('./routes/authRoutes'));
//app.use('/api/bookings', require('./routes/bookingRoutes'));
//app.use('/api/guests', require('./routes/guestRoutes'));
//app.use('/api/units', require('./routes/unitRoutes'));
//app.use('/api/staff', require('./routes/staffRoutes'));
//app.use('/api/finance', require('./routes/financeRoutes'));
//app.use('/api/housekeeping', require('./routes/housekeepingRoutes'));
//app.use('/api/print', require('./routes/printRoutes'));
//app.use('/api/notifications', require('./routes/notificationRoutes'));
//app.use('/api/promotions', require('./routes/promotionRoutes'));
//app.use('/api/settings', require('./routes/settingsRoutes'));

// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/bookings', require('./routes/bookingRoutes'));
// app.use('/api/guests', require('./routes/guestRoutes'));
// app.use('/api/units', require('./routes/unitRoutes'));
// app.use('/api/staff', require('./routes/staffRoutes'));

// app.use('/api/finance', require('./routes/financeRoutes'));
// app.use('/api/housekeeping', require('./routes/housekeepingRoutes'));
// app.use('/api/print', require('./routes/printRoutes'));
// app.use('/api/notifications', require('./routes/notificationRoutes'));
// app.use('/api/promotions', require('./routes/promotionRoutes'));
// app.use('/api/settings', require('./routes/settingsRoutes'));

