require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function reset() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
  const sql = neon(process.env.DATABASE_URL);
  console.log('⚠️  Resetting DPM CRM database...');
  for (const t of ['interactions','opp_notes','tasks','opportunities','atos_team','contacts','companies','users'])
    await sql`DROP TABLE IF EXISTS ${sql(t)} CASCADE`;
  console.log('🗑  All tables dropped. Run npm run db:setup to recreate.');
}

reset().catch(e => { console.error('❌', e.message); process.exit(1); });
