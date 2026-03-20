// Run: node scripts/reset-db.js
// ⚠️ WARNING: This drops all tables and recreates them!
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function reset() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('⚠️  Resetting database...');

  await sql`DROP TABLE IF EXISTS task_subtasks CASCADE`;
  await sql`DROP TABLE IF EXISTS task_links CASCADE`;
  await sql`DROP TABLE IF EXISTS task_notes CASCADE`;
  await sql`DROP TABLE IF EXISTS tasks CASCADE`;
  await sql`DROP TABLE IF EXISTS team_members CASCADE`;
  await sql`DROP TABLE IF EXISTS teams CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;

  console.log('🗑  All tables dropped');
  console.log('💡 Run "npm run db:setup" to recreate tables');
}

reset().catch(e => { console.error('❌', e.message); process.exit(1); });
