const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || process.env.EMAIL_USER || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

router.get('/admin', (req, res) => {
  res.json({
    status: 'success',
    message: 'Admin endpoint OK'
  });
});

router.post('/admin-auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !JWT_SECRET) {
      return res.status(503).json({ success: false, message: 'Admin authentication is not configured on the server.' });
    }

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Admin email and password are required.' });
    }

    if (email !== ADMIN_EMAIL) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const valid = ADMIN_PASSWORD.startsWith('$2')
      ? await bcrypt.compare(password, ADMIN_PASSWORD)
      : password === ADMIN_PASSWORD;

    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const token = jwt.sign(
      { role: 'admin', email: ADMIN_EMAIL },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Admin login successful.',
      token,
      admin: { email: ADMIN_EMAIL, role: 'admin' }
    });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    res.status(500).json({ success: false, message: 'Unable to process admin login.' });
  }
});

module.exports = router;
