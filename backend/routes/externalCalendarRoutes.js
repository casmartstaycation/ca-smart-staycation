const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { requireAdmin } = require('../middleware/adminAuth');
const ExternalCalendar = require('../models/ExternalCalendar');

const router = express.Router();
const MAX_ICAL_BYTES = 2 * 1024 * 1024;
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

function isPrivateAddress(address) {
  if (!address) return true;
  if (net.isIPv4(address)) {
    const p = address.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  if (net.isIPv6(address)) {
    const a = address.toLowerCase();
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') ||
      a.startsWith('fe80:') || a.startsWith('::ffff:127.') || a.startsWith('::ffff:10.') ||
      a.startsWith('::ffff:192.168.');
  }
  return true;
}

async function validateFeedUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('Please enter a valid iCal URL.'); }
  if (url.protocol !== 'https:') throw new Error('For security, the iCal URL must use HTTPS.');
  if (url.username || url.password) throw new Error('iCal URLs containing embedded usernames or passwords are not allowed.');
  if (['localhost', 'localhost.localdomain'].includes(url.hostname.toLowerCase())) throw new Error('Local network calendar URLs are not allowed.');
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('This calendar host resolves to a private or restricted network address.');
  return url;
}

function unfoldIcal(text) {
  return String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function dateKeyFromIcal(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function addDays(dateKey, days) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function unescapeIcalText(value) {
  return String(value || '').replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function parseIcal(text) {
  const lines = unfoldIcal(text);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') {
      if (current) {
        const start = dateKeyFromIcal(current.dtstart);
        let end = dateKeyFromIcal(current.dtend);
        if (start && !end) end = addDays(start, 1);
        if (start && end && end > start) events.push({
          uid: String(current.uid || '').slice(0, 300),
          start,
          end,
          summary: unescapeIcalText(current.summary || '').slice(0, 160)
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).split(';')[0].toLowerCase();
    const value = line.slice(colon + 1);
    if (key === 'dtstart') current.dtstart = value;
    else if (key === 'dtend') current.dtend = value;
    else if (key === 'uid') current.uid = value;
    else if (key === 'summary') current.summary = value;
  }
  if (!events.length) throw new Error('No bookable date events were found in this iCal feed.');
  return events.slice(0, 5000);
}

async function fetchCalendar(urlValue) {
  const url = await validateFeedUrl(urlValue);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'CA-Smart-Staycation-Calendar-Sync/1.0', Accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.1' },
      redirect: 'error',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Calendar server returned HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_ICAL_BYTES) throw new Error('Calendar feed is too large.');
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_ICAL_BYTES) throw new Error('Calendar feed is too large.');
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('The URL did not return a valid iCal calendar.');
    return parseIcal(text);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Calendar server timed out.');
    throw err;
  } finally { clearTimeout(timeout); }
}

async function syncCalendar(calendar) {
  calendar.lastAttemptAt = new Date();
  try {
    calendar.events = await fetchCalendar(calendar.url);
    calendar.lastSyncedAt = new Date();
    calendar.lastError = '';
    await calendar.save();
    return calendar;
  } catch (err) {
    calendar.lastError = String(err.message || 'Calendar sync failed.').slice(0, 300);
    if (!calendar.isNew) await calendar.save();
    throw err;
  }
}

function safeCalendar(calendar) {
  let host = '';
  try { host = new URL(calendar.url).hostname; } catch {}
  return {
    _id: calendar._id,
    name: calendar.name,
    enabled: calendar.enabled,
    host,
    eventCount: Array.isArray(calendar.events) ? calendar.events.length : 0,
    lastSyncedAt: calendar.lastSyncedAt,
    lastAttemptAt: calendar.lastAttemptAt,
    lastError: calendar.lastError,
    createdAt: calendar.createdAt,
    updatedAt: calendar.updatedAt
  };
}

function expandBlockedDates(events) {
  const dates = new Set();
  for (const event of events || []) {
    let cursor = event.start;
    let guard = 0;
    while (cursor && cursor < event.end && guard < 730) {
      dates.add(cursor);
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  }
  return dates;
}

async function syncStaleCalendars(calendars) {
  const now = Date.now();
  for (const calendar of calendars) {
    const last = calendar.lastAttemptAt ? new Date(calendar.lastAttemptAt).getTime() : 0;
    if (!calendar.enabled || now - last < SYNC_INTERVAL_MS) continue;
    try { await syncCalendar(calendar); } catch (err) { console.warn(`ICAL AUTO-SYNC ERROR (${calendar.name}):`, err.message); }
  }
}

router.get('/external-calendar-blocks', async (req, res) => {
  try {
    const calendars = await ExternalCalendar.find({ enabled: true }).sort({ createdAt: 1 });
    await syncStaleCalendars(calendars);
    const dates = new Set();
    for (const calendar of calendars) for (const date of expandBlockedDates(calendar.events)) dates.add(date);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: Array.from(dates).sort() });
  } catch (err) {
    console.error('EXTERNAL CALENDAR BLOCKS ERROR:', err);
    res.status(500).json({ success: false, message: 'Unable to load external calendar dates.' });
  }
});

router.get('/external-calendars', requireAdmin, async (req, res) => {
  try {
    const calendars = await ExternalCalendar.find().sort({ createdAt: 1 });
    res.json({ success: true, data: calendars.map(safeCalendar) });
  } catch (err) { res.status(500).json({ success: false, message: 'Unable to load external calendars.' }); }
});

router.post('/external-calendars', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const url = String(req.body?.url || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Calendar name is required.' });
    await validateFeedUrl(url);
    const duplicate = await ExternalCalendar.findOne({ url });
    if (duplicate) return res.status(409).json({ success: false, message: 'This iCal URL has already been added.' });
    const calendar = new ExternalCalendar({ name, url, enabled: true });
    try { await syncCalendar(calendar); }
    catch (err) { return res.status(400).json({ success: false, message: err.message || 'Unable to sync this calendar.' }); }
    res.status(201).json({ success: true, data: safeCalendar(calendar) });
  } catch (err) { res.status(400).json({ success: false, message: err.message || 'Unable to add calendar.' }); }
});

router.post('/external-calendars/:id/sync', requireAdmin, async (req, res) => {
  try {
    const calendar = await ExternalCalendar.findById(req.params.id);
    if (!calendar) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    await syncCalendar(calendar);
    res.json({ success: true, data: safeCalendar(calendar) });
  } catch (err) { res.status(400).json({ success: false, message: err.message || 'Unable to sync calendar.' }); }
});

router.patch('/external-calendars/:id', requireAdmin, async (req, res) => {
  try {
    const calendar = await ExternalCalendar.findById(req.params.id);
    if (!calendar) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    if (typeof req.body?.enabled === 'boolean') calendar.enabled = req.body.enabled;
    if (typeof req.body?.name === 'string' && req.body.name.trim()) calendar.name = req.body.name.trim().slice(0, 80);
    await calendar.save();
    res.json({ success: true, data: safeCalendar(calendar) });
  } catch (err) { res.status(400).json({ success: false, message: err.message || 'Unable to update calendar.' }); }
});

router.delete('/external-calendars/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await ExternalCalendar.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ success: false, message: 'Unable to delete calendar.' }); }
});

module.exports = router;