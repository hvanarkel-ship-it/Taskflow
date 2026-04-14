/**
 * copy-to-local.js
 * Kopieert alle data van de productie-database naar lokale PostgreSQL.
 *
 * Gebruik:
 *   1. Zet in .env:
 *        REMOTE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
 *        LOCAL_URL=postgresql://postgres:postgres@localhost:5432/crm
 *   2. Zorg dat lokale tabellen bestaan: npm run db:setup
 *   3. node scripts/copy-to-local.js
 */

require('dotenv').config();
const postgres = require('postgres');

const REMOTE_URL = process.env.REMOTE_URL || process.env.NEON_URL;
const LOCAL_URL  = process.env.LOCAL_URL || 'postgresql://postgres:postgres@localhost:5432/crm';

if (!REMOTE_URL) {
  console.error('\n❌  Zet REMOTE_URL in je .env bestand.');
  console.error('    Bijvoorbeeld:');
  console.error('    REMOTE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require\n');
  process.exit(1);
}

// Tabellen in volgorde van foreign-key afhankelijkheid (ouder → kind)
const INSERT_ORDER = [
  'users',
  'companies',
  'contacts',
  'atos_team',
  'opportunities',
  'opp_notes',
  'tasks',
  'interactions',
  'checklist_items',
];

// Omgekeerde volgorde voor TRUNCATE (kind → ouder)
const TRUNCATE_ORDER = [...INSERT_ORDER].reverse();

async function run() {
  const remote = postgres(REMOTE_URL, { ssl: 'require', max: 3, idle_timeout: 20 });
  const local  = postgres(LOCAL_URL,  { ssl: false,     max: 3, idle_timeout: 20 });

  try {
    // ── Verbindingen testen ──────────────────────────────────────────────
    process.stdout.write('🔌 Verbinding productie...  ');
    await remote`SELECT 1`;
    console.log('✅');

    process.stdout.write('🔌 Verbinding lokaal... ');
    await local`SELECT 1`;
    console.log('✅\n');

    // ── Controleer welke tabellen lokaal bestaan ─────────────────────────
    const localTables = await local`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const localTableNames = new Set(localTables.map(r => r.tablename));

    const missing = INSERT_ORDER.filter(t => !localTableNames.has(t));
    if (missing.length > 0) {
      console.error(`❌  Tabellen ontbreken lokaal: ${missing.join(', ')}`);
      console.error('    Voer eerst uit: npm run db:setup\n');
      process.exit(1);
    }

    // ── Lees alle data van productie-database ───────────────────────────
    console.log('📥 Data ophalen van productie-database...');
    const data = {};
    let totalRows = 0;
    for (const table of INSERT_ORDER) {
      try {
        data[table] = await remote`SELECT * FROM ${remote(table)} ORDER BY id`;
        console.log(`   ${table}: ${data[table].length} rijen`);
        totalRows += data[table].length;
      } catch (e) {
        console.log(`   ${table}: ⚠️  overgeslagen (${e.message})`);
        data[table] = [];
      }
    }
    console.log(`   ─────────────────────`);
    console.log(`   Totaal: ${totalRows} rijen\n`);

    // ── Lokale database leegmaken (veilige volgorde) ─────────────────────
    console.log('🗑️  Lokale data wissen...');
    for (const table of TRUNCATE_ORDER) {
      if (data[table]?.length >= 0) {
        await local`TRUNCATE TABLE ${local(table)} RESTART IDENTITY CASCADE`;
      }
    }
    console.log('   ✅ Klaar\n');

    // ── Data invoegen ────────────────────────────────────────────────────
    console.log('📤 Data invoegen in lokale database...');
    for (const table of INSERT_ORDER) {
      const rows = data[table];
      if (!rows || rows.length === 0) {
        console.log(`   ${table}: (leeg, overgeslagen)`);
        continue;
      }

      // Invoegen in batches van 100 om geheugen te sparen
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await local`INSERT INTO ${local(table)} ${local(batch)} ON CONFLICT (id) DO NOTHING`;
      }

      // Herstel de auto-increment teller na explicit-id inserts
      await local`
        SELECT setval(
          pg_get_serial_sequence(${table}, 'id'),
          COALESCE((SELECT MAX(id) FROM ${local(table)}), 1),
          true
        )
      `;

      console.log(`   ✅ ${table}: ${rows.length} rijen`);
    }

    console.log('\n🎉 Klaar! Alle data staat nu in je lokale PostgreSQL.');
    console.log(`   Verbinding: ${LOCAL_URL.replace(/:([^:@]+)@/, ':***@')}\n`);

  } finally {
    await remote.end();
    await local.end();
  }
}

run().catch(e => {
  console.error('\n❌ Fout:', e.message);
  if (e.message.includes('ECONNREFUSED')) {
    console.error('   → PostgreSQL draait niet lokaal. Start de service via Windows Services of pgAdmin.\n');
  }
  process.exit(1);
});
