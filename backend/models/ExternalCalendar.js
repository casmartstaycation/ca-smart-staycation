const mongoose = require('mongoose');

const externalCalendarEventSchema = new mongoose.Schema({
  uid: { type: String, default: '' },
  start: { type: String, required: true },
  end: { type: String, required: true },
  summary: { type: String, default: '' }
}, { _id: false });

const externalCalendarSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  url: { type: String, required: true, trim: true },
  enabled: { type: Boolean, default: true },
  events: { type: [externalCalendarEventSchema], default: [] },
  lastSyncedAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null },
  lastError: { type: String, default: '' }
}, { timestamps: true });

externalCalendarSchema.index({ enabled: 1, lastSyncedAt: 1 });

module.exports = mongoose.model('ExternalCalendar', externalCalendarSchema);
