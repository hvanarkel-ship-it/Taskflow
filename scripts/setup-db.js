require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function setup() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }
  const sql = neon(process.env.DATABASE_URL);
  console.log('🔌 Connecting to Neon...');

  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('✅ users');

  await sql`CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY, name VARCHAR(500) NOT NULL,
    website VARCHAR(500) DEFAULT '', industry VARCHAR(255) DEFAULT '',
    address VARCHAR(500) DEFAULT '', size VARCHAR(50) DEFAULT '',
    phone VARCHAR(50) DEFAULT '', email VARCHAR(255) DEFAULT '',
    notes TEXT DEFAULT '', tags JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('✅ companies');

  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY, name VARCHAR(500) NOT NULL,
    email VARCHAR(255) DEFAULT '', phone VARCHAR(50) DEFAULT '',
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    role VARCHAR(255) DEFAULT '', tags JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('✅ contacts');

  await sql`CREATE TABLE IF NOT EXISTS opportunities (
    id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'lead',
    value INTEGER DEFAULT 0, probability INTEGER DEFAULT 20,
    priority VARCHAR(20) DEFAULT 'medium',
    next_action VARCHAR(500) DEFAULT '', next_action_date DATE,
    closed_at TIMESTAMPTZ,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('✅ opportunities');

  await sql`CREATE TABLE IF NOT EXISTS opp_notes (
    id SERIAL PRIMARY KEY,
    opp_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
    text TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('✅ opp_notes');

  await sql`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    opp_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
    due_date DATE, due_time VARCHAR(5),
    priority VARCHAR(20) DEFAULT 'medium',
    reminder BOOLEAN DEFAULT false, reminder_min INTEGER DEFAULT 15,
    done BOOLEAN DEFAULT false,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('✅ tasks');

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_user ON opportunities(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_stage ON opportunities(stage)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_company ON opportunities(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opps_contact ON opportunities(contact_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opp_notes_opp ON opp_notes(opp_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(due_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_opp ON tasks(opp_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id)`;
  console.log('✅ indexes');

  console.log('\n🎉 DPM CRM database ready!');
}

setup().catch(e => { console.error('❌', e.message); process.exit(1); });
