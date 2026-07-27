console.log("MONGODB_URI =", process.env.MONGODB_URI);// ============================================
// CA SMART STAYCATION BACKEND
// ============================================

require('dotenv').config();
console.log("MONGODB_URI =", process.env.MONGODB_URI);

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

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: [
    "https://casmartstaycation.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ],
  credentials: true
}));

// Logging
app.use(morgan('dev'));

// Body parser
app.use(express.json({
  limit: '10mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Static uploads
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'))
);

// ============================================
// DATABASE
// ============================================

mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log("✅ MongoDB Connected");
})
.catch(err => {
    console.error("MongoDB Error:", err);
});

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'CA Smart Staycation API is running'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'CA Smart Staycation API is running',
    timestamp: new Date()
  });
});

// API Routes
app.use('/api', require('./routes/adminRoutes'));
app.use('/api', require('./routes/roomRoutes'));
app.use('/api', require('./routes/guestRoutes'));
app.use('/api', require('./routes/bookingRoutes'));

// ============================================
// 404
// ============================================

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});
// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 CA Smart Staycation API running on port ${PORT}`);
});
