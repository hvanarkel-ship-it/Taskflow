const { sql, ok, err, json, requireAuth } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  try {
    const user = requireAuth(event);

    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      let opps;
      if (p.id) {
        opps = await sql`SELECT o.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id',n.id,'text',n.text,'at',n.created_at)) FILTER (WHERE n.id IS NOT NULL),'[]') AS notes FROM opportunities o LEFT JOIN opp_notes n ON n.opp_id=o.id WHERE o.id=${p.id} AND o.user_id=${user.id} GROUP BY o.id`;
      } else if (p.stage) {
        opps = await sql`SELECT o.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id',n.id,'text',n.text,'at',n.created_at)) FILTER (WHERE n.id IS NOT NULL),'[]') AS notes FROM opportunities o LEFT JOIN opp_notes n ON n.opp_id=o.id WHERE o.stage=${p.stage} AND o.user_id=${user.id} GROUP BY o.id ORDER BY o.value DESC LIMIT 200`;
      } else {
        opps = await sql`SELECT o.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id',n.id,'text',n.text,'at',n.created_at)) FILTER (WHERE n.id IS NOT NULL),'[]') AS notes FROM opportunities o LEFT JOIN opp_notes n ON n.opp_id=o.id WHERE o.user_id=${user.id} GROUP BY o.id ORDER BY o.updated_at DESC LIMIT 200`;
      }
      return ok({ opportunities: opps });
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body);
      if (!b.title) return err(400, 'Titel vereist');
      const [opp] = await sql`INSERT INTO opportunities (title, contact_id, company_id, stage, value, probability, priority, next_action, next_action_date, user_id) VALUES (${b.title}, ${b.contactId||null}, ${b.companyId||null}, ${b.stage||'lead'}, ${b.value||0}, ${b.probability||20}, ${b.priority||'medium'}, ${b.nextAction||''}, ${b.nextActionDate||null}, ${user.id}) RETURNING *`;
      if (b.notes?.length) for (const n of b.notes) await sql`INSERT INTO opp_notes (opp_id,text) VALUES (${opp.id},${n.text||n})`;
      return ok({ opportunity: opp });
    }

    if (event.httpMethod === 'PUT') {
      const b = JSON.parse(event.body);
      if (!b.id) return err(400, 'ID vereist');
      const closedAt = (b.stage === 'won' || b.stage === 'lost') ? 'NOW()' : null;
      const [opp] = await sql`UPDATE opportunities SET title=COALESCE(${b.title||null},title), contact_id=${b.contactId!==undefined?b.contactId||null:null}, company_id=${b.companyId!==undefined?b.companyId||null:null}, stage=COALESCE(${b.stage||null},stage), value=COALESCE(${b.value!==undefined?b.value:null},value), probability=COALESCE(${b.probability!==undefined?b.probability:null},probability), priority=COALESCE(${b.priority||null},priority), next_action=COALESCE(${b.nextAction},next_action), next_action_date=${b.nextActionDate||null}, closed_at=${closedAt}, updated_at=NOW() WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      // Add note if provided
      if (b.addNote) await sql`INSERT INTO opp_notes (opp_id,text) VALUES (${b.id},${b.addNote})`;
      return ok({ opportunity: opp });
    }

    if (event.httpMethod === 'DELETE') {
      const b = JSON.parse(event.body);
      await sql`DELETE FROM opportunities WHERE id=${b.id} AND user_id=${user.id}`;
      return ok({ deleted: b.id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    if (e.status) return err(e.status, e.message);
    console.error('Opps error:', e);
    return err(500, 'Server error');
  }
};
