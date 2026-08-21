const express = require('express');
const mongoose = require('mongoose');
const externalCalendarRoutes = require('../../backend/routes/externalCalendarRoutes');

const app = express();
const mongoState = globalThis.__caSmartCalendarSyncMongo || (globalThis.__caSmartCalendarSyncMongo = { promise: null });

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  if (!mongoState.promise) {
    mongoState.promise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 2,
      minPoolSize: 0,
      maxIdleTimeMS: 5000,
      bufferCommands: false
    }).finally(() => { mongoState.promise = null; });
  }
  return mongoState.promise;
}

app.use(express.json({ limit: '256kb' }));
app.use(async (req, res, next) => {
  try { await connectDatabase(); next(); }
  catch (err) { res.status(503).json({ success: false, message: 'Database connection unavailable.' }); }
});
app.use('/api/calendar-sync', externalCalendarRoutes);
app.use((req, res) => res.status(404).json({ success: false, message: 'Calendar sync route not found.' }));

module.exports = app;
