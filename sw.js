const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = requireAuth(event);

    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      let contacts;
      if (p.id) {
        contacts = await sql`SELECT c.*, co.name as company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=${p.id} AND c.user_id=${user.id}`;
      } else if (p.company_id) {
        contacts = await sql`SELECT c.*, co.name as company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.company_id=${p.company_id} AND c.user_id=${user.id} ORDER BY c.name ASC`;
      } else {
        contacts = await sql`SELECT c.*, co.name as company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.user_id=${user.id} ORDER BY c.name ASC LIMIT 500`;
      }
      return ok({ contacts });
    }

    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.name) return err(400, 'Naam is vereist');
      const [ct] = await sql`INSERT INTO contacts (name, email, phone, company_id, role, tags, user_id) VALUES (${b.name}, ${b.email||''}, ${b.phone||''}, ${b.companyId||null}, ${b.role||''}, ${JSON.stringify(b.tags||[])}, ${user.id}) RETURNING *`;
      return ok({ contact: ct });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const [ct] = await sql`UPDATE contacts SET name=COALESCE(${b.name||null},name), email=COALESCE(${b.email},email), phone=COALESCE(${b.phone},phone), company_id=${b.companyId||null}, role=COALESCE(${b.role},role), tags=COALESCE(${JSON.stringify(b.tags||[])},tags), updated_at=NOW() WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      return ok({ contact: ct });
    }

    if (event.httpMethod === 'DELETE') {
      const b = parseBody(event);
      await sql`DELETE FROM contacts WHERE id=${b.id} AND user_id=${user.id}`;
      return ok({ deleted: b.id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Contacts error:', e);
    return safeErr(e);
  }
};
