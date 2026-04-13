require('dotenv').config();
const postgres = require('postgres');

async function check() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
  const sql = postgres(process.env.DATABASE_URL, { ssl: false, max: 3 });
  const start = Date.now();
  const [r] = await sql`SELECT NOW() as time, current_database() as db`;
  console.log(`✅ Connected in ${Date.now()-start}ms — ${r.db}`);
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  console.log(`Tables: ${tables.map(t=>t.tablename).join(', ')||'none (run npm run db:setup)'}`);
  await sql.end();
}

check().catch(e => { console.error('❌', e.message); process.exit(1); });
