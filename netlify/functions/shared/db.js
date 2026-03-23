const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

if (!process.env.DATABASE_URL) console.error('⚠️ DATABASE_URL not set');
if (!process.env.JWT_SECRET) console.error('⚠️ JWT_SECRET not set');

const sql = neon(process.env.DATABASE_URL || 'postgresql://invalid');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback';

const json = (sc, body, ev = {}) => ({
  statusCode: sc,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const ok = (data) => json(200, { success: true, ...data });
const err = (sc, msg) => json(sc, { success: false, error: msg });

const signToken = (user) => jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d', issuer: 'dpm-crm' });

const requireAuth = (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) throw { status: 401, message: 'Niet ingelogd' };
  try { return jwt.verify(auth.slice(7), JWT_SECRET, { issuer: 'dpm-crm' }); }
  catch { throw { status: 401, message: 'Ongeldige sessie' }; }
};

module.exports = { sql, json, ok, err, signToken, requireAuth };
