// ═══════════════════════════════════════════════════════
// /api/tasks — Full CRUD for tasks
// GET    ?date=YYYY-MM-DD | ?from=&to= | ?all=1
// POST   { title, category, priority, dueDate, timeSlot, duration, assigneeId }
// PUT    { id, ...fields }
// DELETE { id }
// ═══════════════════════════════════════════════════════
const { sql, ok, err, json, requireAuth } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');

  try {
    const user = requireAuth(event);

    // ─── GET ──────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      let tasks;
      if (params.date) {
        tasks = await sql`
          SELECT t.*, 
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', tn.id, 'content', tn.content)) FILTER (WHERE tn.id IS NOT NULL), '[]') AS notes,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', tl.id, 'url', tl.url)) FILTER (WHERE tl.id IS NOT NULL), '[]') AS links
          FROM tasks t
          LEFT JOIN task_notes tn ON tn.task_id = t.id
          LEFT JOIN task_links tl ON tl.task_id = t.id
          WHERE t.user_id = ${user.id} AND t.due_date = ${params.date}
          GROUP BY t.id
          ORDER BY t.time_slot ASC NULLS LAST, t.priority ASC
        `;
      } else if (params.from && params.to) {
        tasks = await sql`
          SELECT t.*,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', tn.id, 'content', tn.content)) FILTER (WHERE tn.id IS NOT NULL), '[]') AS notes,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', tl.id, 'url', tl.url)) FILTER (WHERE tl.id IS NOT NULL), '[]') AS links
          FROM tasks t
          LEFT JOIN task_notes tn ON tn.task_id = t.id
          LEFT JOIN task_links tl ON tl.task_id = t.id
          WHERE t.user_id = ${user.id} AND t.due_date BETWEEN ${params.from} AND ${params.to}
          GROUP BY t.id
          ORDER BY t.due_date ASC, t.time_slot ASC NULLS LAST
        `;
      } else {
        tasks = await sql`
          SELECT t.*,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', tn.id, 'content', tn.content)) FILTER (WHERE tn.id IS NOT NULL), '[]') AS notes,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', tl.id, 'url', tl.url)) FILTER (WHERE tl.id IS NOT NULL), '[]') AS links
          FROM tasks t
          LEFT JOIN task_notes tn ON tn.task_id = t.id
          LEFT JOIN task_links tl ON tl.task_id = t.id
          WHERE t.user_id = ${user.id}
          GROUP BY t.id
          ORDER BY t.due_date ASC, t.time_slot ASC NULLS LAST
        `;
      }

      return ok({ tasks });
    }

    // ─── POST (Create) ───────────────────────────────
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body);
      if (!b.title) return err(400, 'Titel is vereist');

      const [task] = await sql`
        INSERT INTO tasks (title, category, priority, due_date, time_slot, duration, user_id, assignee_id, team_id)
        VALUES (
          ${b.title},
          ${b.category || 'werk'},
          ${b.priority || 'medium'},
          ${b.dueDate || new Date().toISOString().split('T')[0]},
          ${b.timeSlot || null},
          ${b.duration || 30},
          ${user.id},
          ${b.assigneeId || user.id},
          ${b.teamId || null}
        )
        RETURNING *
      `;

      // Add notes
      if (b.notes && b.notes.length > 0) {
        for (const note of b.notes) {
          await sql`INSERT INTO task_notes (task_id, content) VALUES (${task.id}, ${note})`;
        }
      }

      // Add links
      if (b.links && b.links.length > 0) {
        for (const link of b.links) {
          await sql`INSERT INTO task_links (task_id, url) VALUES (${task.id}, ${link})`;
        }
      }

      return ok({ task });
    }

    // ─── PUT (Update) ────────────────────────────────
    if (event.httpMethod === 'PUT') {
      const b = JSON.parse(event.body);
      if (!b.id) return err(400, 'Task ID vereist');

      // Verify ownership
      const [existing] = await sql`SELECT id FROM tasks WHERE id = ${b.id} AND user_id = ${user.id}`;
      if (!existing) return err(404, 'Taak niet gevonden');

      const [task] = await sql`
        UPDATE tasks SET
          title = COALESCE(${b.title || null}, title),
          category = COALESCE(${b.category || null}, category),
          priority = COALESCE(${b.priority || null}, priority),
          due_date = COALESCE(${b.dueDate || null}, due_date),
          time_slot = ${b.timeSlot !== undefined ? b.timeSlot : null},
          duration = COALESCE(${b.duration || null}, duration),
          completed = COALESCE(${b.completed !== undefined ? b.completed : null}, completed),
          completed_at = ${b.completed ? 'NOW()' : null},
          assignee_id = COALESCE(${b.assigneeId || null}, assignee_id),
          updated_at = NOW()
        WHERE id = ${b.id}
        RETURNING *
      `;

      // Replace notes if provided
      if (b.notes !== undefined) {
        await sql`DELETE FROM task_notes WHERE task_id = ${b.id}`;
        for (const note of (b.notes || [])) {
          await sql`INSERT INTO task_notes (task_id, content) VALUES (${b.id}, ${note})`;
        }
      }

      // Replace links if provided
      if (b.links !== undefined) {
        await sql`DELETE FROM task_links WHERE task_id = ${b.id}`;
        for (const link of (b.links || [])) {
          await sql`INSERT INTO task_links (task_id, url) VALUES (${b.id}, ${link})`;
        }
      }

      return ok({ task });
    }

    // ─── DELETE ───────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const b = JSON.parse(event.body);
      if (!b.id) return err(400, 'Task ID vereist');

      await sql`DELETE FROM tasks WHERE id = ${b.id} AND user_id = ${user.id}`;
      return ok({ deleted: b.id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    if (e.status) return err(e.status, e.message);
    console.error('Tasks error:', e);
    return err(500, 'Server error');
  }
};
