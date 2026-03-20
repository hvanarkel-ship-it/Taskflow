// ═══════════════════════════════════════════════════════
// GET /api/health — DB connection check
// ═══════════════════════════════════════════════════════
const { sql, ok, err, json } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');

  try {
    const start = Date.now();
    await sql`SELECT 1 AS ok`;
    const latency = Date.now() - start;

    return ok({
      status: 'connected',
      database: 'neon',
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Health check failed:', e.message);
    return err(503, 'Database niet bereikbaar: ' + e.message);
  }
};
