const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const DEFAULT_ADMIN_EMAIL = "markryantamayo@gmail.com";
const ADMIN_SESSION_MIN_IAT = 1787331840; // 2026-08-21T17:04:00Z; invalidates sessions running the old fetch-loop script.

function getAdminJwtSecret() {
  const password = String(process.env.ADMIN_PASSWORD || "");
  return String(
    process.env.ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    (password ? crypto.createHash("sha256").update(`ca-smart-admin:${password}`).digest("hex") : "")
  );
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const secret = getAdminJwtSecret();
  const expectedEmail = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();

  if (!token || !secret) {
    return res.status(401).json({ success: false, message: "Admin authentication required." });
  }

  try {
    const payload = jwt.verify(token, secret);
    const issuedAt = Number(payload.iat || 0);
    if (!issuedAt || issuedAt < ADMIN_SESSION_MIN_IAT) {
      return res.status(401).json({
        success: false,
        code: "ADMIN_SESSION_REFRESH_REQUIRED",
        message: "Admin session refreshed. Please sign in again."
      });
    }
    if (payload.role !== "admin" || String(payload.email || "").toLowerCase() !== expectedEmail) {
      return res.status(403).json({ success: false, message: "Admin access required." });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Admin session expired or invalid." });
  }
}

module.exports = { requireAdmin, getAdminJwtSecret };
