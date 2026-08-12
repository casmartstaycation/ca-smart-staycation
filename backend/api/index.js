const app = require('../server');

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = new Set([
    'https://casmartstaycation.com',
    'https://www.casmartstaycation.com'
  ]);
  const isVercelOrigin = origin && /^https:\/\/[-a-z0-9]+\.vercel\.app$/i.test(origin);

  if (origin && (allowed.has(origin) || isVercelOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');

    // Add some helpful CORS headers for preflight caching and exposed headers.
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Location');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
}

module.exports = (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return app(req, res);
};
