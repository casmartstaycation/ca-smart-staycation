// ============================================
// UNIT MODEL
// ============================================

const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  // Basic Information
  unitNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Studio', '1 Bedroom', '2 Bedroom']
  },
  
  // Capacity
  capacity: {
    adults: {
      type: Number,
      required: true,
      default: 2
    },
    children: {
      type: Number,
      default: 0
    },
    extraGuestAllowed: {
      type: Boolean,
      default: true
    },
    maxExtraGuests: {
      type: Number,
      default: 2
    }
  },
  
  // Pricing
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    weekendRate: Number,
    holidayRate: Number,
    monthlyRate: Number,
    extraGuestFee: {
      type: Number,
      default: 500
    }
  },
  
  // Amenities
  amenities: [{
    type: String
  }],
  
  // Description
  description: {
    type: String,
    required: true
  },
  features: [{
    type: String
  }],
  
  // Images
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false }
  }],
  
  // Floor Plan
  floorPlan: {
    area: Number, // in sqm
    bedrooms: Number,
    bathrooms: Number,
    imageUrl: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['Available', 'Occupied', 'Maintenance', 'Cleaning', 'Reserved'],
    default: 'Available'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Housekeeping
  lastCleaned: Date,
  lastMaintenance: Date,
  maintenanceNotes: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for primary image
unitSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

module.exports = mongoose.model('Unit', unitSchema);

