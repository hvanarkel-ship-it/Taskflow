// ═══════════════════════════════════════════════════════
// Shared DB + Auth helpers for all Netlify Functions
// ═══════════════════════════════════════════════════════
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET;

// ─── Response helpers ───────────────────────────────────
const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: JSON.stringify(body),
});

const ok = (data) => json(200, { success: true, ...data });
const err = (status, message) => json(status, { success: false, error: message });

// ─── Auth helpers ───────────────────────────────────────
const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });

const verifyToken = (event) => {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
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
