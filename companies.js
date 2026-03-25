const { sql, ok, err, json, requireAuth } = require('./shared/db');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');

  try {
    const user = requireAuth(event);

    if (event.httpMethod === 'GET') {
      const teams = await sql`
        SELECT t.*, tm.role,
          (SELECT json_agg(jsonb_build_object(
            'id', u.id, 'name', u.name, 'role', tm2.role
          ))
          FROM team_members tm2
          JOIN users u ON u.id = tm2.user_id
          WHERE tm2.team_id = t.id) AS members
        FROM teams t
        JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ${user.id}
        ORDER BY t.created_at DESC
      `;
      return ok({ teams });
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body);

      if (b.action === 'join') {
        const [team] = await sql`SELECT id FROM teams WHERE invite_code = ${b.code}`;
        if (!team) return err(404, 'Team niet gevonden');
        await sql`INSERT INTO team_members (team_id, user_id) VALUES (${team.id}, ${user.id}) ON CONFLICT DO NOTHING`;
        return ok({ teamId: team.id });
      }

      if (b.name) {
        const code = crypto.randomBytes(6).toString('hex');
        const [team] = await sql`INSERT INTO teams (name, owner_id, invite_code) VALUES (${b.name}, ${user.id}, ${code}) RETURNING *`;
        await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${team.id}, ${user.id}, 'owner')`;
        return ok({ team });
      }

      return err(400, 'Ongeldige actie');
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    if (e.status) return err(e.status, e.message);
    console.error('Team error:', e);
    return err(500, 'Server error');
  }
};
