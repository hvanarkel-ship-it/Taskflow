# DPM CRM — Sales Pipeline Management

Personal CRM met pipeline, bedrijven, contacten, deals, taken, Atos team, AI assistent en Excel import.

## Quick Start

```bash
git clone https://github.com/YOUR-USER/dpm-crm.git
cd dpm-crm && npm install
cp .env.example .env   # Vul DATABASE_URL + JWT_SECRET in
npm run db:setup        # Maak tabellen aan
npm run dev             # Start lokaal op :8888
```

## Deploy (Netlify + Neon)

1. **Neon**: [console.neon.tech](https://console.neon.tech) → New Project → kopieer pooled connection string
2. **GitHub**: Push naar repo
3. **Netlify**: Import project → env vars instellen:
   - `DATABASE_URL` = Neon pooled connection string
   - `JWT_SECRET` = `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
4. `npm run db:setup` (eenmalig)

## API Endpoints

| Method | Endpoint | Beschrijving |
|--------|----------|-------------|
| POST | /api/auth | Login / register |
| CRUD | /api/companies | Bedrijven |
| CRUD | /api/contacts | Contacten |
| CRUD | /api/opportunities | Deals (met contactIds, techTags, atos) |
| CRUD | /api/tasks | Taken |
| CRUD | /api/atos | Atos team (sales + delivery) |
| CRUD | /api/interactions | Interacties (call, email, meeting, note) |
| GET | /api/health | DB status + latency |

## Database (Neon PostgreSQL)

8 tabellen: users, companies, contacts, atos_team, opportunities, opp_notes, tasks, interactions
19 indexes, automatische schema migraties bij `db:setup`

## Stack

Frontend: React 18 + Babel | Backend: Netlify Functions (esbuild) | DB: Neon PostgreSQL | Auth: JWT + bcrypt | PWA: Service Worker + manifest
