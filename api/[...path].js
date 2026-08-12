const app = require('../backend/server');

// Vercel invokes this catch-all as a serverless function. Set CORS headers
// at the function boundary so they are present even if Express middleware
// ordering/adapter behavior changes.
const allowedOrigins = new Set([
  'https://casmartstaycation.com',
  'https://www.casmartstaycation.com',
  'https://casmartstaycation.github.io'
]);

module.exports = (req, res) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    if (!origin || allowedOrigins.has(origin)) return res.status(204).end();
    return res.status(403).json({ success: false, message: 'CORS origin not allowed' });
  }

  return app(req, res);
};
