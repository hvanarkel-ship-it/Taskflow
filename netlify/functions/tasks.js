const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');
 
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
      const [task] = await sql`INSERT INTO tasks (title, contact_id, opp_id, due_date, due_time, priority, reminder, reminder_min, user_id) VALUES (${b.title}, ${b.contact_id||b.contactId||null}, ${b.opp_id||b.oppId||null}, ${b.due_date||b.dueDate||null}, ${b.due_time||b.dueTime||null}, ${b.priority||'medium'}, ${b.reminder||false}, ${b.reminder_min||b.reminderMin||15}, ${user.id}) RETURNING *`;
      return ok({ task });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const hasContact = b.contact_id !== undefined || b.contactId !== undefined ? 1 : 0;
      const hasOpp = b.opp_id !== undefined || b.oppId !== undefined ? 1 : 0;
      const hasDueDate = b.due_date !== undefined || b.dueDate !== undefined ? 1 : 0;
      const hasDueTime = b.due_time !== undefined || b.dueTime !== undefined ? 1 : 0;
      const [task] = await sql`UPDATE tasks SET title=COALESCE(${b.title||null},title), contact_id=CASE WHEN ${hasContact}=1 THEN ${b.contact_id||b.contactId||null}::integer ELSE contact_id END, opp_id=CASE WHEN ${hasOpp}=1 THEN ${b.opp_id||b.oppId||null}::integer ELSE opp_id END, due_date=CASE WHEN ${hasDueDate}=1 THEN ${b.due_date||b.dueDate||null}::date ELSE due_date END, due_time=CASE WHEN ${hasDueTime}=1 THEN ${b.due_time||b.dueTime||null} ELSE due_time END, priority=COALESCE(${b.priority||null},priority), reminder=COALESCE(${b.reminder!==undefined?b.reminder:null},reminder), reminder_min=COALESCE(${b.reminder_min||b.reminderMin||null},reminder_min), done=COALESCE(${b.done!==undefined?b.done:null},done), updated_at=NOW() WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
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
    
    console.error('Tasks error:', e);
    return safeErr(e);
  }
};
 
