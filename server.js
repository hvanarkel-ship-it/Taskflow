require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load all API handlers
const fns = {
  auth:          require('./api/auth'),
  companies:     require('./api/companies'),
  contacts:      require('./api/contacts'),
  opportunities: require('./api/opportunities'),
  tasks:         require('./api/tasks'),
  atos:          require('./api/atos'),
  interactions:  require('./api/interactions'),
  checklist:     require('./api/checklist'),
  health:        require('./api/health'),
  backup:        require('./api/backup'),
  ai:            require('./api/ai'),
  sync:          require('./api/sync'),
};

// Adapter: converts Express req/res to handler event format
const adapt = (fn) => async (req, res) => {
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    queryStringParameters: req.query || {},
    body: req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : (req.body || null),
    path: req.path,
  };
  try {
    const result = await fn.handler(event, {});
    if (result.headers) Object.entries(result.headers).forEach(([k, v]) => res.set(k, v));
    res.status(result.statusCode || 200).send(result.body || '');
  } catch (e) {
    console.error('Handler error:', e.message, e.stack);
    res.status(500).json({ success: false, error: e.message || 'Er ging iets mis' });
  }
};

// Register all /api/* routes
Object.entries(fns).forEach(([name, fn]) => app.all(`/api/${name}`, adapt(fn)));
app.get('/health', adapt(fns.health));

// SPA fallback — all other routes serve index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Error handler for body-parser / middleware errors (must have 4 params)
app.use((err, req, res, next) => {
  console.error('Express middleware error:', err.type || err.status, err.message);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Verzoek te groot (max 2MB)' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Ongeldig JSON verzoek' });
  }
  res.status(err.status || 500).json({ success: false, error: err.message || 'Server error' });
});

// Prevent Node from crashing on unhandled DB / async errors
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (server keeps running):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server keeps running):', err.message);
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`\n✅ My Personal Sales Plan`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`   Database: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@') || 'not set'}`);
  console.log(`   JWT: ${process.env.JWT_SECRET ? 'configured' : '⚠️  not set'}\n`);
});
