# DPM CRM — Sales Pipeline Management

Persoonlijk CRM met pipeline, bedrijven, contacten, deals, taken, Atos team, AI assistent en CSV import.

## Stack

| Laag | Tool | Rol |
|------|------|-----|
| AI | Claude (Anthropic API) | AI sales assistent — via beveiligde Netlify Function |
| Code | GitHub | Versiebeheer |
| Database | Neon (PostgreSQL) | Serverless Postgres |
| Hosting | Netlify | Frontend + serverless backend functions |

---

## Quick Start (lokaal)

```bash
git clone https://github.com/YOUR-USER/dpm-crm.git
cd dpm-crm
npm install
cp .env.example .env        # Vul DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY in
npm run db:setup             # Maak database tabellen aan (eenmalig)
npm run dev                  # Start op http://localhost:8888
```

---

## Deploy naar Netlify

### 1. Neon database
- Ga naar [console.neon.tech](https://console.neon.tech) → New Project
- Maak twee branches: `main` (productie) en `dev` (lokaal)
- Kopieer de **pooled connection string** van de `main` branch

### 2. GitHub
```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USER/dpm-crm.git
git push -u origin main
```

### 3. Netlify
1. [app.netlify.com](https://app.netlify.com) → Add new site → Import from GitHub
2. **Site Settings → Environment Variables** — voeg toe:

| Variable | Waarde |
|----------|--------|
| `DATABASE_URL` | Neon pooled connection string (main branch) |
| `JWT_SECRET` | Output van: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | Van [console.anthropic.com](https://console.anthropic.com) → API Keys |

### 4. Database setup
```bash
npm run db:setup
```

---

## Development Workflow

```bash
git checkout -b feature/nieuwe-functie   # Nieuwe branch
# ... wijzigingen maken ...
git push origin feature/nieuwe-functie  # Netlify maakt preview URL aan
# Test → merge naar main → auto-deploy productie
```

---

## API Endpoints

| Method | Endpoint | Beschrijving |
|--------|----------|-------------|
| POST | /api/auth | Login / registreer |
| POST | /api/ai | AI assistent (beveiligde Claude proxy) |
| CRUD | /api/companies | Bedrijven |
| CRUD | /api/contacts | Contacten |
| CRUD | /api/opportunities | Deals |
| CRUD | /api/tasks | Taken |
| CRUD | /api/atos | Atos team |
| CRUD | /api/interactions | Interacties |
| GET | /api/health | Database status |

---

## Quick Reference

| Actie | Command |
|-------|---------|
| Start lokale dev | `npm run dev` |
| Database tabellen aanmaken | `npm run db:setup` |
| Database health check | `npm run db:health` |
| Database resetten | `npm run db:reset` |
| Nieuwe branch | `git checkout -b feature/naam` |
| Deploy naar preview | `git push origin feature/naam` |
| Deploy naar productie | Merge PR naar `main` |
