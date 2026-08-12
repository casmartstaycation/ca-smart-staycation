const path = require('path');
const app = require('../backend/server');

// Vercel's catch-all function is currently receiving the site root. Serve the
// real frontend entry point there, while keeping every API request on Express.
module.exports = (req, res) => {
  const requestPath = String(req.url || '').split('?')[0];
  if (requestPath === '/' || requestPath === '/index.html') {
    return res.sendFile(path.join(process.cwd(), 'frontend', 'index.html'));
  }
  return app(req, res);
};
