const path = require('path');
const fs = require('fs');

let app;
let bootstrapError = null;

function getBackendApp() {
  if (app) return app;
  if (bootstrapError) throw bootstrapError;

  try {
    app = require('../backend/server');
    return app;
  } catch (error) {
    bootstrapError = error;
    console.error('[CA Smart Staycation] Vercel API bootstrap failed:', error);
    throw error;
  }
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
  res.setHeader('Cache-Control', 'no-store');
}

function sendBootstrapError(res, error) {
  const message = String(error && error.message ? error.message : error || 'Unknown backend startup error');
  const code = error && error.code ? String(error.code) : 'API_BOOTSTRAP_FAILED';

  if (!res.headersSent) {
    return res.status(500).json({
      success: false,
      code: 'API_BOOTSTRAP_FAILED',
      errorCode: code,
      message: 'The Vercel API function could not start the backend.',
      detail: message
    });
  }

  return res.end();
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

    try {
      return getBackendApp()(req, res);
    } catch (error) {
      return sendBootstrapError(res, error);
    }
  }

  const frontendRoot = path.resolve(__dirname, '..', 'frontend');
  let frontendPath = isFrontendRequest
    ? requestPath.replace(/^\/api\/frontend\/?/, '')
    : requestPath.replace(/^\/+/, '');

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

  const assetExtensions = /\.(?:css|js|mjs|json|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf|mp4|webm|wav|mp3)$/i;
  if (assetExtensions.test(requestPath)) {
    return res.status(404).json({ status: 'error', message: 'Asset not found' });
  }

  return res.sendFile(path.join(frontendRoot, 'index.html'));
};
