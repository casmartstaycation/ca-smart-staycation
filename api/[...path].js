const path = require('path');
const fs = require('fs');
const app = require('../backend/server');

const frontendRoot = path.join(__dirname, '..', 'frontend');

function getPath(req) {
  try {
    return decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch (_) {
    return '/';
  }
}

function serveFrontend(req, res) {
  let pathname = getPath(req);
  if (pathname === '/favicon.ico') pathname = '/favicon.svg';
  if (pathname === '/') pathname = '/index.html';
  const candidate = path.resolve(frontendRoot, `.${pathname}`);
  if (!candidate.startsWith(frontendRoot + path.sep) && candidate !== frontendRoot) return res.status(400).send('Bad request');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return res.sendFile(candidate);
  if (!path.extname(pathname)) {
    const indexFile = path.join(frontendRoot, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  }
  return res.status(404).send('Not Found');
}

module.exports = (req, res) => {
  const pathname = getPath(req);

  // This file lives under /api. Depending on Vercel's function adapter,
  // req.url may arrive as /settings instead of /api/settings. Normalize it
  // before handing the request to Express, whose routes are mounted at /api.
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return app(req, res);
  }

  // A request reaching this function is an API function invocation. Restore
  // the /api prefix when Vercel has stripped it from req.url.
  req.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  return app(req, res);
};
