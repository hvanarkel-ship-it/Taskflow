const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

const toNull = (v) => (v === '' || v === undefined || v === null) ? null : v;
const toJsonb = (v) => {
  if (v === null || v === undefined) return '[]';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = await requireAuth(event);

    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      let companies;
      if (p.id) {
        companies = await sql`SELECT * FROM companies WHERE id=${p.id} AND user_id=${user.id}`;
      } else {
        companies = await sql`SELECT * FROM companies WHERE user_id=${user.id} ORDER BY name ASC LIMIT 200`;
      }
      return ok({ companies });
    }

    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.name) return err(400, 'Naam is vereist');
      const [co] = await sql`INSERT INTO companies (name, website, industry, address, size, phone, email, notes, tags, user_id) VALUES (
        ${b.name},
        ${toNull(b.website) || ''},
        ${toNull(b.industry) || ''},
        ${toNull(b.address) || ''},
        ${toNull(b.size) || ''},
        ${toNull(b.phone) || ''},
        ${toNull(b.email) || ''},
        ${toNull(b.notes) || ''},
        ${toJsonb(b.tags)}::jsonb,
        ${user.id}
      ) RETURNING *`;
      return ok({ company: co });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const [co] = await sql`UPDATE companies SET
        name=COALESCE(${toNull(b.name)},name),
        website=COALESCE(${b.website !== undefined ? (toNull(b.website) || '') : null},website),
        industry=COALESCE(${b.industry !== undefined ? (toNull(b.industry) || '') : null},industry),
        address=COALESCE(${b.address !== undefined ? (toNull(b.address) || '') : null},address),
        size=COALESCE(${b.size !== undefined ? (toNull(b.size) || '') : null},size),
        phone=COALESCE(${b.phone !== undefined ? (toNull(b.phone) || '') : null},phone),
        email=COALESCE(${b.email !== undefined ? (toNull(b.email) || '') : null},email),
        notes=COALESCE(${b.notes !== undefined ? (toNull(b.notes) || '') : null},notes),
        tags=COALESCE(${b.tags !== undefined ? toJsonb(b.tags) : null}::jsonb,tags),
        updated_at=NOW()
      WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      return ok({ company: co });
    }

    if (event.httpMethod === 'DELETE') {
      const p = event.queryStringParameters || {};
      const b = parseBody(event);
      const id = p.id || b.id;
      if (!id) return err(400, 'ID vereist');
      await sql`DELETE FROM companies WHERE id=${id} AND user_id=${user.id}`;
      return ok({ deleted: id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Companies error:', e.message || e);
    return safeErr(e);
  }
};
