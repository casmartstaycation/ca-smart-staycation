const app = require('../server');

module.exports = (req, res) => {
  // Vercel catch-all functions receive the path without the /api prefix.
  // The Express application defines its API routes with /api, so restore
  // that prefix before handing the request to Express.
  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  }
  return app(req, res);
};
