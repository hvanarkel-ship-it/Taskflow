const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Too many requests');

  try {
    const user = await requireAuth(event);
    if (!sql) return err(503, 'Database not configured');

    // GET = export backup
    if (event.httpMethod === 'GET') {
      const [companies, contacts, opportunities, tasks, atos_team, opp_notes, interactions] = await Promise.all([
        sql`SELECT * FROM companies WHERE user_id = ${user.id}`,
        sql`SELECT * FROM contacts WHERE user_id = ${user.id}`,
        sql`SELECT * FROM opportunities WHERE user_id = ${user.id}`,
        sql`SELECT * FROM tasks WHERE user_id = ${user.id}`,
        sql`SELECT * FROM atos_team WHERE user_id = ${user.id}`,
        sql`SELECT n.* FROM opp_notes n JOIN opportunities o ON n.opp_id = o.id WHERE o.user_id = ${user.id}`,
        sql`SELECT * FROM interactions WHERE user_id = ${user.id}`,
      ]);

      return ok({
        backup: {
          companies, contacts, opportunities, tasks, atos_team, opp_notes, interactions,
          exported_at: new Date().toISOString(),
          user_id: user.id,
          user_email: user.email,
        }
      });
    }

    // POST = restore backup
    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      const b = body.backup;
      if (!b) return err(400, 'No backup data provided');

      // Safety: snapshot current data counts before deleting
      const [countRow] = await sql`SELECT
        (SELECT count(*) FROM companies WHERE user_id=${user.id})::int AS cos,
        (SELECT count(*) FROM contacts WHERE user_id=${user.id})::int AS cts,
        (SELECT count(*) FROM opportunities WHERE user_id=${user.id})::int AS ops,
        (SELECT count(*) FROM tasks WHERE user_id=${user.id})::int AS tks`;
      const existingTotal = (countRow?.cos||0)+(countRow?.cts||0)+(countRow?.ops||0)+(countRow?.tks||0);
      const incomingTotal = (b.companies||[]).length+(b.contacts||[]).length+(b.opportunities||[]).length+(b.tasks||[]).length;
      // Refuse restore if incoming data is drastically smaller (>80% loss) unless explicitly forced
      if (existingTotal > 10 && incomingTotal < existingTotal * 0.2 && !body.force) {
        return err(400, `Restore geweigerd: huidige data heeft ${existingTotal} records, backup heeft er maar ${incomingTotal}. Gebruik force=true om toch door te gaan.`);
      }

      // Delete existing data in correct order (respecting FK constraints)
      await sql`DELETE FROM interactions WHERE user_id = ${user.id}`;
      await sql`DELETE FROM opp_notes WHERE opp_id IN (SELECT id FROM opportunities WHERE user_id = ${user.id})`;
      await sql`DELETE FROM tasks WHERE user_id = ${user.id}`;
      await sql`DELETE FROM opportunities WHERE user_id = ${user.id}`;
      await sql`DELETE FROM contacts WHERE user_id = ${user.id}`;
      await sql`DELETE FROM companies WHERE user_id = ${user.id}`;
      await sql`DELETE FROM atos_team WHERE user_id = ${user.id}`;

      // Restore companies
      for (const c of (b.companies || [])) {
        await sql`INSERT INTO companies (id, name, website, industry, address, size, phone, email, notes, tags, user_id, created_at, updated_at)
          VALUES (${c.id}, ${c.name}, ${c.website || ''}, ${c.industry || ''}, ${c.address || ''}, ${c.size || ''}, ${c.phone || ''}, ${c.email || ''}, ${c.notes || ''}, ${JSON.stringify(c.tags || [])}, ${user.id}, ${c.created_at || new Date().toISOString()}, ${c.updated_at || new Date().toISOString()})`;
      }

      // Restore contacts
      for (const c of (b.contacts || [])) {
        await sql`INSERT INTO contacts (id, name, email, phone, company_id, role, tags, category, user_id, created_at, updated_at)
          VALUES (${c.id}, ${c.name}, ${c.email || ''}, ${c.phone || ''}, ${c.company_id || null}, ${c.role || ''}, ${JSON.stringify(c.tags || [])}, ${c.category || ''}, ${user.id}, ${c.created_at || new Date().toISOString()}, ${c.updated_at || new Date().toISOString()})`;
      }

      // Restore atos_team
      for (const a of (b.atos_team || [])) {
        await sql`INSERT INTO atos_team (id, name, role, email, phone, user_id, created_at)
          VALUES (${a.id}, ${a.name}, ${a.role || 'sales'}, ${a.email || ''}, ${a.phone || ''}, ${user.id}, ${a.created_at || new Date().toISOString()})`;
      }

      // Restore opportunities
      for (const o of (b.opportunities || [])) {
        await sql`INSERT INTO opportunities (id, title, contact_id, contact_ids, company_id, stage, value, probability, priority, next_action, next_action_date, tech_tags, atos_sales_id, atos_delivery_id, expected_close_date, closed_at, user_id, created_at, updated_at)
          VALUES (${o.id}, ${o.title}, ${o.contact_id || null}, ${JSON.stringify(o.contact_ids || [])}, ${o.company_id || null}, ${o.stage || 'lead'}, ${o.value || 0}, ${o.probability || 20}, ${o.priority || 'medium'}, ${o.next_action || ''}, ${o.next_action_date || null}, ${JSON.stringify(o.tech_tags || [])}, ${o.atos_sales_id || null}, ${o.atos_delivery_id || null}, ${o.expected_close_date || null}, ${o.closed_at || null}, ${user.id}, ${o.created_at || new Date().toISOString()}, ${o.updated_at || new Date().toISOString()})`;
      }

      // Restore tasks
      for (const t of (b.tasks || [])) {
        await sql`INSERT INTO tasks (id, title, contact_id, opp_id, due_date, due_time, priority, reminder, reminder_min, done, user_id, created_at, updated_at)
          VALUES (${t.id}, ${t.title}, ${t.contact_id || null}, ${t.opp_id || null}, ${t.due_date || null}, ${t.due_time || null}, ${t.priority || 'medium'}, ${t.reminder || false}, ${t.reminder_min || 15}, ${t.done || false}, ${user.id}, ${t.created_at || new Date().toISOString()}, ${t.updated_at || new Date().toISOString()})`;
      }

      // Restore opp_notes
      for (const n of (b.opp_notes || [])) {
        await sql`INSERT INTO opp_notes (id, opp_id, text, created_at)
          VALUES (${n.id}, ${n.opp_id}, ${n.text}, ${n.created_at || new Date().toISOString()})`;
      }

      // Restore interactions
      for (const i of (b.interactions || [])) {
        await sql`INSERT INTO interactions (id, contact_id, opp_id, type, text, user_id, created_at)
          VALUES (${i.id}, ${i.contact_id || null}, ${i.opp_id || null}, ${i.type || 'note'}, ${i.text}, ${user.id}, ${i.created_at || new Date().toISOString()})`;
      }

      return ok({ restored: true, counts: {
        companies: (b.companies || []).length,
        contacts: (b.contacts || []).length,
        opportunities: (b.opportunities || []).length,
        tasks: (b.tasks || []).length,
        atos_team: (b.atos_team || []).length,
        interactions: (b.interactions || []).length,
      }});
    }

    // DELETE = clear all user data (empty database)
    if (event.httpMethod === 'DELETE') {
      await sql`DELETE FROM interactions WHERE user_id = ${user.id}`;
      await sql`DELETE FROM opp_notes WHERE opp_id IN (SELECT id FROM opportunities WHERE user_id = ${user.id})`;
      await sql`DELETE FROM tasks WHERE user_id = ${user.id}`;
      await sql`DELETE FROM opportunities WHERE user_id = ${user.id}`;
      await sql`DELETE FROM contacts WHERE user_id = ${user.id}`;
      await sql`DELETE FROM companies WHERE user_id = ${user.id}`;
      await sql`DELETE FROM atos_team WHERE user_id = ${user.id}`;
      return ok({ cleared: true });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Backup error:', e);
    return safeErr(e);
  }
};
