const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = requireAuth(event);

    if (event.httpMethod === 'GET') {
      const team = await sql`SELECT * FROM atos_team WHERE user_id=${user.id} ORDER BY role, name LIMIT 100`;
      return ok({ team });
    }

    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.name) return err(400, 'Naam vereist');
      const [m] = await sql`INSERT INTO atos_team (name, role, email, phone, user_id) VALUES (${b.name}, ${b.role||'sales'}, ${b.email||''}, ${b.phone||''}, ${user.id}) RETURNING *`;
      return ok({ member: m });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const [m] = await sql`UPDATE atos_team SET name=COALESCE(${b.name||null},name), role=COALESCE(${b.role||null},role), email=COALESCE(${b.email},email), phone=COALESCE(${b.phone},phone) WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      return ok({ member: m });
    }

    if (event.httpMethod === 'DELETE') {
      const b = parseBody(event);
      await sql`DELETE FROM atos_team WHERE id=${b.id} AND user_id=${user.id}`;
      return ok({ deleted: b.id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Atos error:', e);
    return safeErr(e);
  }
};
