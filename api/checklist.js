const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = await requireAuth(event);

    // GET — list all checklist items
    if (event.httpMethod === 'GET') {
      const items = await sql`SELECT * FROM checklist_items WHERE user_id=${user.id} ORDER BY done ASC, position ASC, created_at DESC LIMIT 500`;
      return ok({ items });
    }

    // POST — add new item
    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.text?.trim()) return err(400, 'Tekst vereist');
      // Get max position for ordering
      const [maxPos] = await sql`SELECT COALESCE(MAX(position), 0) + 1 AS next FROM checklist_items WHERE user_id=${user.id}`;
      const [item] = await sql`INSERT INTO checklist_items (text, done, position, category, user_id)
        VALUES (${b.text.trim()}, ${b.done || false}, ${b.position != null ? b.position : maxPos.next}, ${b.category || ''}, ${user.id})
        RETURNING *`;
      return ok({ item });
    }

    // PUT — update item (toggle done, edit text, reorder)
    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');

      // Batch reorder: [{id, position}, ...]
      if (b.reorder && Array.isArray(b.reorder)) {
        for (const r of b.reorder) {
          await sql`UPDATE checklist_items SET position=${r.position} WHERE id=${r.id} AND user_id=${user.id}`;
        }
        return ok({ reordered: true });
      }

      const [item] = await sql`UPDATE checklist_items SET
        text=COALESCE(${b.text !== undefined ? b.text : null}, text),
        done=COALESCE(${b.done !== undefined ? b.done : null}, done),
        position=COALESCE(${b.position !== undefined ? b.position : null}, position),
        category=COALESCE(${b.category !== undefined ? b.category : null}, category)
      WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      if (!item) return err(404, 'Item niet gevonden');
      return ok({ item });
    }

    // DELETE — remove item or clear completed
    if (event.httpMethod === 'DELETE') {
      const p = event.queryStringParameters || {};
      const b = parseBody(event);
      if (p.clear_done === 'true') {
        const deleted = await sql`DELETE FROM checklist_items WHERE user_id=${user.id} AND done=true RETURNING id`;
        return ok({ cleared: deleted.length });
      }
      const id = p.id || b.id;
      if (!id) return err(400, 'ID vereist');
      await sql`DELETE FROM checklist_items WHERE id=${id} AND user_id=${user.id}`;
      return ok({ deleted: id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Checklist error:', e.message || e);
    return safeErr(e);
  }
};
