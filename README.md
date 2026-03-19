# ✦ TaskFlow Pro

**AI-powered taakmanagement & productiviteitscoaching — PWA**

Een complete productiviteits-app met 30-minuten tijdslot planning, team-samenwerking, AI coaching, en real-time rapportages. Gebouwd voor Netlify + Neon PostgreSQL.

---

## 🚀 Deploy naar Productie (15 minuten)

### Stap 1: Neon Database aanmaken

1. Ga naar **[console.neon.tech](https://console.neon.tech)** en maak een gratis account
2. Klik **"New Project"** → noem het `taskflow-pro`
3. Kopieer de **Connection String** (die begint met `postgresql://...`)
4. Bewaar deze — je hebt hem straks nodig

### Stap 2: Netlify deployen

#### Optie A: Via GitHub (aanbevolen)

1. Push deze map naar een **GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/JOUW-USERNAME/taskflow-pro.git
   git push -u origin main
   ```
2. Ga naar **[app.netlify.com](https://app.netlify.com)**
3. Klik **"Add new site"** → **"Import an existing project"**
4. Selecteer je GitHub repo
5. Settings:
   - **Build command:** _(laat leeg)_
   - **Publish directory:** `public`
6. Klik **"Deploy site"**

#### Optie B: Drag & Drop (snelste)

1. Ga naar **[app.netlify.com/drop](https://app.netlify.com/drop)**
2. Sleep de **`public`** map naar het scherm
3. Je site is live! (maar functies werken nog niet — gebruik optie A voor volledige functionaliteit)

### Stap 3: Environment Variables instellen

1. In Netlify: ga naar **Site Settings** → **Environment Variables**
2. Voeg toe:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Je Neon connection string |
| `JWT_SECRET` | Genereer met: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |

### Stap 4: Database tabellen aanmaken

```bash
# Lokaal (eenmalig):
npm install
cp .env.example .env
# Vul DATABASE_URL in .env
node scripts/setup-db.js
```

### Stap 5: PWA Icons genereren

Voor de beste ervaring op telefoons, maak 192x192 en 512x512 PNG icons:
- Open `public/icons/icon.svg` in een browser
- Screenshot op 192×192 → sla op als `public/icons/icon-192.png`
- Screenshot op 512×512 → sla op als `public/icons/icon-512.png`

Of gebruik een tool als [realfavicongenerator.net](https://realfavicongenerator.net)

### ✅ Klaar!

Je app is nu live op `https://jouw-site.netlify.app`

---

## 📱 Installeren als App

- **iPhone/iPad:** Open in Safari → Deel-knop → "Zet op beginscherm"
- **Android:** Open in Chrome → Menu → "App installeren"
- **Desktop:** Chrome adresbalk → installatie-icoon

---

## 🏗 Projectstructuur

```
taskflow-pro/
├── public/                    ← Frontend (wordt geserved door Netlify)
│   ├── index.html             ← Volledige React PWA app
│   ├── manifest.json          ← PWA manifest
│   ├── sw.js                  ← Service Worker (offline support)
│   └── icons/                 ← PWA iconen
├── netlify/
│   └── functions/             ← Backend API (serverless)
│       ├── shared/db.js       ← Database & auth helpers
│       ├── auth.js            ← POST /api/auth (login/register)
│       ├── tasks.js           ← CRUD /api/tasks
│       └── team.js            ← /api/team management
├── scripts/
│   └── setup-db.js            ← Database migratie script
├── netlify.toml               ← Netlify configuratie
├── package.json
├── .env.example               ← Template voor environment vars
└── README.md
```

## 🔌 API Endpoints

| Method | Endpoint | Beschrijving |
|--------|----------|-------------|
| POST | `/api/auth` | `{action:"register"\|"login", email, password, name?}` |
| GET | `/api/tasks?date=YYYY-MM-DD` | Taken ophalen per dag |
| GET | `/api/tasks?from=&to=` | Taken ophalen voor periode |
| GET | `/api/tasks` | Alle taken |
| POST | `/api/tasks` | Nieuwe taak aanmaken |
| PUT | `/api/tasks` | Taak bijwerken |
| DELETE | `/api/tasks` | Taak verwijderen |
| GET | `/api/team` | Teams ophalen |
| POST | `/api/team` | Team aanmaken of joinen |

Alle endpoints (behalve auth) vereisen: `Authorization: Bearer <token>`

## ⚡ Features

- **30-minuten planner** met dag/week navigatie
- **Toekomst-planning** — plan taken voor elke datum
- **Team takenlijst** — wijs taken toe aan teamleden
- **AI Coach** — zoek, analyseer, planning-advies
- **Categorieën** — Werk, Sport, Ontspanning, Persoonlijk, Zakelijk
- **Notities & Hyperlinks** per taak
- **Positieve feedback** bij afvinken (confetti!)
- **Outlook export** (.ics met tijdsloten)
- **Dagrapport per mail**
- **CSV export**
- **Offline support** via Service Worker
- **Installeerbaar** als PWA op alle apparaten
- **Responsive** — werkt op desktop, tablet, mobiel

## 📄 Licentie

MIT
