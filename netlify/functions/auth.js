const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sql, ok, err, json, signToken, checkRate, parseBody, safeErr } = require('./shared/db');

const ADMIN_EMAIL = 'hvanarkel@gmail.com';

// Separate rate limiter for password resets: max 3 per hour per email
const resetRateMap = new Map();
const checkResetRate = (email) => {
  const now = Date.now();
  const entry = resetRateMap.get(email) || { count: 0, reset: now + 3600000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 3600000; }
  entry.count++;
  resetRateMap.set(email, entry);
  return entry.count <= 3;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');
  if (!checkRate(event)) return err(429, 'Too many requests');

  try {
    const b = parseBody(event);
    const { action, password, name } = b;
    const email = (b.email || '').trim().toLowerCase();

    if (action === 'register') {
      if (!email || !password) return err(400, 'Email and password required');
      if (!name) return err(400, 'Name is required');
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) return err(409, 'Email already in use');
      const hash = await bcrypt.hash(password, 12);
      const isAdmin = email === ADMIN_EMAIL;
      const [user] = await sql`INSERT INTO users (email, password_hash, name, approved) VALUES (${email}, ${hash}, ${name.trim()}, ${isAdmin}) RETURNING id, email, name, approved`;

      if (!isAdmin && process.env.APPROVAL_WEBHOOK) {
        try {
          await fetch(process.env.APPROVAL_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: `Nieuwe registratie in DPM CRM: ${name.trim()} (${email}). Log in om goed te keuren.` }),
          });
        } catch (e) { console.error('Webhook notification failed:', e.message); }
      }

      if (isAdmin) {
        return ok({ token: signToken(user), name: user.name });
      }
      return json(200, { success: true, pending: true });
    }

    if (action === 'login') {
      if (!email || !password) return err(400, 'Email and password required');
      const [user] = await sql`SELECT id, email, password_hash, name, approved FROM users WHERE email = ${email}`;
      if (!user) return err(401, 'Invalid credentials');
      if (!await bcrypt.compare(password, user.password_hash)) return err(401, 'Invalid credentials');
      if (!user.approved) return json(200, { success: true, pending: true });
      return ok({ token: signToken(user), name: user.name });
    }

    // ── Password reset: request a reset code ──
    if (action === 'request_reset') {
      if (!email) return err(400, 'Email required');
      // Always return the same response to prevent email enumeration
      const genericMsg = 'If an account exists with that email, a reset code has been generated.';
      if (!checkResetRate(email)) return ok({ message: genericMsg });
      const [user] = await sql`SELECT id, name FROM users WHERE email = ${email}`;
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await sql`UPDATE users SET reset_token_hash = ${tokenHash}, reset_token_expires = ${expires}::timestamptz WHERE id = ${user.id}`;
        // Log the code — visible in Netlify function logs for the admin
        console.log(`[RESET] Code for ${email}: ${token} (expires in 15 min)`);
        // Webhook notification if configured
        if (process.env.APPROVAL_WEBHOOK) {
          try {
            await fetch(process.env.APPROVAL_WEBHOOK, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: `Wachtwoord reset code voor ${user.name} (${email}): ${token}\nGeldig voor 15 minuten.` }),
            });
          } catch (e) { console.error('Webhook failed:', e.message); }
        }
      }
      return ok({ message: genericMsg });
    }

    // ── Password reset: verify code and set new password ──
    if (action === 'reset_password') {
      if (!b.token || !b.new_password) return err(400, 'Reset code and new password required');
      if (b.new_password.length < 6) return err(400, 'Password must be at least 6 characters');
      const tokenHash = hashToken(b.token);
      const [user] = await sql`SELECT id FROM users WHERE reset_token_hash = ${tokenHash} AND reset_token_expires > NOW()`;
      if (!user) return err(400, 'Invalid or expired reset code');
      const newHash = await bcrypt.hash(b.new_password, 12);
      await sql`UPDATE users SET password_hash = ${newHash}, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ${user.id}`;
      return ok({ reset: true });
    }

    // ── Admin actions ──
    if (action === 'list_pending' || action === 'list_approved' || action === 'approve_user' || action === 'reject_user' || action === 'admin_reset') {
      const auth = event.headers?.authorization || event.headers?.Authorization || '';
      if (!auth.startsWith('Bearer ')) return err(401, 'Niet ingelogd');
      const jwt = require('jsonwebtoken');
      let caller;
      try { caller = jwt.verify(auth.slice(7), process.env.JWT_SECRET, { issuer: 'dpm-crm' }); }
      catch { return err(401, 'Ongeldige sessie'); }
      if (caller.email !== ADMIN_EMAIL) return err(403, 'Alleen admin heeft toegang');

      if (action === 'list_pending') {
        const pending = await sql`SELECT id, email, name, created_at FROM users WHERE approved = false ORDER BY created_at DESC`;
        return ok({ pending });
      }

      if (action === 'list_approved') {
        const users = await sql`SELECT id, email, name, created_at FROM users WHERE approved = true ORDER BY name ASC`;
        return ok({ users });
      }

      if (action === 'approve_user') {
        if (!b.user_id) return err(400, 'user_id vereist');
        await sql`UPDATE users SET approved = true WHERE id = ${b.user_id}`;
        return ok({ approved: b.user_id });
      }

      if (action === 'reject_user') {
        if (!b.user_id) return err(400, 'user_id vereist');
        await sql`DELETE FROM users WHERE id = ${b.user_id} AND approved = false`;
        return ok({ rejected: b.user_id });
      }

      // Admin generates a reset code for any user
      if (action === 'admin_reset') {
        if (!b.user_id) return err(400, 'user_id vereist');
        const [target] = await sql`SELECT id, email, name FROM users WHERE id = ${b.user_id}`;
        if (!target) return err(404, 'Gebruiker niet gevonden');
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await sql`UPDATE users SET reset_token_hash = ${tokenHash}, reset_token_expires = ${expires}::timestamptz WHERE id = ${target.id}`;
        console.log(`[ADMIN RESET] Code for ${target.email}: ${token}`);
        return ok({ reset_code: token, email: target.email, name: target.name });
      }
    }

    return err(400, 'Invalid action');
  } catch (e) {
    console.error('Auth error:', e);
    return safeErr(e);
  }
};
