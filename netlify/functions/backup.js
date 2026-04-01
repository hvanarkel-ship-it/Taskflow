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

      // Build all queries into an array for atomic transaction
      const queries = [];
      const now = new Date().toISOString();

      // Delete existing data in correct order (respecting FK constraints)
      queries.push(sql`DELETE FROM interactions WHERE user_id = ${user.id}`);
      queries.push(sql`DELETE FROM opp_notes WHERE opp_id IN (SELECT id FROM opportunities WHERE user_id = ${user.id})`);
      queries.push(sql`DELETE FROM tasks WHERE user_id = ${user.id}`);
      queries.push(sql`DELETE FROM opportunities WHERE user_id = ${user.id}`);
      queries.push(sql`DELETE FROM contacts WHERE user_id = ${user.id}`);
      queries.push(sql`DELETE FROM companies WHERE user_id = ${user.id}`);
      queries.push(sql`DELETE FROM atos_team WHERE user_id = ${user.id}`);

      // Restore companies
      for (const c of (b.companies || [])) {
        queries.push(sql`INSERT INTO companies (id, name, website, industry, address, size, phone, email, notes, tags, user_id, created_at, updated_at)
          VALUES (${c.id}, ${c.name}, ${c.website || ''}, ${c.industry || ''}, ${c.address || ''}, ${c.size || ''}, ${c.phone || ''}, ${c.email || ''}, ${c.notes || ''}, ${JSON.stringify(c.tags || [])}::jsonb, ${user.id}, ${c.created_at || now}, ${c.updated_at || now})`);
      }

      // Restore contacts
      for (const c of (b.contacts || [])) {
        queries.push(sql`INSERT INTO contacts (id, name, email, phone, company_id, role, tags, category, user_id, created_at, updated_at)
          VALUES (${c.id}, ${c.name}, ${c.email || ''}, ${c.phone || ''}, ${c.company_id || null}, ${c.role || ''}, ${JSON.stringify(c.tags || [])}::jsonb, ${c.category || ''}, ${user.id}, ${c.created_at || now}, ${c.updated_at || now})`);
      }

      // Restore atos_team
      for (const a of (b.atos_team || [])) {
        queries.push(sql`INSERT INTO atos_team (id, name, role, email, phone, user_id, created_at)
          VALUES (${a.id}, ${a.name}, ${a.role || 'sales'}, ${a.email || ''}, ${a.phone || ''}, ${user.id}, ${a.created_at || now})`);
      }

      // Restore opportunities (ALL columns)
      for (const o of (b.opportunities || [])) {
        queries.push(sql`INSERT INTO opportunities (id, title, contact_id, contact_ids, company_id, stage, value, probability, priority, next_action, next_action_date, tech_tags, atos_sales_id, atos_delivery_id, atos_contact_ids, expected_close_date, stage_changed_at, closed_at, closed_reason, closed_note, deal_notes, salesforce_url, folder_url, user_id, created_at, updated_at)
          VALUES (${o.id}, ${o.title}, ${o.contact_id || null}, ${JSON.stringify(o.contact_ids || [])}::jsonb, ${o.company_id || null}, ${o.stage || 'lead'}, ${o.value != null ? o.value : 0}, ${o.probability != null ? o.probability : 20}, ${o.priority || 'medium'}, ${o.next_action || ''}, ${o.next_action_date || null}, ${JSON.stringify(o.tech_tags || [])}::jsonb, ${o.atos_sales_id || null}, ${o.atos_delivery_id || null}, ${JSON.stringify(o.atos_contact_ids || [])}::jsonb, ${o.expected_close_date || null}, ${o.stage_changed_at || null}, ${o.closed_at || null}, ${o.closed_reason || ''}, ${o.closed_note || ''}, ${o.deal_notes || ''}, ${o.salesforce_url || ''}, ${o.folder_url || ''}, ${user.id}, ${o.created_at || now}, ${o.updated_at || now})`);
      }

      // Restore tasks (ALL columns)
      for (const t of (b.tasks || [])) {
        queries.push(sql`INSERT INTO tasks (id, title, contact_id, opp_id, due_date, due_time, priority, reminder, reminder_min, done, progress, status, notes, atos_id, company_contact_id, user_id, created_at, updated_at)
          VALUES (${t.id}, ${t.title}, ${t.contact_id || null}, ${t.opp_id || null}, ${t.due_date || null}, ${t.due_time || null}, ${t.priority || 'medium'}, ${t.reminder || false}, ${t.reminder_min || 15}, ${t.done || false}, ${t.progress || 0}, ${t.status || 'todo'}, ${t.notes || ''}, ${t.atos_id || null}, ${t.company_contact_id || null}, ${user.id}, ${t.created_at || now}, ${t.updated_at || now})`);
      }

      // Restore opp_notes
      for (const n of (b.opp_notes || [])) {
        queries.push(sql`INSERT INTO opp_notes (id, opp_id, text, created_at)
          VALUES (${n.id}, ${n.opp_id}, ${n.text}, ${n.created_at || now})`);
      }

      // Restore interactions
      for (const i of (b.interactions || [])) {
        queries.push(sql`INSERT INTO interactions (id, contact_id, opp_id, type, text, user_id, created_at)
          VALUES (${i.id}, ${i.contact_id || null}, ${i.opp_id || null}, ${i.type || 'note'}, ${i.text}, ${user.id}, ${i.created_at || now})`);
      }

      // Execute all queries in a single transaction (all-or-nothing)
      await sql.transaction(queries);

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
