const { sql, ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

// Helper: convert value to null if empty string, undefined, or not provided
const toNull = (v) => (v === '' || v === undefined || v === null) ? null : v;
const toInt = (v) => { const n = toNull(v); return n !== null ? parseInt(n) || null : null; };
const toJsonb = (v) => {
  if (v === null || v === undefined) return '[]';
  if (typeof v === 'string') return v; // already stringified
  return JSON.stringify(v);
};

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
      const val = b.value !== undefined && b.value !== '' ? Number(b.value) : 0;
      const prob = b.probability !== undefined && b.probability !== '' ? Number(b.probability) : 20;
      const [opp] = await sql`INSERT INTO opportunities (
        title, contact_id, contact_ids, company_id, stage, value, probability, priority,
        next_action, next_action_date, expected_close_date, tech_tags,
        atos_sales_id, atos_delivery_id, stage_changed_at,
        closed_reason, closed_note, deal_notes, user_id
      ) VALUES (
        ${b.title},
        ${toInt(b.contact_id)},
        ${toJsonb(b.contact_ids)}::jsonb,
        ${toInt(b.company_id)},
        ${b.stage || 'lead'},
        ${val},
        ${prob},
        ${b.priority || 'medium'},
        ${toNull(b.next_action) || ''},
        ${toNull(b.next_action_date)},
        ${toNull(b.expected_close_date)},
        ${toJsonb(b.tech_tags)}::jsonb,
        ${toInt(b.atos_sales_id)},
        ${toInt(b.atos_delivery_id)},
        ${toNull(b.stage_changed_at)},
        ${toNull(b.closed_reason) || ''},
        ${toNull(b.closed_note) || ''},
        ${toNull(b.deal_notes) || ''},
        ${user.id}
      ) RETURNING *`;
      if (b.notes && Array.isArray(b.notes) && b.notes.length > 0) {
        for (const n of b.notes) await sql`INSERT INTO opp_notes (opp_id,text) VALUES (${opp.id},${n.text||n})`;
      }
      return ok({ opportunity: opp });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const hasContact = b.contact_id !== undefined ? 1 : 0;
      const hasCompany = b.company_id !== undefined ? 1 : 0;
      const hasAtosSales = b.atos_sales_id !== undefined ? 1 : 0;
      const hasAtosDeliv = b.atos_delivery_id !== undefined ? 1 : 0;
      const hasNextDate = b.next_action_date !== undefined ? 1 : 0;
      const hasCloseDate = b.expected_close_date !== undefined ? 1 : 0;
      const hasStageChanged = b.stage_changed_at !== undefined ? 1 : 0;
      const isClosing = b.stage === 'won' || b.stage === 'lost' || b.stage === 'dropped';
      const [opp] = await sql`UPDATE opportunities SET
        title=COALESCE(${toNull(b.title)},title),
        contact_id=CASE WHEN ${hasContact}=1 THEN ${toInt(b.contact_id)} ELSE contact_id END,
        contact_ids=COALESCE(${b.contact_ids !== undefined ? toJsonb(b.contact_ids) : null}::jsonb,contact_ids),
        company_id=CASE WHEN ${hasCompany}=1 THEN ${toInt(b.company_id)} ELSE company_id END,
        stage=COALESCE(${toNull(b.stage)},stage),
        value=COALESCE(${b.value !== undefined && b.value !== '' ? Number(b.value) : null},value),
        probability=COALESCE(${b.probability !== undefined && b.probability !== '' ? Number(b.probability) : null},probability),
        priority=COALESCE(${toNull(b.priority)},priority),
        next_action=COALESCE(${b.next_action !== undefined ? (toNull(b.next_action) || '') : null},next_action),
        next_action_date=CASE WHEN ${hasNextDate}=1 THEN ${toNull(b.next_action_date)}::date ELSE next_action_date END,
        expected_close_date=CASE WHEN ${hasCloseDate}=1 THEN ${toNull(b.expected_close_date)}::date ELSE expected_close_date END,
        tech_tags=COALESCE(${b.tech_tags !== undefined ? toJsonb(b.tech_tags) : null}::jsonb,tech_tags),
        atos_sales_id=CASE WHEN ${hasAtosSales}=1 THEN ${toInt(b.atos_sales_id)} ELSE atos_sales_id END,
        atos_delivery_id=CASE WHEN ${hasAtosDeliv}=1 THEN ${toInt(b.atos_delivery_id)} ELSE atos_delivery_id END,
        stage_changed_at=CASE WHEN ${hasStageChanged}=1 THEN ${toNull(b.stage_changed_at)}::timestamptz ELSE stage_changed_at END,
        closed_reason=COALESCE(${toNull(b.closed_reason)},closed_reason),
        closed_note=COALESCE(${toNull(b.closed_note)},closed_note),
        deal_notes=COALESCE(${toNull(b.deal_notes)},deal_notes),
        closed_at=CASE WHEN ${isClosing?1:0}=1 THEN ${new Date().toISOString()}::timestamptz ELSE closed_at END,
        updated_at=NOW()
      WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      if (b.add_note) await sql`INSERT INTO opp_notes (opp_id,text) VALUES (${b.id},${b.add_note})`;
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
    console.error('Opps error:', e.message || e);
    return safeErr(e);
  }
};
