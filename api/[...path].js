const path = require('path');
const fs = require('fs');
const app = require('../backend/server');

module.exports = (req, res) => {
  const originalUrl = String(req.url || '/');
  const requestPath = originalUrl.split('?')[0];

  const isApiRequest = requestPath === '/api' || requestPath.startsWith('/api/') || requestPath === '/health' || requestPath.startsWith('/health/') || requestPath === '/rooms' || requestPath.startsWith('/rooms/') || requestPath === '/bookings' || requestPath.startsWith('/bookings/');

  if (isApiRequest) {
    const apiPath = requestPath === '/api' || requestPath.startsWith('/api/')
      ? requestPath
      : `/api${requestPath === '/' ? '' : requestPath}`;
    req.url = apiPath + (originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '');
    return app(req, res);
  }

  // Serve the existing frontend directory directly. This avoids depending on
  // Vercel's build output or Express's working-directory assumptions.
  const frontendRoot = path.resolve(__dirname, '..', 'frontend');
  const relativePath = requestPath.replace(/^\/+/, '');
  const requestedFile = path.resolve(frontendRoot, relativePath || 'index.html');

  if (!requestedFile.startsWith(frontendRoot + path.sep) && requestedFile !== frontendRoot) {
    return res.status(400).json({ status: 'error', message: 'Invalid path' });
  }

  const filePath = fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()
    ? requestedFile
    : path.join(frontendRoot, 'index.html');

  return res.sendFile(filePath);
};
