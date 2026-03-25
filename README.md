# DPM CRM — Sales Pipeline Management

Personal CRM with pipeline kanban, companies, contacts, deals, tasks, team management, AI assistant, and CSV import. Multilingual (NL/EN).

## Stack

| Layer | Tool |
|-------|------|
| Frontend | React 18 + Babel (single-file SPA) |
| Backend | Netlify Functions (serverless) |
| Database | Neon (PostgreSQL) |
| AI | Claude via server-side proxy |
| Hosting | Netlify |
| Repo | GitHub |

## Deploy

```bash
git clone https://github.com/YOUR-USER/dpm-crm.git
cd dpm-crm && npm install
```

### Netlify Environment Variables

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |

### Database Setup (one-time)
```bash
npm run db:setup    # Safe — only CREATE IF NOT EXISTS
```

## API

| Endpoint | Function |
|----------|----------|
| POST /api/auth | Login/register |
| POST /api/ai | AI assistant (server-side proxy) |
| CRUD /api/companies | Companies |
| CRUD /api/contacts | Contacts |
| CRUD /api/opportunities | Deals |
| CRUD /api/tasks | Tasks |
| CRUD /api/atos | Team members |
| CRUD /api/interactions | Interactions |
| GET /api/health | DB + config status |

## Safety

- `setup-db.js`: Zero DROP/TRUNCATE/DELETE — only additive migrations
- `reset-db.js`: Triple confirmation required
- Build command: `npm install --production` only — no DB operations
- All API DELETEs scoped to `user_id`
- Rate limiting: 120 req/min/IP
- JWT auth on all endpoints (no fallback secret)
- Input size limit: 100KB
