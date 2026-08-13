const path = require('path');
const fs = require('fs');
const app = require('../backend/server');

module.exports = (req, res) => {
  const originalUrl = String(req.url || '/');
  const requestPath = originalUrl.split('?')[0];

  // Vercel catch-all functions may receive the path without the /api prefix.
  // Express is configured with /api routes, so normalize it before handing
  // API requests to the backend. This prevents /api/health from falling into
  // the frontend fallback and returning the wrong JSON response.
  const apiPath = requestPath === '/api' || requestPath.startsWith('/api/')
    ? requestPath
    : `/api${requestPath === '/' ? '' : requestPath}`;

  if (requestPath === '/api' || requestPath.startsWith('/api/') || requestPath === '/health' || requestPath.startsWith('/health/') || requestPath === '/rooms' || requestPath.startsWith('/rooms/') || requestPath === '/bookings' || requestPath.startsWith('/bookings/')) {
    req.url = apiPath + (originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '');
    return app(req, res);
  }

  const relativePath = requestPath.replace(/^\/+/, '') || 'index.html';
  const frontendRoot = path.join(process.cwd(), 'frontend');
  const requestedFile = path.normalize(path.join(frontendRoot, relativePath));

  if (!requestedFile.startsWith(frontendRoot + path.sep) && requestedFile !== frontendRoot) {
    return res.status(400).json({ status: 'error', message: 'Invalid path' });
  }

  const filePath = fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()
    ? requestedFile
    : path.join(frontendRoot, 'index.html');

  return res.sendFile(filePath);
};
