# DPM CRM — Sales Pipeline Management

Persoonlijke, lokaal draaiende CRM met pipeline-kanban, bedrijven, contacten,
deals, taken, teambeheer, AI-assistent en CSV-import. De interface ondersteunt
Nederlands en Engels.

## Techniek

| Onderdeel | Technologie |
|---|---|
| Frontend | React 18 + Babel (single-file SPA) |
| Backend | Lokale Node.js/Express-server |
| Database | PostgreSQL (lokaal of Neon) |
| AI | Claude via de lokale serverproxy |

## Lokale installatie

```bash
git clone https://github.com/hvanarkel-ship-it/Taskflow.git
cd Taskflow
npm ci
cp .env.example .env
```

Vul daarna minimaal `DATABASE_URL` en een lange, willekeurige `JWT_SECRET` in
in `.env`. Dit bestand wordt door Git genegeerd.

```bash
npm run db:setup
npm run dev
```

Open vervolgens <http://localhost:8888>.

## Eerste beheerder

Registratie geeft nooit automatisch beheerrechten. Registreer eerst lokaal met
het adres uit `ADMIN_EMAIL` en voer daarna eenmalig uit:

```bash
npm run admin:approve
```

## Controles

```bash
npm run check
npm run db:health
```

`npm run check` controleert de JavaScript-syntax en voert beveiligingsgerichte
regressietests uit. GitHub Actions voert dezelfde controles uit bij pushes en
pull requests.

## API

| Endpoint | Functie |
|---|---|
| `POST /api/auth` | Login en registratie |
| `POST /api/ai` | AI-assistent via serverproxy |
| `/api/companies` | Bedrijven |
| `/api/contacts` | Contacten |
| `/api/opportunities` | Deals |
| `/api/tasks` | Taken |
| `/api/atos` | Teamleden |
| `/api/interactions` | Interacties |
| `GET /api/health` | Database- en configuratiestatus |

## Veiligheid

- Alle gegevens-API's vereisen een geldig JWT en beperken records per gebruiker.
- Nieuwe accounts wachten altijd op goedkeuring.
- Verwijderen van een deal en bijbehorende notities gebeurt transactioneel.
- API-verzoeken zijn beperkt tot 1 MB en 120 verzoeken per minuut per IP.
- `.env` en lokale secrets worden niet gecommit.
- `db:setup` bevat uitsluitend aanvullende, niet-destructieve migraties.
- Gebruik `db:reset` nooit op een database waarvan gegevens bewaard moeten blijven.

Deze applicatie is bedoeld voor lokaal gebruik. GitHub Pages levert geen werkende
backend, databaseverbinding of AI-proxy voor deze applicatie.
