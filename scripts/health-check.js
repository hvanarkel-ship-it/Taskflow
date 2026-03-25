require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function check() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
  const sql = neon(process.env.DATABASE_URL);
  const start = Date.now();
  const [r] = await sql`SELECT NOW() as time, current_database() as db`;
  console.log(`✅ Connected in ${Date.now()-start}ms — ${r.db}`);
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  console.log(`Tables: ${tables.map(t=>t.tablename).join(', ')||'none (run npm run db:setup)'}`);
}

check().catch(e => { console.error('❌', e.message); process.exit(1); });
