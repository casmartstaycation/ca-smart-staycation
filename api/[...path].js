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
  if (!candidate.startsWith(frontendRoot + path.sep) && candidate !== frontendRoot) {
    return res.status(400).send('Bad request');
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return res.sendFile(candidate);
  }

  if (!path.extname(pathname)) {
    const indexFile = path.join(frontendRoot, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  }

  return res.status(404).send('Not Found');
}

module.exports = (req, res) => {
  const pathname = getPath(req);

  // Vercel catch-all functions can receive the path with /api removed.
  // Always restore /api before passing the request to Express so routes such
  // as /api/settings, /api/rooms, /api/parking and /api/bookings resolve.
  const isApiRequest = pathname === '/api' || pathname.startsWith('/api/');
  if (isApiRequest) return app(req, res);

  // If Vercel stripped the /api prefix before invoking this catch-all, the
  // function cannot distinguish it from a frontend path. API requests are
  // routed through the dedicated backend/api function in that case.
  return serveFrontend(req, res);
};
