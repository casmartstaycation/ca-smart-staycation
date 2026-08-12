const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

let connectionPromise;

function getConnection() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not configured');
  }

  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  return connectionPromise;
}

const roomSchema = new mongoose.Schema({
  unitNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  unitName: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  capacity: { type: Number, required: true },
  price: { type: Number, required: true },
  weekendPrice: { type: Number, default: 0 },
  holidayPrice: { type: Number, default: 0 },
  status: { type: String, enum: ['Available', 'Reserved', 'Occupied', 'Maintenance'], default: 'Available' },
  amenities: [{ type: String }],
  images: [{ type: String }],
  description: { type: String, default: '' },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 1 },
  areaSqm: { type: Number, default: 0 },
  bedType: { type: String, default: '' }
}, { timestamps: true, collection: 'rooms' });

const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    await getConnection();
    const rooms = await Room.find().sort({ unitNumber: 1 }).lean();
    return res.status(200).json({ status: 'success', data: rooms });
  } catch (error) {
    console.error('VERCEL GET ROOMS ERROR:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Unable to load accommodation'
    });
  }
};
