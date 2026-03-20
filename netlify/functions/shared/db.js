// ═══════════════════════════════════════════════════════
// Shared DB + Auth helpers — Production-grade
// ═══════════════════════════════════════════════════════
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

// ─── Connection validation ──────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error('⚠️ DATABASE_URL not configured');
}
if (!process.env.JWT_SECRET) {
  console.error('⚠️ JWT_SECRET not configured');
}

const sql = neon(process.env.DATABASE_URL || 'postgresql://invalid');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-not-for-production';

// ─── CORS origin (restrict in production) ───────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

const getCorsOrigin = (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '*';
  if (ALLOWED_ORIGINS.includes('*')) return '*';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
};

// ─── Response helpers ───────────────────────────────────
const json = (statusCode, body, event = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const ok = (data, event) => json(200, { success: true, ...data }, event);
const err = (status, message, event) => json(status, { success: false, error: message }, event);

// ─── Auth helpers ───────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d', issuer: 'taskflow-pro' }
  );

const verifyToken = (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET, { issuer: 'taskflow-pro' });
  } catch {
    return null;
  }
};

const requireAuth = (event) => {
  const user = verifyToken(event);
  if (!user) throw { status: 401, message: 'Niet ingelogd' };
  return user;
};

module.exports = { sql, json, ok, err, signToken, verifyToken, requireAuth };
