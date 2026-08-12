const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const GuestAccount = require('../models/GuestAccount');
const sendEmail = require('../mail/sendEmail');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ca-smart-staycation-guest-secret';
const RESET_TOKEN_BYTES = 24;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const LOGIN_URL = process.env.GUEST_LOGIN_URL || 'https://www.casmartstaycation.com/guest-booking/guest-login.html';

function signGuestToken(account) {
  return jwt.sign(
    { accountId: account._id.toString(), email: account.email, bookingReference: account.bookingReference },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

router.post('/guest-auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const account = await GuestAccount.findOne({ email }).sort({ createdAt: -1 });

    if (account) {
      const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      account.resetPasswordTokenHash = tokenHash;
      account.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
      await account.save();

      const resetLink = `${LOGIN_URL}?reset=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
      const html = `<!doctype html><html><body>
        <p>Dear Guest,</p>
        <p>We received a request to reset your CA Smart Staycation guest account password.</p>
        <p>Click the link below to reset your password (this link expires in 1 hour):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you did not request a password reset, you can safely ignore this message.</p>
        <p>CA Smart Staycation</p>
        </body></html>`;

      try { await sendEmail(email, 'CA Smart Staycation — Reset your password', html); }
      catch (emailErr) { console.error('GUEST FORGOT-PASSWORD EMAIL ERROR:', emailErr?.message || emailErr); }
    }

    return res.json({ success: true, message: 'If an account exists for that email, a password reset link has been sent.' });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err);
    return res.status(500).json({ success: false, message: 'Unable to process request.' });
  }
});

router.post('/guest-auth/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const token = String(req.body.token || '');
    const newPassword = String(req.body.newPassword || '');

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, token and new password are required.' });
    }
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const account = await GuestAccount.findOne({ email, resetPasswordTokenHash: tokenHash }).sort({ createdAt: -1 });
    if (!account || !account.resetPasswordExpiresAt || account.resetPasswordExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or expired.' });
    }

    account.passwordHash = await bcrypt.hash(newPassword, 12);
    account.defaultPassword = false;
    account.resetPasswordTokenHash = null;
    account.resetPasswordExpiresAt = null;
    await account.save();

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
});

router.post('/guest-auth/change-password', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const token = header.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(401).json({ success: false, message: 'Session expired or invalid.' }); }

    const account = await GuestAccount.findById(payload.accountId);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    if (!(await bcrypt.compare(currentPassword, account.passwordHash))) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

    account.passwordHash = await bcrypt.hash(newPassword, 12);
    account.defaultPassword = false;
    await account.save();

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('CHANGE PASSWORD ERROR:', err);
    return res.status(500).json({ success: false, message: 'Unable to change password.' });
  }
});

router.get('/guest-auth/me', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const token = header.slice(7);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(401).json({ success: false, message: 'Session expired or invalid.' }); }

    const account = await GuestAccount.findById(payload.accountId).lean();
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });

    return res.json({ success: true, account: { id: account._id, email: account.email, bookingReference: account.bookingReference, mustChangePassword: !!account.defaultPassword } });
  } catch (err) {
    console.error('GUEST ME ERROR:', err);
    return res.status(500).json({ success: false, message: 'Unable to load account.' });
  }
});

module.exports = router;
