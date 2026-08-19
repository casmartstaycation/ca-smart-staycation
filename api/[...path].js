const path = require('path');
const fs = require('fs');

let app;
function getBackendApp() {
  if (!app) app = require('../backend/server');
  return app;
}

const allowedApiOrigins = new Set([
  'https://casmartstaycation.github.io',
  'https://www.casmartstaycation.com',
  'https://casmartstaycation.com',
  'http://localhost:3000',
  'http://localhost:5173'
]);

function applyApiCors(req, res) {
  const origin = String(req.headers.origin || '');
  if (origin && allowedApiOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control');
}

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
    applyApiCors(req, res);

    const origin = String(req.headers.origin || '');
    if (req.method === 'OPTIONS') {
      if (origin && !allowedApiOrigins.has(origin)) return res.status(403).end();
      return res.status(204).end();
    }

    const apiPath = requestPath === '/api' || requestPath.startsWith('/api/')
      ? requestPath
      : `/api${requestPath === '/' ? '' : requestPath}`;
    req.url = apiPath + query;
    return getBackendApp()(req, res);
  }

  const frontendRoot = path.resolve(__dirname, '..', 'frontend');
  let frontendPath = isFrontendRequest
    ? requestPath.replace(/^\/api\/frontend\/?/, '')
    : requestPath.replace(/^\/+/, '');

  // Legacy guest portal asset paths: older guest pages referenced
  // /guest-booking/css/style.css while the shared stylesheet lives at /css/style.css.
  if (frontendPath.startsWith('guest-booking/css/')) {
    frontendPath = frontendPath.replace(/^guest-booking\/css\//, 'css/');
  }

  const relativePath = frontendPath || 'index.html';
  const requestedFile = path.resolve(frontendRoot, relativePath);

  if (!requestedFile.startsWith(frontendRoot + path.sep) && requestedFile !== frontendRoot) {
    return res.status(400).json({ status: 'error', message: 'Invalid path' });
  }

  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    return res.sendFile(requestedFile);
  }

  // Never return index.html for a missing CSS/JS/image/font/document asset.
  // Doing so makes the browser report the asset as text/html and blocks it
  // under strict MIME checking.
  const assetExtensions = /\.(?:css|js|mjs|json|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf|mp4|webm|wav|mp3)$/i;
  if (assetExtensions.test(requestPath)) {
    return res.status(404).json({ status: 'error', message: 'Asset not found' });
  }

  // Preserve the existing SPA fallback for normal document navigation.
  return res.sendFile(path.join(frontendRoot, 'index.html'));
};
