const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');
 
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
    if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = requireAuth(event);
 
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      let ints;
      if (p.contact_id) {
        ints = await sql`SELECT * FROM interactions WHERE contact_id=${p.contact_id} AND user_id=${user.id} ORDER BY created_at DESC LIMIT 50`;
      } else if (p.opp_id) {
        ints = await sql`SELECT * FROM interactions WHERE opp_id=${p.opp_id} AND user_id=${user.id} ORDER BY created_at DESC LIMIT 50`;
      } else {
        ints = await sql`SELECT * FROM interactions WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 100`;
      }
      return ok({ interactions: ints });
    }
 
    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.text || !b.type) return err(400, 'Type en tekst vereist');
      const [i] = await sql`INSERT INTO interactions (contact_id, opp_id, type, text, user_id) VALUES (${b.contactId||null}, ${b.oppId||null}, ${b.type}, ${b.text}, ${user.id}) RETURNING *`;
      return ok({ interaction: i });
    }
 
    if (event.httpMethod === 'DELETE') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      await sql`DELETE FROM interactions WHERE id=${b.id} AND user_id=${user.id}`;
      return ok({ deleted: b.id });
    }
    return err(405, 'Method not allowed');
  } catch (e) {
    
    console.error('Interactions error:', e);
    return safeErr(e);
  }
};
 
