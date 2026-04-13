require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load all API handlers (Netlify function format)
const fns = {
  auth:          require('./netlify/functions/auth'),
  companies:     require('./netlify/functions/companies'),
  contacts:      require('./netlify/functions/contacts'),
  opportunities: require('./netlify/functions/opportunities'),
  tasks:         require('./netlify/functions/tasks'),
  atos:          require('./netlify/functions/atos'),
  interactions:  require('./netlify/functions/interactions'),
  checklist:     require('./netlify/functions/checklist'),
  health:        require('./netlify/functions/health'),
  backup:        require('./netlify/functions/backup'),
  ai:            require('./netlify/functions/ai'),
  sync:          require('./netlify/functions/sync'),
};

// Adapter: converts Express req/res to Netlify handler format
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
    const msg = e.message || 'Er ging iets mis';
    res.status(500).json({ success: false, error: msg });
  }
};

// Register all /api/* routes
Object.entries(fns).forEach(([name, fn]) => app.all(`/api/${name}`, adapt(fn)));
app.get('/health', adapt(fns.health));

// SPA fallback — all other routes serve index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`\n✅ My Personal Sales Plan`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`   Database: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@') || 'not set'}`);
  console.log(`   JWT: ${process.env.JWT_SECRET ? 'configured' : '⚠️  not set'}\n`);
});
