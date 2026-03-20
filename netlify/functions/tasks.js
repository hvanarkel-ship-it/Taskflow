// ═══════════════════════════════════════════════════════
// /api/tasks — Full CRUD with subtasks + recur
// ═══════════════════════════════════════════════════════
const { sql, ok, err, json, requireAuth } = require('./shared/db');

// Helper: build SELECT with joins for notes, links, subtasks
const taskQuery = (where) => sql`
  SELECT t.*,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id',tn.id,'content',tn.content)) FILTER (WHERE tn.id IS NOT NULL),'[]') AS notes,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id',tl.id,'url',tl.url)) FILTER (WHERE tl.id IS NOT NULL),'[]') AS links,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id',ts.id,'title',ts.title,'done',ts.done)) FILTER (WHERE ts.id IS NOT NULL),'[]') AS subtasks
  FROM tasks t
  LEFT JOIN task_notes tn ON tn.task_id = t.id
  LEFT JOIN task_links tl ON tl.task_id = t.id
  LEFT JOIN task_subtasks ts ON ts.task_id = t.id
  ${where}
  GROUP BY t.id
  ORDER BY t.due_date ASC, t.time_slot ASC NULLS LAST, t.priority ASC
`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');

  try {
    const user = requireAuth(event);

    // ─── GET ──────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      const limit = Math.min(parseInt(p.limit)||200, 500);
      const cols = `t.id,t.title,t.category,t.priority,t.due_date,t.time_slot,t.duration,t.recur,t.completed,t.completed_at,t.assignee_id,t.created_at`;
      let tasks;
      if (p.date) {
        tasks = await sql`
          SELECT ${sql(cols)}, COALESCE(json_agg(DISTINCT jsonb_build_object('id',tn.id,'content',tn.content)) FILTER (WHERE tn.id IS NOT NULL),'[]') AS notes, COALESCE(json_agg(DISTINCT jsonb_build_object('id',tl.id,'url',tl.url)) FILTER (WHERE tl.id IS NOT NULL),'[]') AS links, COALESCE(json_agg(DISTINCT jsonb_build_object('id',ts.id,'title',ts.title,'done',ts.done)) FILTER (WHERE ts.id IS NOT NULL),'[]') AS subtasks
          FROM tasks t LEFT JOIN task_notes tn ON tn.task_id=t.id LEFT JOIN task_links tl ON tl.task_id=t.id LEFT JOIN task_subtasks ts ON ts.task_id=t.id
          WHERE t.user_id=${user.id} AND t.due_date=${p.date} GROUP BY t.id ORDER BY t.time_slot ASC NULLS LAST LIMIT ${limit}`;
      } else if (p.from && p.to) {
        tasks = await sql`
          SELECT ${sql(cols)}, COALESCE(json_agg(DISTINCT jsonb_build_object('id',tn.id,'content',tn.content)) FILTER (WHERE tn.id IS NOT NULL),'[]') AS notes, COALESCE(json_agg(DISTINCT jsonb_build_object('id',tl.id,'url',tl.url)) FILTER (WHERE tl.id IS NOT NULL),'[]') AS links, COALESCE(json_agg(DISTINCT jsonb_build_object('id',ts.id,'title',ts.title,'done',ts.done)) FILTER (WHERE ts.id IS NOT NULL),'[]') AS subtasks
          FROM tasks t LEFT JOIN task_notes tn ON tn.task_id=t.id LEFT JOIN task_links tl ON tl.task_id=t.id LEFT JOIN task_subtasks ts ON ts.task_id=t.id
          WHERE t.user_id=${user.id} AND t.due_date BETWEEN ${p.from} AND ${p.to} GROUP BY t.id ORDER BY t.due_date ASC, t.time_slot ASC NULLS LAST LIMIT ${limit}`;
      } else {
        tasks = await sql`
          SELECT ${sql(cols)}, COALESCE(json_agg(DISTINCT jsonb_build_object('id',tn.id,'content',tn.content)) FILTER (WHERE tn.id IS NOT NULL),'[]') AS notes, COALESCE(json_agg(DISTINCT jsonb_build_object('id',tl.id,'url',tl.url)) FILTER (WHERE tl.id IS NOT NULL),'[]') AS links, COALESCE(json_agg(DISTINCT jsonb_build_object('id',ts.id,'title',ts.title,'done',ts.done)) FILTER (WHERE ts.id IS NOT NULL),'[]') AS subtasks
          FROM tasks t LEFT JOIN task_notes tn ON tn.task_id=t.id LEFT JOIN task_links tl ON tl.task_id=t.id LEFT JOIN task_subtasks ts ON ts.task_id=t.id
          WHERE t.user_id=${user.id} GROUP BY t.id ORDER BY t.due_date ASC, t.time_slot ASC NULLS LAST LIMIT ${limit}`;
      }
      return ok({ tasks });
    }

    // ─── POST (Create) ───────────────────────────────
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body);
      if (!b.title) return err(400, 'Titel is vereist');

      const [task] = await sql`
        INSERT INTO tasks (title, category, priority, due_date, time_slot, duration, recur, user_id, assignee_id, team_id)
        VALUES (${b.title}, ${b.category||'werk'}, ${b.priority||'medium'}, ${b.dueDate||new Date().toISOString().split('T')[0]}, ${b.timeSlot||null}, ${b.duration||30}, ${b.recur||'none'}, ${user.id}, ${b.assigneeId||user.id}, ${b.teamId||null})
        RETURNING *`;

      if (b.notes?.length) await sql`INSERT INTO task_notes (task_id,content) SELECT ${task.id}, unnest(${b.notes}::text[])`;
      if (b.links?.length) await sql`INSERT INTO task_links (task_id,url) SELECT ${task.id}, unnest(${b.links}::text[])`;
      if (b.subtasks?.length) for (const s of b.subtasks) await sql`INSERT INTO task_subtasks (task_id,title,done) VALUES (${task.id},${s.title},${s.done||false})`;

      return ok({ task });
    }

    // ─── PUT (Update) ────────────────────────────────
    if (event.httpMethod === 'PUT') {
      const b = JSON.parse(event.body);
      if (!b.id) return err(400, 'Task ID vereist');

      const [existing] = await sql`SELECT id FROM tasks WHERE id=${b.id} AND user_id=${user.id}`;
      if (!existing) return err(404, 'Taak niet gevonden');

      const [task] = await sql`
        UPDATE tasks SET
          title=COALESCE(${b.title||null},title),
          category=COALESCE(${b.category||null},category),
          priority=COALESCE(${b.priority||null},priority),
          due_date=COALESCE(${b.dueDate||null},due_date),
          time_slot=${b.timeSlot!==undefined?b.timeSlot:null},
          duration=COALESCE(${b.duration||null},duration),
          recur=COALESCE(${b.recur||null},recur),
          completed=COALESCE(${b.completed!==undefined?b.completed:null},completed),
          completed_at=${b.completed?'NOW()':null},
          assignee_id=COALESCE(${b.assigneeId||null},assignee_id),
          updated_at=NOW()
        WHERE id=${b.id} RETURNING *`;

      if (b.notes !== undefined) {
        await sql`DELETE FROM task_notes WHERE task_id=${b.id}`;
        if ((b.notes||[]).length) await sql`INSERT INTO task_notes (task_id,content) SELECT ${b.id}, unnest(${b.notes}::text[])`;
      }
      if (b.links !== undefined) {
        await sql`DELETE FROM task_links WHERE task_id=${b.id}`;
        if ((b.links||[]).length) await sql`INSERT INTO task_links (task_id,url) SELECT ${b.id}, unnest(${b.links}::text[])`;
      }
      if (b.subtasks !== undefined) {
        await sql`DELETE FROM task_subtasks WHERE task_id=${b.id}`;
        for (const s of (b.subtasks||[])) await sql`INSERT INTO task_subtasks (task_id,title,done) VALUES (${b.id},${s.title},${s.done||false})`;
      }

      return ok({ task });
    }

    // ─── DELETE ───────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const b = JSON.parse(event.body);
      if (!b.id) return err(400, 'Task ID vereist');
      await sql`DELETE FROM tasks WHERE id=${b.id} AND user_id=${user.id}`;
      return ok({ deleted: b.id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    if (e.status) return err(e.status, e.message);
    console.error('Tasks error:', e);
    return err(500, 'Server error');
  }
};
