const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

const toNull = (v) => (v === '' || v === undefined || v === null) ? null : v;
const toInt = (v) => { const n = toNull(v); return n !== null ? parseInt(n) || null : null; };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = await requireAuth(event);

    if (event.httpMethod === 'GET') {
      const lists = await sql`SELECT * FROM task_lists WHERE user_id=${user.id} ORDER BY position ASC, id ASC`;
      return ok({ lists });
    }

    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.name) return err(400, 'Naam vereist');
      const [list] = await sql`INSERT INTO task_lists (name, position, user_id) VALUES (
        ${b.name},
        ${toInt(b.position) || 0},
        ${user.id}
      ) RETURNING *`;
      return ok({ list });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const [list] = await sql`UPDATE task_lists SET
        name=COALESCE(${toNull(b.name)},name),
        position=COALESCE(${b.position !== undefined ? toInt(b.position) : null},position)
      WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      return ok({ list });
    }

    if (event.httpMethod === 'DELETE') {
      const p = event.queryStringParameters || {};
      const b = parseBody(event);
      const id = p.id || b.id;
      if (!id) return err(400, 'ID vereist');
      // Tasks keep existing — list_id is set NULL by the FK ON DELETE SET NULL,
      // so they fall back to the default list in the UI.
      await sql`DELETE FROM task_lists WHERE id=${id} AND user_id=${user.id}`;
      return ok({ deleted: id });
    }
    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Task lists error:', e.message || e);
    return safeErr(e);
  }
};
