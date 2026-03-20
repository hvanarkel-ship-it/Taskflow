// Run: node scripts/health-check.js
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function check() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🔌 Pinging Neon...');

  try {
    const start = Date.now();
    const [r] = await sql`SELECT NOW() as time, current_database() as db`;
    const ms = Date.now() - start;
    console.log(`✅ Connected in ${ms}ms`);
    console.log(`   Database: ${r.db}`);
    console.log(`   Server time: ${r.time}`);

    // Check tables
    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
    console.log(`   Tables: ${tables.map(t=>t.tablename).join(', ') || 'none (run npm run db:setup)'}`);

    // Check row counts
    for (const t of tables) {
      const [c] = await sql`SELECT count(*)::int as n FROM ${sql(t.tablename)}`;
      console.log(`   → ${t.tablename}: ${c.n} rows`);
    }
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }
}

check();
