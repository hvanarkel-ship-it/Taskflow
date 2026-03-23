const bcrypt = require('bcryptjs');
const { sql, ok, err, json, signToken } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  try {
    const { action, email, password, name } = JSON.parse(event.body);
    if (!email || !password) return err(400, 'Email en wachtwoord vereist');

    if (action === 'register') {
      if (!name) return err(400, 'Naam is vereist');
      const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
      if (existing.length > 0) return err(409, 'Email al in gebruik');
      const hash = await bcrypt.hash(password, 12);
      const [user] = await sql`INSERT INTO users (email, password_hash, name) VALUES (${email.toLowerCase()}, ${hash}, ${name}) RETURNING id, email, name`;
      return ok({ token: signToken(user), user });
    }

    if (action === 'login') {
      const [user] = await sql`SELECT id, email, password_hash, name FROM users WHERE email = ${email.toLowerCase()}`;
      if (!user) return err(401, 'Ongeldige inloggegevens');
      if (!await bcrypt.compare(password, user.password_hash)) return err(401, 'Ongeldige inloggegevens');
      return ok({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name } });
    }

    return err(400, 'Ongeldige actie');
  } catch (e) {
    if (e.status) return err(e.status, e.message);
    console.error('Auth error:', e);
    return err(500, 'Server error');
  }
};
