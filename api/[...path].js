const app = require('../backend/server');

// Vercel routes /api/* here. Keep the Express application responsible for
// every API endpoint, including /api/rooms, while frontend files are routed
// directly by vercel.json to /frontend/*.
module.exports = (req, res) => app(req, res);
