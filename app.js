// Root entrypoint for hosts such as Render.
// Keep a single Express application so API routes, CORS, database handling,
// static frontend files, and guest authentication all use backend/server.js.
module.exports = require('./backend/server');
