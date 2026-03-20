# ✦ TaskFlow Pro V2

AI-powered taakmanagement & productiviteitscoaching — PWA

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

## 🚀 Setup (10 minuten)

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR-USERNAME/taskflow-pro.git
cd taskflow-pro
npm install
```

### 2. Neon Database
1. [console.neon.tech](https://console.neon.tech) → **New Project** → `taskflow-pro`
2. Kopieer de **pooled connection string**
3. Maak tabellen aan:
```bash
cp .env.example .env
# Vul DATABASE_URL en JWT_SECRET in .env
npm run db:setup
npm run db:health    # Verifieer verbinding
```

### 3. Netlify
1. [app.netlify.com](https://app.netlify.com) → **Import existing project** → selecteer repo
2. Publish dir: `public` — Functions dir: `netlify/functions`
3. **Environment Variables** toevoegen:

| Variable | Waarde |
|----------|--------|
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |

### 4. GitHub Secrets (optioneel, voor CI)
Settings → Secrets → Actions: voeg `DATABASE_URL` toe voor automatische DB health checks bij elke push.

### 5. PWA Icons
Genereer vanuit `public/icons/icon.svg`:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)

---

## ⚡ Features

**Planning:** 30-min tijdsloten, dag/week navigatie, drag & drop, toekomst-planning
**Taken:** CRUD, subtaken, samenvoegen, herhalende taken, prioriteiten
**Team:** Leden toevoegen/verwijderen, taken toewijzen, voortgang per lid
**AI Coach:** Claude API + lokale fallback, zoek/plan/tip/rapport commando's
**Pomodoro:** 25/5 timer per taak met visuele voortgang
**Export:** Outlook .ics, Apple Calendar, per-taak .ics (met VALARM), mail rapport
**Statistieken:** SVG bar + donut charts, voortgang, categorieverdeling
**Dark/Light mode**, responsive, PWA installeerbaar, offline localStorage

## 🏗 Stack

| Laag | Technologie |
|------|-------------|
| Frontend | React 18 + Babel (single HTML) |
| Backend | Netlify Functions (esbuild) |
| Database | Neon PostgreSQL (serverless) |
| Auth | JWT + bcrypt |
| Hosting | Netlify CDN |
| CI/CD | GitHub Actions |
| PWA | Service Worker + Web Manifest |

## 📁 Structuur
```
public/index.html              ← Complete React app
public/sw.js                   ← Service Worker (offline)
public/manifest.json           ← PWA manifest
netlify.toml                   ← Deploy + cache + security config
netlify/functions/health.js    ← DB health check
netlify/functions/auth.js      ← Login/register
netlify/functions/tasks.js     ← CRUD taken + subtaken
netlify/functions/team.js      ← Team management
netlify/functions/shared/db.js ← DB pool + JWT + CORS
scripts/setup-db.js            ← Maak tabellen
scripts/reset-db.js            ← Reset DB (dev)
scripts/health-check.js        ← CLI DB check
.github/workflows/deploy.yml   ← CI/CD pipeline
```

## 🔧 Scripts
```bash
npm run dev          # Lokaal draaien (netlify dev)
npm run db:setup     # Tabellen aanmaken
npm run db:health    # Verbinding testen
npm run db:reset     # ⚠️ Alles wissen (dev only)
```

## 🔌 API
```
GET  /api/health                     → DB status + latency
POST /api/auth  {action,email,pass}  → JWT token
GET  /api/tasks?date=YYYY-MM-DD     → Taken per dag
POST /api/tasks {title,...}          → Nieuwe taak
PUT  /api/tasks {id,...}             → Update taak
DEL  /api/tasks {id}                → Verwijder taak
GET  /api/team                       → Teams + leden
POST /api/team {name}                → Nieuw team
```
Alle endpoints (behalve health/auth) vereisen `Authorization: Bearer <token>`

## 📄 Licentie
MIT
