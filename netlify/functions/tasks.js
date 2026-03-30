const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

const toNull = (v) => (v === '' || v === undefined || v === null) ? null : v;
const toInt = (v) => { const n = toNull(v); return n !== null ? parseInt(n) || null : null; };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = requireAuth(event);

    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      let tasks;
      if (p.id) {
        tasks = await sql`SELECT * FROM tasks WHERE id=${p.id} AND user_id=${user.id}`;
      } else if (p.due_date) {
        tasks = await sql`SELECT * FROM tasks WHERE user_id=${user.id} AND due_date=${p.due_date} ORDER BY due_time ASC NULLS LAST LIMIT 200`;
      } else if (p.opp_id) {
        tasks = await sql`SELECT * FROM tasks WHERE user_id=${user.id} AND opp_id=${p.opp_id} ORDER BY due_date ASC LIMIT 200`;
      } else if (p.contact_id) {
        tasks = await sql`SELECT * FROM tasks WHERE user_id=${user.id} AND contact_id=${p.contact_id} ORDER BY due_date ASC LIMIT 200`;
      } else if (p.overdue === 'true') {
        tasks = await sql`SELECT * FROM tasks WHERE user_id=${user.id} AND done=false AND due_date < CURRENT_DATE ORDER BY due_date ASC LIMIT 200`;
      } else {
        tasks = await sql`SELECT * FROM tasks WHERE user_id=${user.id} ORDER BY done ASC, due_date ASC NULLS LAST, due_time ASC NULLS LAST LIMIT 200`;
      }
      return ok({ tasks });
    }

    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.title) return err(400, 'Titel vereist');
      const [task] = await sql`INSERT INTO tasks (title, contact_id, opp_id, due_date, due_time, priority, reminder, reminder_min, progress, status, notes, atos_id, company_contact_id, user_id) VALUES (
        ${b.title},
        ${toInt(b.contact_id)},
        ${toInt(b.opp_id)},
        ${toNull(b.due_date)},
        ${toNull(b.due_time)},
        ${b.priority || 'medium'},
        ${b.reminder || false},
        ${b.reminder_min || 15},
        ${b.progress || 0},
        ${b.status || 'todo'},
        ${b.notes || ''},
        ${toInt(b.atos_id)},
        ${toInt(b.company_contact_id)},
        ${user.id}
      ) RETURNING *`;
      return ok({ task });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const hasContact = b.contact_id !== undefined ? 1 : 0;
      const hasOpp = b.opp_id !== undefined ? 1 : 0;
      const hasDueDate = b.due_date !== undefined ? 1 : 0;
      const hasDueTime = b.due_time !== undefined ? 1 : 0;
      const [task] = await sql`UPDATE tasks SET
        title=COALESCE(${toNull(b.title)},title),
        contact_id=CASE WHEN ${hasContact}=1 THEN ${toInt(b.contact_id)} ELSE contact_id END,
        opp_id=CASE WHEN ${hasOpp}=1 THEN ${toInt(b.opp_id)} ELSE opp_id END,
        due_date=CASE WHEN ${hasDueDate}=1 THEN ${toNull(b.due_date)}::date ELSE due_date END,
        due_time=CASE WHEN ${hasDueTime}=1 THEN ${toNull(b.due_time)} ELSE due_time END,
        priority=COALESCE(${toNull(b.priority)},priority),
        reminder=COALESCE(${b.reminder !== undefined ? b.reminder : null},reminder),
        reminder_min=COALESCE(${toNull(b.reminder_min)},reminder_min),
        done=COALESCE(${b.done !== undefined ? b.done : null},done),
        progress=COALESCE(${b.progress !== undefined ? b.progress : null},progress),
        status=COALESCE(${toNull(b.status)},status),
        notes=COALESCE(${b.notes !== undefined ? b.notes : null},notes),
        atos_id=CASE WHEN ${b.atos_id !== undefined ? 1 : 0}=1 THEN ${toInt(b.atos_id)} ELSE atos_id END,
        company_contact_id=CASE WHEN ${b.company_contact_id !== undefined ? 1 : 0}=1 THEN ${toInt(b.company_contact_id)} ELSE company_contact_id END,
        updated_at=NOW()
      WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      return ok({ task });
    }

    if (event.httpMethod === 'DELETE') {
      const p = event.queryStringParameters || {};
      const b = parseBody(event);
      const id = p.id || b.id;
      if (!id) return err(400, 'ID vereist');
      await sql`DELETE FROM tasks WHERE id=${id} AND user_id=${user.id}`;
      return ok({ deleted: id });
    }
    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Tasks error:', e.message || e);
    return safeErr(e);
  }
};
