const bcrypt = require('bcryptjs');
const { sql, ok, err, json, signToken, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');
  if (!checkRate(event)) return err(429, 'Too many requests');

  try {
    const b = parseBody(event);
    const { action, password, name } = b;
    const email = (b.email || '').trim().toLowerCase();
    if (!email || !password) return err(400, 'Email and password required');

    if (action === 'register') {
      if (!name) return err(400, 'Name is required');
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) return err(409, 'Email already in use');
      const hash = await bcrypt.hash(password, 12);
      const [user] = await sql`INSERT INTO users (email, password_hash, name) VALUES (${email}, ${hash}, ${name.trim()}) RETURNING id, email, name`;
      return ok({ token: signToken(user), name: user.name });
    }

    if (action === 'login') {
      const [user] = await sql`SELECT id, email, password_hash, name FROM users WHERE email = ${email}`;
      if (!user) return err(401, 'Invalid credentials');
      if (!await bcrypt.compare(password, user.password_hash)) return err(401, 'Invalid credentials');
      return ok({ token: signToken(user), name: user.name });
    }

    return err(400, 'Invalid action');
  } catch (e) {
    console.error('Auth error:', e);
    return safeErr(e);
  }
};
