const jwt = require('jsonwebtoken');
const postgres = require('postgres');

if (!process.env.DATABASE_URL) { console.error('FATAL: DATABASE_URL not set'); }
if (!process.env.JWT_SECRET) { console.error('FATAL: JWT_SECRET not set'); }

let sql = null;
if (process.env.DATABASE_URL) {
  const pg = postgres(process.env.DATABASE_URL, { ssl: false, max: 5 });
  sql = (strings, ...values) => pg(strings, ...values);
}

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

const requireAuth = async (event) => {
  if (!JWT_SECRET) throw { status: 500, message: 'Server configuratie fout' };
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) throw { status: 401, message: 'Niet ingelogd' };
  let decoded;
  try { decoded = jwt.verify(auth.slice(7), JWT_SECRET, { issuer: 'dpm-crm' }); }
  catch { throw { status: 401, message: 'Ongeldige sessie' }; }
  const [dbUser] = await sql`SELECT id, approved FROM users WHERE id = ${decoded.id}`;
  if (!dbUser) throw { status: 401, message: 'Gebruiker niet gevonden' };
  if (!dbUser.approved) throw { status: 403, message: 'Account niet goedgekeurd' };
  return decoded;
};

// Safe body parser with size limit (100KB)
const parseBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > 1048576) throw { status: 413, message: 'Verzoek te groot (max 1MB)' };
  try { return JSON.parse(event.body); }
  catch { throw { status: 400, message: 'Ongeldig verzoek' }; }
};

// Safe error handler — surfaces DB constraint errors, hides internals
const safeErr = (e) => {
  if (e.status) return err(e.status, e.message);
  const msg = e.message || '';
  console.error('Internal error:', msg);
  if (msg.includes('column') && msg.includes('does not exist')) return err(500, 'Database schema out of date — run db:setup');
  if (msg.includes('violates foreign key')) return err(400, 'Ongeldige referentie (FK fout)');
  if (msg.includes('invalid input syntax')) return err(400, 'Ongeldig veld formaat');
  if (msg.includes('duplicate key')) return err(409, 'Record bestaat al');
  return err(500, 'Er ging iets mis');
};

module.exports = { sql, json, ok, err, signToken, requireAuth, checkRate, parseBody, safeErr };
