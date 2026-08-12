const path = require('path');
const fs = require('fs');
const app = require('../backend/server');

// Vercel catch-all: keep /api/* on Express and serve the frontend for every
// non-API request. This makes the Render backup work correctly on Vercel even
// when the rewrite engine sends the request through this function.
module.exports = (req, res) => {
  const requestPath = String(req.url || '/').split('?')[0];

  if (requestPath === '/api' || requestPath.startsWith('/api/')) {
    return app(req, res);
  }

  const relativePath = requestPath.replace(/^\/+/, '') || 'index.html';
  const frontendRoot = path.join(process.cwd(), 'frontend');
  const requestedFile = path.normalize(path.join(frontendRoot, relativePath));

  // Prevent path traversal outside frontend/.
  if (!requestedFile.startsWith(frontendRoot + path.sep) && requestedFile !== frontendRoot) {
    return res.status(400).json({ status: 'error', message: 'Invalid path' });
  }

  // / and unknown frontend routes should load the landing page.
  const filePath = fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()
    ? requestedFile
    : path.join(frontendRoot, 'index.html');

  return res.sendFile(filePath);
};
