# ✦ TaskFlow Pro V2

AI-powered taakmanagement en productiviteitscoaching — PWA voor Netlify + Neon.

## 🚀 Deploy (15 min)

### 1. GitHub Repo
```bash
git init && git add . && git commit -m "TaskFlow Pro V2"
git branch -M main
git remote add origin https://github.com/JOUW-USERNAME/taskflow-pro.git
git push -u origin main
```

### 2. Neon Database
- [console.neon.tech](https://console.neon.tech) → New Project → kopieer connection string

### 3. Netlify
- [app.netlify.com](https://app.netlify.com) → Import existing project → selecteer repo
- Publish directory: `public`
- Functions directory: `netlify/functions`

### 4. Environment Variables (Netlify → Site Settings)
| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |

### 5. Database tabellen
```bash
npm install && cp .env.example .env
# vul DATABASE_URL in
node scripts/setup-db.js
```

### 6. Icons
Maak `icon-192.png` en `icon-512.png` vanuit `public/icons/icon.svg`

---

## ⚡ Features

- 30-minuten planner met dag/week navigatie
- Drag & drop naar tijdsloten en tussen dagen
- Subtaken en taken samenvoegen
- Herhalende taken (dagelijks/wekelijks/maandelijks)
- AI Coach (Claude API + lokale fallback)
- Team management (toevoegen/verwijderen)
- Pomodoro timer per taak
- SVG statistieken (bar + donut chart)
- Dark/Light mode
- Export: Outlook (.ics), Apple Calendar, e-mail rapport
- Per-taak .ics download met 15-min herinnering
- Confetti bij afvinken
- PWA — installeerbaar op alle apparaten
- Responsive: desktop, tablet, mobiel

## 📁 Structuur

```
public/index.html          ← Frontend (React + Babel)
public/sw.js               ← Service Worker
public/manifest.json       ← PWA manifest
netlify/functions/auth.js  ← Login/register API
netlify/functions/tasks.js ← CRUD taken API
netlify/functions/team.js  ← Team API
scripts/setup-db.js        ← Database migratie
```

## ✅ Test Checklist

**Planner:** tijdsloten, datumnavigatie, nu-lijn, slot-klik, conflict-check
**Drag & Drop:** sleep naar slot, tussen slots, tussen dagen, naar buiten (.ics)
**Taken:** aanmaken, bewerken, verwijderen, afvinken, ongepland verwijderen
**Subtaken:** toevoegen, afvinken, voortgang, samenvoegen
**Herhaling:** dagelijks/werkdagen/wekelijks/maandelijks, 🔄 indicator
**Team:** leden toevoegen/verwijderen, toewijzen, voortgang
**AI Coach:** chat, zoek, tips, planning, rapport, Claude API + fallback
**Pomodoro:** 25/5 timer, cirkel, start/pauze/reset, rondeteller
**Export:** Outlook .ics, Apple Calendar, per-taak .ics, mail rapport, VALARM
**Statistieken:** bar chart, donut chart, voortgang
**Dark/Light:** toggle, alle kleuren
**PWA:** Service Worker, manifest, installeerbaar
**Responsive:** desktop, tablet, mobiel
