require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function reset() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
  const sql = neon(process.env.DATABASE_URL);
  console.log('⚠️  Resetting DPM CRM database...');
  await sql`DROP TABLE IF EXISTS interactions CASCADE`;
  await sql`DROP TABLE IF EXISTS opp_notes CASCADE`;
  await sql`DROP TABLE IF EXISTS tasks CASCADE`;
  await sql`DROP TABLE IF EXISTS opportunities CASCADE`;
  await sql`DROP TABLE IF EXISTS atos_team CASCADE`;
  await sql`DROP TABLE IF EXISTS contacts CASCADE`;
  await sql`DROP TABLE IF EXISTS companies CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  console.log('🗑  All 8 tables dropped. Run npm run db:setup to recreate.');
}

reset().catch(e => { console.error('❌', e.message); process.exit(1); });
