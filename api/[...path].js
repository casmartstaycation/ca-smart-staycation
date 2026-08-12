const path = require('path');
const fs = require('fs');
const app = require('../backend/server');

module.exports = (req, res) => {
  const originalUrl = String(req.url || '/');
  const requestPath = originalUrl.split('?')[0];

  if (requestPath === '/api' || requestPath.startsWith('/api/')) {
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
