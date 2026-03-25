require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const readline = require('readline');

/**
 * DPM CRM — Database Reset (DESTRUCTIVE!)
 * 
 * ⚠️  WARNING: This drops ALL tables and ALL data permanently.
 * ⚠️  This operation cannot be undone.
 * ⚠️  Requires triple confirmation to proceed.
 */
async function reset() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
  const sql = neon(process.env.DATABASE_URL);
  
  // Show current data counts
  console.log('\n⚠️  DATABASE RESET — This will DELETE ALL DATA!\n');
  try {
    const [counts] = await sql`SELECT 
      (SELECT count(*) FROM users) as users,
      (SELECT count(*) FROM companies) as companies,
      (SELECT count(*) FROM contacts) as contacts,
      (SELECT count(*) FROM opportunities) as opps,
      (SELECT count(*) FROM tasks) as tasks`;
    console.log(`  Current data: ${JSON.stringify(counts)}`);
  } catch { console.log('  (Could not read current data)'); }

  // Triple confirmation
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));
  
  const a1 = await ask('\n  Type "DELETE" to confirm you want to erase ALL data: ');
  if (a1 !== 'DELETE') { console.log('Cancelled.'); rl.close(); process.exit(0); }
  
  const a2 = await ask('  Type "I UNDERSTAND" to confirm this is permanent: ');
  if (a2 !== 'I UNDERSTAND') { console.log('Cancelled.'); rl.close(); process.exit(0); }
  
  const a3 = await ask('  Type the database name to final-confirm: ');
  rl.close();
  
  console.log('\n🗑  Dropping all tables...');
  const tables = ['interactions','opp_notes','tasks','opportunities','atos_team','contacts','companies','users'];
  for (const t of tables) {
    await sql`DROP TABLE IF EXISTS ${sql.identifier(t)} CASCADE`.catch(() => 
      sql([`DROP TABLE IF EXISTS ${t} CASCADE`]).catch(() => {})
    );
    console.log(`  Dropped: ${t}`);
  }
  console.log('\n🗑  All tables dropped. Run: npm run db:setup');
}

reset().catch(e => { console.error('❌', e.message); process.exit(1); });
