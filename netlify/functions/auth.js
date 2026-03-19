// ═══════════════════════════════════════════════════════
// POST /api/auth  { action: "register"|"login", email, password, name? }
// ═══════════════════════════════════════════════════════
const bcrypt = require('bcryptjs');
const { sql, ok, err, json, signToken } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  try {
    const { action, email, password, name } = JSON.parse(event.body);

    if (!email || !password) return err(400, 'Email en wachtwoord vereist');

    // ─── REGISTER ─────────────────────────────────────
    if (action === 'register') {
      if (!name) return err(400, 'Naam is vereist');

      const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
      if (existing.length > 0) return err(409, 'Email is al in gebruik');

      const hash = await bcrypt.hash(password, 12);
      const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const colors = ['#6c5ce7', '#00d2a0', '#00b4d8', '#e77cd2', '#ffa64d'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      const [user] = await sql`
        INSERT INTO users (email, password_hash, name, initials, color)
        VALUES (${email.toLowerCase()}, ${hash}, ${name}, ${initials}, ${color})
        RETURNING id, email, name, initials, color
      `;

      const token = signToken(user);
      return ok({ token, user: { id: user.id, email: user.email, name: user.name, initials: user.initials, color: user.color } });
    }

    // ─── LOGIN ────────────────────────────────────────
    if (action === 'login') {
      const [user] = await sql`
        SELECT id, email, password_hash, name, initials, color
        FROM users WHERE email = ${email.toLowerCase()}
      `;
      if (!user) return err(401, 'Ongeldige inloggegevens');

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return err(401, 'Ongeldige inloggegevens');

      const token = signToken(user);
      return ok({ token, user: { id: user.id, email: user.email, name: user.name, initials: user.initials, color: user.color } });
    }

    return err(400, 'Ongeldige actie');
  } catch (e) {
    if (e.status) return err(e.status, e.message);
    console.error('Auth error:', e);
    return err(500, 'Server error');
  }
};
