// ═══════════════════════════════════════════════════════
// TaskFlow Pro — Database Setup (Neon PostgreSQL)
// Run: node scripts/setup-db.js
// ═══════════════════════════════════════════════════════
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function setup() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Copy .env.example to .env and add your Neon connection string.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🔌 Connecting to Neon...');

  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name          VARCHAR(255) NOT NULL,
      initials      VARCHAR(4),
      color         VARCHAR(7) DEFAULT '#6c5ce7',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ users table');

  // Teams table
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      owner_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
      invite_code VARCHAR(20) UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ teams table');

  // Team members
  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id       SERIAL PRIMARY KEY,
      team_id  INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role     VARCHAR(20) DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(team_id, user_id)
    )
  `;
  console.log('✅ team_members table');

  // Tasks table with all fields
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id           SERIAL PRIMARY KEY,
      title        VARCHAR(500) NOT NULL,
      category     VARCHAR(50) NOT NULL DEFAULT 'werk',
      priority     VARCHAR(20) NOT NULL DEFAULT 'medium',
      due_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      time_slot    VARCHAR(5),
      duration     INTEGER DEFAULT 30,
      recur        VARCHAR(20) DEFAULT 'none',
      completed    BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMPTZ,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      assignee_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      team_id      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ tasks table');

  // Subtasks
  await sql`
    CREATE TABLE IF NOT EXISTS task_subtasks (
      id         SERIAL PRIMARY KEY,
      task_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      title      VARCHAR(500) NOT NULL,
      done       BOOLEAN DEFAULT FALSE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ task_subtasks table');

  // Task notes
  await sql`
    CREATE TABLE IF NOT EXISTS task_notes (
      id         SERIAL PRIMARY KEY,
      task_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ task_notes table');

  // Task links
  await sql`
    CREATE TABLE IF NOT EXISTS task_links (
      id      SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      url     TEXT NOT NULL,
      label   VARCHAR(255)
    )
  `;
  console.log('✅ task_links table');

  // Indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, due_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_notes_task ON task_notes(task_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_links_task ON task_links(task_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks(task_id)`;
  console.log('✅ indexes');

  console.log('\n🎉 Database setup complete! Tables are ready in Neon.');
}

setup().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
