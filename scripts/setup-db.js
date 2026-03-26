require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

/**
 * DPM CRM — Database Setup & Migration
 * 
 * SAFETY: This script ONLY uses CREATE IF NOT EXISTS and ALTER ADD IF NOT EXISTS.
 * It NEVER drops tables, deletes data, or alters existing columns.
 * Safe to run on every deploy — idempotent by design.
 */
async function setup() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
  const sql = neon(process.env.DATABASE_URL);
  
  const start = Date.now();
  console.log('🔌 Connecting to Neon...');
  await sql`SELECT 1`;
  console.log(`✅ Connected (${Date.now()-start}ms)`);

  // ─── TABLES (CREATE IF NOT EXISTS — safe, never destructive) ───

  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY, name VARCHAR(500) NOT NULL,
    website VARCHAR(500) DEFAULT '', industry VARCHAR(255) DEFAULT '',
    address VARCHAR(500) DEFAULT '', size VARCHAR(50) DEFAULT '',
    phone VARCHAR(50) DEFAULT '', email VARCHAR(255) DEFAULT '',
    notes TEXT DEFAULT '', tags JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY, name VARCHAR(500) NOT NULL,
    email VARCHAR(255) DEFAULT '', phone VARCHAR(50) DEFAULT '',
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    role VARCHAR(255) DEFAULT '', tags JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS atos_team (
    id SERIAL PRIMARY KEY, name VARCHAR(500) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'sales',
    email VARCHAR(255) DEFAULT '', phone VARCHAR(50) DEFAULT '',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS opportunities (
    id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    contact_ids JSONB DEFAULT '[]',
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'lead',
    value INTEGER DEFAULT 0, probability INTEGER DEFAULT 20,
    priority VARCHAR(20) DEFAULT 'medium',
    next_action VARCHAR(500) DEFAULT '', next_action_date DATE,
    tech_tags JSONB DEFAULT '[]',
    atos_sales_id INTEGER REFERENCES atos_team(id) ON DELETE SET NULL,
    atos_delivery_id INTEGER REFERENCES atos_team(id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS opp_notes (
    id SERIAL PRIMARY KEY,
    opp_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
    text TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    opp_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
    due_date DATE, due_time VARCHAR(5),
    priority VARCHAR(20) DEFAULT 'medium',
    reminder BOOLEAN DEFAULT false, reminder_min INTEGER DEFAULT 15,
    done BOOLEAN DEFAULT false,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    opp_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'note',
    text TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW())`;

  console.log('✅ 8 tables verified');

  // ─── INDEXES (CREATE IF NOT EXISTS — safe) ───

  await sql`CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_atos_user ON atos_team(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_user ON opportunities(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_stage ON opportunities(stage)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_company ON opportunities(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_contact ON opportunities(contact_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_atos_s ON opportunities(atos_sales_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_atos_d ON opportunities(atos_delivery_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notes_opp ON opp_notes(opp_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(due_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_opp ON tasks(opp_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_int_user ON interactions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_int_contact ON interactions(contact_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_int_opp ON interactions(opp_id)`;
  console.log('✅ 18 indexes verified');

  // ─── COLUMN MIGRATIONS (ADD IF NOT EXISTS — safe for existing data) ───
  // These add new columns to existing tables without touching existing data.

  const migrations = [
    // v2.0: added multi-contact, tech tags, atos team to opportunities
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_ids JSONB DEFAULT '[]'", v: '2.0' },
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tech_tags JSONB DEFAULT '[]'", v: '2.0' },
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS atos_sales_id INTEGER", v: '2.0' },
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS atos_delivery_id INTEGER", v: '2.0' },
    // v3.0: tags on contacts/companies (may already exist from CREATE)
    { sql: "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'", v: '3.0' },
    { sql: "ALTER TABLE companies ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'", v: '3.0' },
    // v4.0: expected close date, contact category
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS expected_close_date DATE", v: '4.0' },
    { sql: "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT ''", v: '4.0' },
    // v16: win/loss reasons, deal notes, stage velocity
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ", v: '16' },
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS closed_reason VARCHAR(100) DEFAULT ''", v: '16' },
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS closed_note TEXT DEFAULT ''", v: '16' },
    { sql: "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS deal_notes TEXT DEFAULT ''", v: '16' },
  ];

  let migrated = 0;
  for (const m of migrations) {
    try { await sql([m.sql]); migrated++; } catch (e) { /* column already exists */ }
  }
  console.log(`✅ ${migrations.length} migrations checked (${migrated} applied)`);

  // ─── VERIFY ───
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  console.log(`\n📊 Tables: ${tables.map(t=>t.tablename).join(', ')}`);
  
  const [counts] = await sql`SELECT 
    (SELECT count(*) FROM users) as users,
    (SELECT count(*) FROM companies) as companies,
    (SELECT count(*) FROM contacts) as contacts,
    (SELECT count(*) FROM opportunities) as opps,
    (SELECT count(*) FROM tasks) as tasks,
    (SELECT count(*) FROM atos_team) as atos,
    (SELECT count(*) FROM interactions) as interactions`;
  console.log(`📊 Records: ${JSON.stringify(counts)}`);
  console.log(`\n🎉 DPM CRM database ready! (${Date.now()-start}ms)`);
}

setup().catch(e => { console.error('❌', e.message); process.exit(1); });
