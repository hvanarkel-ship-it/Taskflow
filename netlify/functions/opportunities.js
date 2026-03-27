const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  try {
    const user = requireAuth(event);

    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      let opps;
      if (p.id) {
        opps = await sql`SELECT o.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id',n.id,'text',n.text,'at',n.created_at)) FILTER (WHERE n.id IS NOT NULL),'[]') AS notes FROM opportunities o LEFT JOIN opp_notes n ON n.opp_id=o.id WHERE o.id=${p.id} AND o.user_id=${user.id} GROUP BY o.id`;
      } else if (p.company_id) {
        opps = await sql`SELECT o.*, '[]'::jsonb AS notes FROM opportunities o WHERE o.company_id=${p.company_id} AND o.user_id=${user.id} ORDER BY o.updated_at DESC LIMIT 200`;
      } else if (p.contact_id) {
        opps = await sql`SELECT o.*, '[]'::jsonb AS notes FROM opportunities o WHERE (o.contact_id=${p.contact_id} OR o.contact_ids @> ${JSON.stringify([parseInt(p.contact_id)])}::jsonb) AND o.user_id=${user.id} ORDER BY o.updated_at DESC LIMIT 200`;
      } else if (p.stage) {
        opps = await sql`SELECT o.*, '[]'::jsonb AS notes FROM opportunities o WHERE o.stage=${p.stage} AND o.user_id=${user.id} ORDER BY o.value DESC LIMIT 200`;
      } else {
        opps = await sql`SELECT o.*, COALESCE(json_agg(DISTINCT jsonb_build_object('id',n.id,'text',n.text,'at',n.created_at)) FILTER (WHERE n.id IS NOT NULL),'[]') AS notes FROM opportunities o LEFT JOIN opp_notes n ON n.opp_id=o.id WHERE o.user_id=${user.id} GROUP BY o.id ORDER BY o.updated_at DESC LIMIT 200`;
      }
      return ok({ opportunities: opps });
    }

    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.title) return err(400, 'Titel vereist');
      const [opp] = await sql`INSERT INTO opportunities (title, contact_id, contact_ids, company_id, stage, value, probability, priority, next_action, next_action_date, expected_close_date, tech_tags, atos_sales_id, atos_delivery_id, stage_changed_at, closed_reason, closed_note, deal_notes, user_id) VALUES (${b.title}, ${b.contact_id||b.contactId||null}, ${JSON.stringify(b.contact_ids||b.contactIds||[])}, ${b.company_id||b.companyId||null}, ${b.stage||'lead'}, ${b.value||0}, ${b.probability||20}, ${b.priority||'medium'}, ${b.next_action||b.nextAction||''}, ${b.next_action_date||b.nextActionDate||null}, ${b.expected_close_date||b.expectedCloseDate||null}, ${JSON.stringify(b.tech_tags||b.techTags||[])}, ${b.atos_sales_id||b.atosSalesId||null}, ${b.atos_delivery_id||b.atosDeliveryId||null}, ${b.stage_changed_at||b.stageChangedAt||null}, ${b.closed_reason||b.closedReason||''}, ${b.closed_note||b.closedNote||''}, ${b.deal_notes||b.dealNotes||''}, ${user.id}) RETURNING *`;
      if (b.notes?.length) for (const n of b.notes) await sql`INSERT INTO opp_notes (opp_id,text) VALUES (${opp.id},${n.text||n})`;
      return ok({ opportunity: opp });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const [opp] = await sql`UPDATE opportunities SET
        title=COALESCE(${b.title||null},title),
        contact_id=${b.contact_id!==undefined||b.contactId!==undefined?(b.contact_id||b.contactId||null):null},
        contact_ids=COALESCE(${(b.contact_ids||b.contactIds)?JSON.stringify(b.contact_ids||b.contactIds):null},contact_ids),
        company_id=${b.company_id!==undefined||b.companyId!==undefined?(b.company_id||b.companyId||null):null},
        stage=COALESCE(${b.stage||null},stage),
        value=COALESCE(${b.value!==undefined?b.value:null},value),
        probability=COALESCE(${b.probability!==undefined?b.probability:null},probability),
        priority=COALESCE(${b.priority||null},priority),
        next_action=COALESCE(${b.next_action||b.nextAction},next_action),
        next_action_date=${b.next_action_date||b.nextActionDate||null},
        expected_close_date=${b.expected_close_date||b.expectedCloseDate||null},
        tech_tags=COALESCE(${(b.tech_tags||b.techTags)?JSON.stringify(b.tech_tags||b.techTags):null},tech_tags),
        atos_sales_id=${b.atos_sales_id||b.atosSalesId||null},
        atos_delivery_id=${b.atos_delivery_id||b.atosDeliveryId||null},
        stage_changed_at=COALESCE(${b.stage_changed_at||b.stageChangedAt||null},stage_changed_at),
        closed_reason=COALESCE(${b.closed_reason||b.closedReason||null},closed_reason),
        closed_note=COALESCE(${b.closed_note||b.closedNote||null},closed_note),
        deal_notes=COALESCE(${b.deal_notes||b.dealNotes||null},deal_notes),
        closed_at=${(b.stage==='won'||b.stage==='lost'||b.stage==='dropped')?'NOW()':null},
        updated_at=NOW()
      WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      if (b.addNote) await sql`INSERT INTO opp_notes (opp_id,text) VALUES (${b.id},${b.addNote})`;
      return ok({ opportunity: opp });
    }

    if (event.httpMethod === 'DELETE') {
      const p = event.queryStringParameters || {};
      const b = parseBody(event);
      const id = p.id || b.id;
      if (!id) return err(400, 'ID vereist');
      await sql`DELETE FROM opportunities WHERE id=${id} AND user_id=${user.id}`;
      return ok({ deleted: id });
    }
    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Opps error:', e);
    return safeErr(e);
  }
};
