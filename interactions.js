const { sql, ok, err, json } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  try {
    const checks = { database: 'unknown', jwt: 'unknown', ai: 'unknown', timestamp: new Date().toISOString() };

    checks.jwt = process.env.JWT_SECRET ? 'configured' : 'MISSING';
    checks.ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING';

    if (!sql) {
      checks.database = 'MISSING — DATABASE_URL not set';
      return json(503, { status: 'degraded', ...checks });
    }

    const start = Date.now();
    await sql`SELECT 1 AS ok`;
    checks.database = 'connected';
    checks.latency_ms = Date.now() - start;

    const healthy = checks.database === 'connected' && checks.jwt === 'configured';
    return json(healthy ? 200 : 503, { status: healthy ? 'healthy' : 'degraded', ...checks });
  } catch (e) {
    console.error('Health check failed:', e.message);
    return json(503, { status: 'unhealthy', error: 'Database niet bereikbaar', timestamp: new Date().toISOString() });
  }
};
