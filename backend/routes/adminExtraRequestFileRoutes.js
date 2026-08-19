const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const { openDownload, getFileInfo } = require('../services/gridfsStorage');

const router = express.Router();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'markryantamayo@gmail.com';
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (ADMIN_PASSWORD ? crypto.createHash('sha256').update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest('hex') : '');

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !ADMIN_JWT_SECRET) return res.status(401).json({ success: false, message: 'Admin authentication required.' });
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload.role !== 'admin' || String(payload.email || '').toLowerCase() !== String(ADMIN_EMAIL).toLowerCase()) return res.status(403).json({ success: false, message: 'Admin access required.' });
    req.admin = payload;
    next();
  } catch (_) { return res.status(401).json({ success: false, message: 'Admin session expired or invalid.' }); }
}

router.get('/admin/bookings/:id/file/extra-request/:subId', requireAdmin, async (req, res) => {
  try {
    const rawId = String(req.params.id || '').trim();
    const booking = mongoose.Types.ObjectId.isValid(rawId)
      ? await Booking.findById(rawId).lean()
      : await Booking.findOne({ bookingReference: rawId }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const requests = Array.isArray(booking.extraRequests) ? booking.extraRequests : [];
    const key = String(req.params.subId || '').trim();
    let request = requests.find(r => String(r._id || '') === key);

    // Older extra-request records may not have a usable subdocument _id in the
    // stored document. Fall back to the request array index so existing uploads
    // remain viewable without requiring the guest to upload them again.
    if (!request && /^\d+$/.test(key)) request = requests[Number(key)];

    // Also tolerate the request id being supplied as a Mongo ObjectId-like value
    // whose string representation differs in the frontend serialization.
    if (!request && key && mongoose.Types.ObjectId.isValid(key)) {
      request = requests.find(r => String(r._id) === String(new mongoose.Types.ObjectId(key)));
    }

    if (!request) return res.status(404).json({ success: false, message: 'Additional request not found.' });
    const value = String(request.paymentProof || '');
    const filename = String(request.paymentProofFileName || 'additional-request-payment-proof');
    if (!value) return res.status(404).json({ success: false, message: 'Payment proof for this additional request is not available.' });

    const tryGridFS = async id => {
      try {
        const info = await getFileInfo(id);
        if (!info) return false;
        const stream = openDownload(id);
        if (!stream) return false;
        res.setHeader('Content-Type', info.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${String(info.filename || filename).replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
        res.setHeader('Cache-Control', 'private, no-store');
        stream.on('error', err => { console.error('GRIDFS EXTRA REQUEST DOWNLOAD ERROR:', err); if (!res.headersSent) res.status(404).json({ success: false, message: 'Uploaded payment proof could not be read from storage.' }); });
        stream.pipe(res);
        return true;
      } catch (err) { console.error('GRIDFS EXTRA REQUEST LOOKUP ERROR:', err); return false; }
    };

    if (await tryGridFS(value)) return;

    if (value.startsWith('data:')) {
      const match = value.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/s);
      if (!match) return res.status(400).json({ success: false, message: 'Stored payment proof data is invalid.' });
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', match[1] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(buffer);
    }

    if (/^https?:\/\//i.test(value)) {
      const match = value.match(/\/api\/uploads\/[^/]+\/([a-f0-9]{24})(?:[/?#]|$)/i);
      if (match && await tryGridFS(match[1])) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const upstream = await fetch(value, { redirect: 'follow', signal: controller.signal });
        if (!upstream.ok) return res.status(502).json({ success: false, message: `Stored payment proof could not be retrieved (HTTP ${upstream.status}).` });
        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        if (/text\/html/i.test(contentType)) return res.status(502).json({ success: false, message: 'The stored payment proof URL returned a web page instead of the uploaded file.' });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.send(Buffer.from(await upstream.arrayBuffer()));
      } finally { clearTimeout(timer); }
    }

    return res.status(404).json({ success: false, message: 'The additional request payment proof is not available from the current storage service.' });
  } catch (err) {
    console.error('ADMIN EXTRA REQUEST FILE ERROR:', err);
    if (err.name === 'AbortError') return res.status(504).json({ success: false, message: 'The uploaded payment proof storage service took too long to respond.' });
    return res.status(500).json({ success: false, message: 'Unable to open additional request payment proof.' });
  }
});

module.exports = router;
