const app = require('../backend/server');
const path = require('path');
const fs = require('fs');

// Vercel can route non-/api requests through this catch-all in the current
// Express project configuration. Serve the frontend explicitly here so the
// website never falls through to the API root handler.
const frontendDir = path.join(__dirname, '..', 'frontend');

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

  const requestPath = String(req.path || req.url || '/').split('?')[0];

  // API requests must continue to the Express API.
  if (requestPath === '/api' || requestPath.startsWith('/api/')) {
    return app(req, res);
  }

  // Explicitly serve the public website for all non-API requests.
  let relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  relativePath = path.normalize(relativePath);

  // Prevent path traversal outside frontend/.
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return res.status(404).end();
  }

  const filePath = path.join(frontendDir, relativePath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }

  // Browsers commonly request /favicon.ico even when the page declares an
  // SVG favicon. Serve the valid SVG asset for that legacy request.
  if (requestPath === '/favicon.ico') {
    return res.sendFile(path.join(frontendDir, 'favicon.svg'));
  }

  return res.status(404).end();
};
