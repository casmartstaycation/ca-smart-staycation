const path = require('path');
const fs = require('fs');
const app = require('../backend/server');

module.exports = (req, res) => {
  const originalUrl = String(req.url || '/');
  const requestPath = originalUrl.split('?')[0];
  const query = originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '';

  const isFrontendRequest = requestPath === '/api/frontend' || requestPath.startsWith('/api/frontend/');
  const isApiRequest = !isFrontendRequest && (
    requestPath === '/api' || requestPath.startsWith('/api/') ||
    requestPath === '/health' || requestPath.startsWith('/health/') ||
    requestPath === '/rooms' || requestPath.startsWith('/rooms/') ||
    requestPath === '/bookings' || requestPath.startsWith('/bookings/')
  );

  if (isApiRequest) {
    const apiPath = requestPath === '/api' || requestPath.startsWith('/api/')
      ? requestPath
      : `/api${requestPath === '/' ? '' : requestPath}`;
    req.url = apiPath + query;
    return app(req, res);
  }

  const frontendRoot = path.resolve(__dirname, '..', 'frontend');
  const frontendPath = isFrontendRequest
    ? requestPath.replace(/^\/api\/frontend\/?/, '')
    : requestPath.replace(/^\/+/, '');
  const relativePath = frontendPath || 'index.html';
  const requestedFile = path.resolve(frontendRoot, relativePath);

  if (!requestedFile.startsWith(frontendRoot + path.sep) && requestedFile !== frontendRoot) {
    return res.status(400).json({ status: 'error', message: 'Invalid path' });
  }

  const filePath = fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()
    ? requestedFile
    : path.join(frontendRoot, 'index.html');

  return res.sendFile(filePath);
};
