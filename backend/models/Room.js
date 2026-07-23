const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  roomName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  weekendPrice: {
    type: Number,
    default: 0
  },
  holidayPrice: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Available', 'Reserved', 'Occupied', 'Maintenance'],
    default: 'Available'
  },
  amenities: [{
    type: String
  }],
  images: [{
    type: String
  }],
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Room', roomSchema);
