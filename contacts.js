const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

// Fail hard if env vars are missing in production
if (!process.env.DATABASE_URL) { console.error('FATAL: DATABASE_URL not set'); }
if (!process.env.JWT_SECRET) { console.error('FATAL: JWT_SECRET not set'); }

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const JWT_SECRET = process.env.JWT_SECRET;

// Rate limiting: simple in-memory tracker (resets per function cold start)
const rateMap = new Map();
const RATE_LIMIT = 120; // requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute

const checkRate = (event) => {
  const ip = event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || 'unknown';
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, reset: now + RATE_WINDOW };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + RATE_WINDOW; }
  entry.count++;
  rateMap.set(ip, entry);
  if (entry.count > RATE_LIMIT) return false;
  return true;
};

const json = (sc, body) => ({
  statusCode: sc,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const ok = (data) => json(200, { success: true, ...data });
const err = (sc, msg) => json(sc, { success: false, error: msg });

const signToken = (user) => {
  if (!JWT_SECRET) throw { status: 500, message: 'Server configuratie fout' };
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d', issuer: 'dpm-crm' });
};

const requireAuth = (event) => {
  if (!JWT_SECRET) throw { status: 500, message: 'Server configuratie fout' };
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) throw { status: 401, message: 'Niet ingelogd' };
  try { return jwt.verify(auth.slice(7), JWT_SECRET, { issuer: 'dpm-crm' }); }
  catch { throw { status: 401, message: 'Ongeldige sessie' }; }
};

// Safe body parser with size limit (100KB)
const parseBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > 102400) throw { status: 413, message: 'Verzoek te groot' };
  try { return JSON.parse(event.body); }
  catch { throw { status: 400, message: 'Ongeldig verzoek' }; }
};

// Safe error handler — never expose internals
const safeErr = (e) => {
  if (e.status) return err(e.status, e.message);
  console.error('Internal error:', e.message);
  return err(500, 'Er ging iets mis');
};

module.exports = { sql, json, ok, err, signToken, requireAuth, checkRate, parseBody, safeErr };
