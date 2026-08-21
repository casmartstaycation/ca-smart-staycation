const express = require('express');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');

const router = express.Router();

const NON_BLOCKING_STATUSES = new Set(['Cancelled', 'Expired']);

function toDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

function compactDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}${match[2]}${match[3]}` : null;
}

function nextDateOnly(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  return toDateOnly(date);
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function uidFor(value) {
  const digest = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
  return `${digest}@casmartstaycation.com`;
}

function escapeText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function eventLines({ uid, start, end, summary, description }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    'TRANSP:OPAQUE',
    'STATUS:CONFIRMED',
    'END:VEVENT'
  ];
}

async function buildCalendar() {
  const [bookings, settings] = await Promise.all([
    Booking.find({ bookingStatus: { $nin: Array.from(NON_BLOCKING_STATUSES) } })
      .select('_id room parkingOnly checkIn checkOut bookingStatus updatedAt')
      .populate({ path: 'room', select: 'unitName unitNumber category' })
      .lean()
      .sort({ checkIn: 1 }),
    Setting.findOne().select('blockedDates').lean()
  ]);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CA Smart Staycation//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CA Smart Staycation',
    'X-WR-CALDESC:Booked and blocked accommodation dates for CA Smart Staycation',
    'X-WR-TIMEZONE:Asia/Manila',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M'
  ];

  for (const booking of bookings) {
    if (booking.parkingOnly || !booking.room) continue;
    const start = toDateOnly(booking.checkIn);
    const end = toDateOnly(booking.checkOut);
    if (!start || !end || start >= end) continue;

    const unit = booking.room?.unitName || booking.room?.unitNumber || booking.room?.category || 'Accommodation';
    lines.push(...eventLines({
      uid: uidFor(`booking:${booking._id}`),
      start,
      end,
      summary: `Booked - ${unit}`,
      description: 'CA Smart Staycation occupied dates. Guest information is intentionally excluded from this public calendar feed.'
    }));
  }

  for (const item of settings?.blockedDates || []) {
    const start = compactDate(item?.date);
    const end = nextDateOnly(item?.date);
    if (!start || !end) continue;

    lines.push(...eventLines({
      uid: uidFor(`blocked:${item.date}`),
      start,
      end,
      summary: 'Blocked - CA Smart Staycation',
      description: item?.reason ? `Admin blocked date: ${item.reason}` : 'Admin blocked date.'
    }));
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

async function sendCalendar(req, res) {
  try {
    const calendar = await buildCalendar();
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="ca-smart-staycation.ics"',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
    });
    return res.status(200).send(calendar);
  } catch (err) {
    console.error('ICAL FEED ERROR:', err);
    return res.status(500).json({ success: false, message: 'Unable to generate calendar feed.' });
  }
}

router.get('/calendar.ics', sendCalendar);
router.get('/ical', sendCalendar);

module.exports = router;
