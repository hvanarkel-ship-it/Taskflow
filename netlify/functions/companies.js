const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
    if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = requireAuth(event);

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
      const [co] = await sql`INSERT INTO companies (name, website, industry, address, size, phone, email, notes, tags, user_id) VALUES (${b.name}, ${b.website||''}, ${b.industry||''}, ${b.address||''}, ${b.size||''}, ${b.phone||''}, ${b.email||''}, ${b.notes||''}, ${JSON.stringify(b.tags||[])}, ${user.id}) RETURNING *`;
      return ok({ company: co });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const [co] = await sql`UPDATE companies SET name=COALESCE(${b.name||null},name), website=COALESCE(${b.website},website), industry=COALESCE(${b.industry},industry), address=COALESCE(${b.address},address), size=COALESCE(${b.size},size), phone=COALESCE(${b.phone},phone), email=COALESCE(${b.email},email), notes=COALESCE(${b.notes},notes), tags=COALESCE(${JSON.stringify(b.tags||[])},tags), updated_at=NOW() WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
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
    
    console.error('Companies error:', e);
    return safeErr(e);
  }
};
