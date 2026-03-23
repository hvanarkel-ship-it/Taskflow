# DPM CRM — Sales Pipeline

Sales pipeline management met contacten, bedrijven, deals, taken en herinneringen.

## Setup (10 min)

### 1. Clone & Install
```bash
git clone https://github.com/YOUR-USERNAME/dpm-crm.git
cd dpm-crm && npm install
```

### 2. Neon Database
- [console.neon.tech](https://console.neon.tech) → New Project
- Kopieer pooled connection string
```bash
cp .env.example .env
# Vul DATABASE_URL en JWT_SECRET in
npm run db:setup
npm run db:health
```

### 3. Netlify
- [app.netlify.com](https://app.netlify.com) → Import project → selecteer repo
- Publish: `public` — Functions: `netlify/functions`
- Env vars: `DATABASE_URL` + `JWT_SECRET`

## Features

**Pipeline** — Kanban board met drag & drop (Lead → Gekwalificeerd → Voorstel → Onderhandeling → Gewonnen/Verloren)
**Bedrijven** — Bedrijfsprofielen, ook zonder contactpersonen
**Contacten** — Gekoppeld aan bedrijven, met tags en deals
**Deals** — Waarde, kans%, prioriteit, volgende actie, notities
**Taken** — Deadline + tijd, prioriteit, herinnering (browser notificatie), gekoppeld aan deals
**Rapporten** — Visuele sales funnel, conversie per fase, pipeline waarde chart
**Dark/Light mode** — Apple design language

## API

```
GET/POST          /api/auth         Login/register
GET/POST/PUT/DEL  /api/companies    Bedrijven CRUD
GET/POST/PUT/DEL  /api/contacts     Contacten CRUD
GET/POST/PUT/DEL  /api/opportunities Deals CRUD + notities
GET/POST/PUT/DEL  /api/tasks        Taken CRUD
GET               /api/health       DB status
```

## Stack

Frontend: React 18 + Babel | Backend: Netlify Functions (esbuild) | DB: Neon PostgreSQL | Auth: JWT + bcrypt | PWA: Service Worker
