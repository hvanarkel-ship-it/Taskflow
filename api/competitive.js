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
      let accounts;
      if (p.id) {
        accounts = await sql`SELECT * FROM competitive_accounts WHERE id=${p.id} AND user_id=${user.id}`;
      } else {
        accounts = await sql`SELECT * FROM competitive_accounts WHERE user_id=${user.id} ORDER BY company_name ASC LIMIT 500`;
      }
      return ok({ accounts });
    }

    if (event.httpMethod === 'POST') {
      const b = parseBody(event);
      if (!b.company_name) return err(400, 'Bedrijfsnaam is vereist');
      const [acct] = await sql`INSERT INTO competitive_accounts (
        company_name, website, size, industry_vertical, vendor, products_used,
        estimated_arr, renewal_date, acquisition_status, lead_source,
        incumbent_satisfaction, decision_maker, champion, contacts, pain_points, notes, user_id
      ) VALUES (
        ${b.company_name},
        ${toNull(b.website) || ''},
        ${toNull(b.size) || ''},
        ${toNull(b.industry_vertical) || ''},
        ${toNull(b.vendor) || 'dynatrace'},
        ${toJsonb(b.products_used)}::jsonb,
        ${b.estimated_arr ? parseInt(b.estimated_arr) : 0},
        ${toNull(b.renewal_date)},
        ${toNull(b.acquisition_status) || 'prospect'},
        ${toNull(b.lead_source) || ''},
        ${toNull(b.incumbent_satisfaction) || 'medium'},
        ${toNull(b.decision_maker) || ''},
        ${toNull(b.champion) || ''},
        ${toJsonb(b.contacts)}::jsonb,
        ${toNull(b.pain_points) || ''},
        ${toNull(b.notes) || ''},
        ${user.id}
      ) RETURNING *`;
      return ok({ account: acct });
    }

    if (event.httpMethod === 'PUT') {
      const b = parseBody(event);
      if (!b.id) return err(400, 'ID vereist');
      const [acct] = await sql`UPDATE competitive_accounts SET
        company_name=COALESCE(${toNull(b.company_name)},company_name),
        website=COALESCE(${b.website !== undefined ? (toNull(b.website) || '') : null},website),
        size=COALESCE(${b.size !== undefined ? (toNull(b.size) || '') : null},size),
        industry_vertical=COALESCE(${b.industry_vertical !== undefined ? (toNull(b.industry_vertical) || '') : null},industry_vertical),
        vendor=COALESCE(${b.vendor !== undefined ? (toNull(b.vendor) || 'dynatrace') : null},vendor),
        products_used=COALESCE(${b.products_used !== undefined ? toJsonb(b.products_used) : null}::jsonb,products_used),
        estimated_arr=COALESCE(${b.estimated_arr !== undefined ? parseInt(b.estimated_arr) || 0 : null},estimated_arr),
        renewal_date=COALESCE(${b.renewal_date !== undefined ? toNull(b.renewal_date) : null},renewal_date),
        acquisition_status=COALESCE(${b.acquisition_status !== undefined ? (toNull(b.acquisition_status) || 'prospect') : null},acquisition_status),
        lead_source=COALESCE(${b.lead_source !== undefined ? (toNull(b.lead_source) || '') : null},lead_source),
        incumbent_satisfaction=COALESCE(${b.incumbent_satisfaction !== undefined ? (toNull(b.incumbent_satisfaction) || 'medium') : null},incumbent_satisfaction),
        decision_maker=COALESCE(${b.decision_maker !== undefined ? (toNull(b.decision_maker) || '') : null},decision_maker),
        champion=COALESCE(${b.champion !== undefined ? (toNull(b.champion) || '') : null},champion),
        contacts=COALESCE(${b.contacts !== undefined ? toJsonb(b.contacts) : null}::jsonb,contacts),
        pain_points=COALESCE(${b.pain_points !== undefined ? (toNull(b.pain_points) || '') : null},pain_points),
        notes=COALESCE(${b.notes !== undefined ? (toNull(b.notes) || '') : null},notes),
        updated_at=NOW()
      WHERE id=${b.id} AND user_id=${user.id} RETURNING *`;
      return ok({ account: acct });
    }

    if (event.httpMethod === 'DELETE') {
      const p = event.queryStringParameters || {};
      const b = parseBody(event);
      const id = p.id || b.id;
      if (!id) return err(400, 'ID vereist');
      await sql`DELETE FROM competitive_accounts WHERE id=${id} AND user_id=${user.id}`;
      return ok({ deleted: id });
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error('Competitive error:', e.message || e);
    return safeErr(e);
  }
};
