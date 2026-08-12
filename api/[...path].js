const path = require('path');
const fs = require('fs');
const app = require('../backend/server');

// Vercel can send the project root through this catch-all function on an
// Express project. Keep /api/* on Express, but serve the real website and
// its static assets here so the API health response can never replace /.
const frontendRoot = path.join(__dirname, '..', 'frontend');

function serveFrontend(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
    pathname = decodeURIComponent(pathname);
  } catch (_) {
    pathname = '/';
  }

  if (pathname === '/favicon.ico') pathname = '/favicon.svg';
  if (pathname === '/') pathname = '/index.html';

  const candidate = path.resolve(frontendRoot, `.${pathname}`);
  if (!candidate.startsWith(frontendRoot + path.sep) && candidate !== frontendRoot) {
    return res.status(400).send('Bad request');
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return res.sendFile(candidate);
  }

  // Keep client-side routes on the landing page instead of returning the API.
  if (!path.extname(pathname)) {
    const indexFile = path.join(frontendRoot, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  }

  return res.status(404).send('Not Found');
}

module.exports = (req, res) => {
  const pathname = (() => {
    try { return new URL(req.url || '/', 'http://localhost').pathname; }
    catch (_) { return '/'; }
  })();

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return app(req, res);
  }

  return serveFrontend(req, res);
};
