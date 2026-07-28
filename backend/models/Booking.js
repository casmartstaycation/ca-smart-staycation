const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    required: true,
    unique: true
  },

  guest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guest',
    required: true
  },

  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
},

  checkIn: {
    type: Date,
    required: true
  },

  checkOut: {
    type: Date,
    required: true
  },

  adults: {
    type: Number,
    default: 1
  },

  children: {
    type: Number,
    default: 0
  },

  totalAmount: {
    type: Number,
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid', 'Refunded'],
    default: 'Pending'
  },

  bookingStatus: {
    type: String,
    enum: [
      'Reserved',
      'Checked In',
      'Checked Out',
      'Cancelled'
    ],
    default: 'Reserved'
  },

  housekeepingStatus: {
    type: String,
    enum: [
        'Clean',
        'Needs Cleaning'
    ],
    default: 'Clean'
},

parkingOnly: {
    type: Boolean,
    default: false
},

parking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parking',
    default: null
},

notes: {
    type: String,
    default: ''
}
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
