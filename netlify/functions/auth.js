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

// Helper: verify admin JWT and return caller
const verifyAdmin = (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) throw { status: 401, message: 'Niet ingelogd' };
  const jwt = require('jsonwebtoken');
  let caller;
  try { caller = jwt.verify(auth.slice(7), process.env.JWT_SECRET, { issuer: 'dpm-crm' }); }
  catch { throw { status: 401, message: 'Ongeldige sessie' }; }
  if (caller.email !== ADMIN_EMAIL) throw { status: 403, message: 'Alleen admin heeft toegang' };
  return caller;
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');
  if (!checkRate(event)) return err(429, 'Too many requests');

  try {
    const b = parseBody(event);
    const { action, password, name } = b;
    const email = (b.email || '').trim().toLowerCase();

    // ── Public actions ──

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
      // Update last_login timestamp
      await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`.catch(() => {});
      return ok({ token: signToken(user), name: user.name });
    }

    // ── Password reset: request a reset code ──
    if (action === 'request_reset') {
      if (!email) return err(400, 'Email required');
      const genericMsg = 'If an account exists with that email, a reset code has been generated.';
      if (!checkResetRate(email)) return ok({ message: genericMsg });
      const [user] = await sql`SELECT id, name FROM users WHERE email = ${email}`;
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await sql`UPDATE users SET reset_token_hash = ${tokenHash}, reset_token_expires = ${expires}::timestamptz WHERE id = ${user.id}`;
        console.log(`[RESET] Code for ${email}: ${token} (expires in 15 min)`);
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

    // ── Change own password (requires current password) ──
    if (action === 'change_password') {
      if (!b.current_password || !b.new_password) return err(400, 'Current and new password required');
      if (b.new_password.length < 6) return err(400, 'Password must be at least 6 characters');
      const auth = event.headers?.authorization || event.headers?.Authorization || '';
      if (!auth.startsWith('Bearer ')) return err(401, 'Niet ingelogd');
      const jwt = require('jsonwebtoken');
      let caller;
      try { caller = jwt.verify(auth.slice(7), process.env.JWT_SECRET, { issuer: 'dpm-crm' }); }
      catch { return err(401, 'Ongeldige sessie'); }
      const [user] = await sql`SELECT id, password_hash FROM users WHERE id = ${caller.id}`;
      if (!user) return err(404, 'User not found');
      if (!await bcrypt.compare(b.current_password, user.password_hash)) return err(401, 'Current password is incorrect');
      const newHash = await bcrypt.hash(b.new_password, 12);
      await sql`UPDATE users SET password_hash = ${newHash}, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ${user.id}`;
      return ok({ changed: true });
    }

    // ══════════════════════════════════════════
    // ── Admin-only actions (all below here) ──
    // ══════════════════════════════════════════

    const adminActions = [
      'list_pending', 'list_all_users', 'approve_user', 'reject_user',
      'admin_reset', 'admin_add_user', 'admin_edit_user', 'admin_delete_user',
      'admin_suspend_user', 'admin_reactivate_user', 'admin_stats',
    ];

    if (adminActions.includes(action)) {
      const caller = verifyAdmin(event);

      // List pending (unapproved) users
      if (action === 'list_pending') {
        const pending = await sql`SELECT id, email, name, created_at FROM users WHERE approved = false ORDER BY created_at DESC`;
        return ok({ pending });
      }

      // List ALL users with full details
      if (action === 'list_all_users') {
        const users = await sql`SELECT id, email, name, approved, created_at, last_login FROM users ORDER BY name ASC`;
        return ok({ users });
      }

      // Approve a pending user
      if (action === 'approve_user') {
        if (!b.user_id) return err(400, 'user_id vereist');
        await sql`UPDATE users SET approved = true WHERE id = ${b.user_id}`;
        return ok({ approved: b.user_id });
      }

      // Reject (delete) a pending user
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

      // Admin creates a new user directly (pre-approved)
      if (action === 'admin_add_user') {
        const newEmail = (b.new_email || '').trim().toLowerCase();
        if (!newEmail || !b.new_name || !b.new_password) return err(400, 'Email, name and password required');
        if (b.new_password.length < 6) return err(400, 'Password must be at least 6 characters');
        const existing = await sql`SELECT id FROM users WHERE email = ${newEmail}`;
        if (existing.length > 0) return err(409, 'Email already in use');
        const hash = await bcrypt.hash(b.new_password, 12);
        const [user] = await sql`INSERT INTO users (email, password_hash, name, approved) VALUES (${newEmail}, ${hash}, ${b.new_name.trim()}, true) RETURNING id, email, name, approved, created_at`;
        return ok({ user });
      }

      // Admin edits a user's name or email
      if (action === 'admin_edit_user') {
        if (!b.user_id) return err(400, 'user_id vereist');
        const [target] = await sql`SELECT id, email FROM users WHERE id = ${b.user_id}`;
        if (!target) return err(404, 'Gebruiker niet gevonden');
        // Prevent changing the admin's email away from ADMIN_EMAIL
        if (target.email === ADMIN_EMAIL && b.new_email && b.new_email.trim().toLowerCase() !== ADMIN_EMAIL) {
          return err(400, 'Cannot change admin email');
        }
        const newEmail = b.new_email ? b.new_email.trim().toLowerCase() : null;
        const newName = b.new_name ? b.new_name.trim() : null;
        if (newEmail) {
          const dup = await sql`SELECT id FROM users WHERE email = ${newEmail} AND id != ${b.user_id}`;
          if (dup.length > 0) return err(409, 'Email already in use');
        }
        const [updated] = await sql`UPDATE users SET
          name = COALESCE(${newName}, name),
          email = COALESCE(${newEmail}, email)
          WHERE id = ${b.user_id} RETURNING id, email, name, approved, created_at, last_login`;
        return ok({ user: updated });
      }

      // Admin deletes a user (cannot delete self)
      if (action === 'admin_delete_user') {
        if (!b.user_id) return err(400, 'user_id vereist');
        const [target] = await sql`SELECT id, email FROM users WHERE id = ${b.user_id}`;
        if (!target) return err(404, 'Gebruiker niet gevonden');
        if (target.email === ADMIN_EMAIL) return err(400, 'Cannot delete admin account');
        // Delete user's data first (cascade), then the user
        await sql`DELETE FROM interactions WHERE user_id = ${b.user_id}`;
        await sql`DELETE FROM opp_notes WHERE opp_id IN (SELECT id FROM opportunities WHERE user_id = ${b.user_id})`;
        await sql`DELETE FROM tasks WHERE user_id = ${b.user_id}`;
        await sql`DELETE FROM opportunities WHERE user_id = ${b.user_id}`;
        await sql`DELETE FROM contacts WHERE user_id = ${b.user_id}`;
        await sql`DELETE FROM companies WHERE user_id = ${b.user_id}`;
        await sql`DELETE FROM users WHERE id = ${b.user_id}`;
        return ok({ deleted: b.user_id });
      }

      // Admin suspends (deactivates) a user
      if (action === 'admin_suspend_user') {
        if (!b.user_id) return err(400, 'user_id vereist');
        const [target] = await sql`SELECT id, email FROM users WHERE id = ${b.user_id}`;
        if (!target) return err(404, 'Gebruiker niet gevonden');
        if (target.email === ADMIN_EMAIL) return err(400, 'Cannot suspend admin account');
        await sql`UPDATE users SET approved = false WHERE id = ${b.user_id}`;
        return ok({ suspended: b.user_id });
      }

      // Admin reactivates a suspended user
      if (action === 'admin_reactivate_user') {
        if (!b.user_id) return err(400, 'user_id vereist');
        await sql`UPDATE users SET approved = true WHERE id = ${b.user_id}`;
        return ok({ reactivated: b.user_id });
      }

      // Admin dashboard stats
      if (action === 'admin_stats') {
        const [[{count: userCount}]] = await Promise.all([sql`SELECT COUNT(*)::int as count FROM users WHERE approved = true`]);
        const stats = await sql`SELECT
          (SELECT COUNT(*)::int FROM users WHERE approved = true) as total_users,
          (SELECT COUNT(*)::int FROM users WHERE approved = false) as pending_users,
          (SELECT COUNT(*)::int FROM companies) as total_companies,
          (SELECT COUNT(*)::int FROM contacts) as total_contacts,
          (SELECT COUNT(*)::int FROM opportunities) as total_deals,
          (SELECT COUNT(*)::int FROM opportunities WHERE stage NOT IN ('won','lost','dropped')) as active_deals,
          (SELECT COALESCE(SUM(value),0)::numeric FROM opportunities WHERE stage NOT IN ('lost','dropped')) as pipeline_value,
          (SELECT COUNT(*)::int FROM tasks WHERE done = false) as open_tasks,
          (SELECT COUNT(*)::int FROM interactions) as total_interactions`;
        return ok({ stats: stats[0] });
      }
    }

    return err(400, 'Invalid action');
  } catch (e) {
    console.error('Auth error:', e);
    return safeErr(e);
  }
};
