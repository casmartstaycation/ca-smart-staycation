// ============================================
// BOOKING MODEL
// ============================================

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Booking Reference
  bookingReference: {
    type: String,
    required: true,
    unique: true
  },
  
  // Guest Information
  guest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guest',
    required: true
  },
  
  // Unit Information
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true
  },
  
  // Dates
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  numberOfNights: {
    type: Number,
    required: true
  },
  
  // Guest Count
  guests: {
    adults: {
      type: Number,
      required: true,
      default: 1
    },
    children: {
      type: Number,
      default: 0
    },
    extraGuests: {
      type: Number,
      default: 0
    }
  },
  
  // Additional Services
  parking: {
    required: {
      type: Boolean,
      default: false
    },
    fee: {
      type: Number,
      default: 0
    }
  },
  
  // Pricing Breakdown
  pricing: {
    baseRate: Number,
    numberOfNights: Number,
    subtotal: Number,
    extraGuestFee: Number,
    parkingFee: Number,
    promoDiscount: Number,
    securityDeposit: Number,
    totalAmount: Number
  },
  
  // Promo Code
  promoCode: {
    code: String,
    discountAmount: Number,
    discountPercent: Number
  },
  
  // Payment Information
  payment: {
    status: {
      type: String,
      enum: ['Pending', 'Partial', 'Paid', 'Refunded'],
      default: 'Pending'
    },
    method: {
      type: String,
      enum: ['GCash', 'Bank Transfer', 'Cash', 'Maya', 'Credit Card']
    },
    proofOfPayment: String,
    paidAmount: {
      type: Number,
      default: 0
    },
    paidAt: Date,
    receiptNumber: String
  },
  
  // Booking Status
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled', 'No-Show'],
    default: 'Pending'
  },
  
  // Check-in/Check-out Details
  actualCheckIn: Date,
  actualCheckOut: Date,
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  checkedOutBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  
  // QR Code
  qrCode: String,
  
  // Special Requests
  specialRequests: String,
  
  // Notes
  adminNotes: String,
  guestNotes: String,
  
  // Cancellation
  cancellation: {
    isCancelled: {
      type: Boolean,
      default: false
    },
    cancelledAt: Date,
    reason: String,
    refundAmount: Number
  },
  
  // Security Deposit
  securityDeposit: {
    amount: Number,
    status: {
      type: String,
      enum: ['Held', 'Released', 'Deducted'],
      default: 'Held'
    },
    releasedAt: Date,
    deductions: [{
      item: String,
      amount: Number,
      reason: String
    }]
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate booking reference
bookingSchema.pre('save', async function(next) {
  if (!
