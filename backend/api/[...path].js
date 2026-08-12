const app = require('../server');

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = new Set([
    'https://casmartstaycation.com',
    'https://www.casmartstaycation.com'
  ]);

  // Also allow Vercel preview/deployment origins when testing.
  const isVercelOrigin = origin && /^https:\/\/[-a-z0-9]+\.vercel\.app$/i.test(origin);

  if (origin && (allowed.has(origin) || isVercelOrigin)) {
    // Set standard CORS response headers. These are applied early so they
    // are present on any response produced by the function (including errors
    // or programmatic redirects created within the function).
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');

    // Helpful preflight and caching controls
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Location');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
}

module.exports = (req, res) => {
  applyCors(req, res);

  // Handle browser CORS preflight before Express routing.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Vercel catch-all functions receive the path without the /api prefix.
  // The Express application defines its API routes with /api, so restore
  // that prefix before handing the request to Express.
  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  }

  return app(req, res);
};
