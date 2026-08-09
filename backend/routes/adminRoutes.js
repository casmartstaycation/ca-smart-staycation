const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

function getAdminConfig() {
  return {
    email: String(process.env.ADMIN_EMAIL || process.env.EMAIL_USER || '').trim().toLowerCase(),
    password: String(process.env.ADMIN_PASSWORD || ''),
    jwtSecret: String(process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || '')
  };
}

router.get('/admin', (req, res) => {
  res.json({
    status: 'success',
    message: 'Admin endpoint OK'
  });
});

// Safe diagnostic endpoint: reports configuration state only, never credentials.
router.get('/admin-auth/status', (req, res) => {
  const config = getAdminConfig();
  res.json({
    success: true,
    configured: Boolean(config.email && config.password && config.jwtSecret),
    emailConfigured: Boolean(config.email),
    passwordConfigured: Boolean(config.password),
    jwtConfigured: Boolean(config.jwtSecret),
    adminEmail: config.email || null
  });
});

router.post('/admin-auth/login', async (req, res) => {
  try {
    const config = getAdminConfig();
    const email = String(req.body?.email || '').trim().toLowerCase();
    // Do not trim passwords: spaces can legitimately be part of a password.
    const password = String(req.body?.password ?? '');

    if (!config.email || !config.password || !config.jwtSecret) {
      return res.status(503).json({
        success: false,
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
        message: 'Admin authentication is not fully configured on the server. Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_JWT_SECRET in Render, then redeploy.'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: 'ADMIN_CREDENTIALS_REQUIRED',
        message: 'Admin email and password are required.'
      });
    }

    if (email !== config.email) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_ADMIN_CREDENTIALS',
        message: 'Invalid admin credentials.'
      });
    }

    const valid = config.password.startsWith('$2')
      ? await bcrypt.compare(password, config.password)
      : password === config.password;

    if (!valid) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_ADMIN_CREDENTIALS',
        message: 'Invalid admin credentials.'
      });
    }

    const token = jwt.sign(
      { role: 'admin', email: config.email },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    return res.json({
      success: true,
      message: 'Admin login successful.',
      token,
      admin: { email: config.email, role: 'admin' }
    });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    return res.status(500).json({
      success: false,
      code: 'ADMIN_LOGIN_ERROR',
      message: 'Unable to process admin login.'
    });
  }
});

module.exports = router;
