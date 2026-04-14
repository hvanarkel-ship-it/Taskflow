# DPM CRM — Sales Pipeline Management

Personal CRM with pipeline kanban, companies, contacts, deals, tasks, team management, AI assistant, and CSV import. Multilingual (NL/EN).

## Stack

| Layer    | Tool                              |
|----------|-----------------------------------|
| Frontend | React 18 + Babel (single-file SPA) — `public/index.html` |
| Backend  | Express.js + handler functions — `api/` |
| Database | PostgreSQL via `postgres` npm package |
| AI       | Claude Sonnet via server-side proxy — `api/ai.js` |
| Hosting  | Self-hosted, `node server.js` |
| Auth     | JWT (`jsonwebtoken` + `bcryptjs`) |

## Key Files

- `public/index.html` — entire React frontend (single file, Babel transpiled in browser)
- `api/shared/db.js` — shared DB client, JWT helpers, rate limiter
- `api/*.js` — one file per API route (auth, companies, contacts, opportunities, tasks, atos, interactions, health)
- `server.js` — Express server; adapts `api/*.js` handlers to Express req/res
- `scripts/setup-db.js` — safe additive DB migration (run once, idempotent)
- `scripts/reset-db.js` — DESTRUCTIVE reset, triple confirmation required
- `public/sw.js` — service worker for PWA/offline
- `public/manifest.json` — PWA manifest

## Commands

```bash
npm install          # install dependencies
npm run dev          # start local server (port 8888)
npm run db:setup     # run DB migrations (safe, idempotent)
npm run db:health    # check DB connection
npm run db:reset     # DESTRUCTIVE — drops all tables
```

## Environment Variables

| Variable          | Description                        |
|-------------------|------------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string       |
| `JWT_SECRET`      | Random 64-byte hex string          |
| `ANTHROPIC_API_KEY` | From console.anthropic.com       |

For local dev, copy these to a `.env` file in the project root (gitignored).

## Architecture Notes

- **Frontend is a single-file React SPA** — all components, state, and styles live in `public/index.html`. No build step for the frontend.
- **API handlers** in `api/` each export a `handler(event, context)` function. `server.js` adapts them to Express req/res.
- **All API routes** are prefixed `/api/*` and mapped to the matching handler in `api/`.
- **Rate limiting** is in-memory per process (120 req/min/IP).
- **Data safety**: `setup-db.js` only uses `CREATE IF NOT EXISTS` / `ALTER ADD IF NOT EXISTS` — never drops or truncates. Never run `reset-db.js` in production.
- **Auth**: JWT tokens expire in 30 days, issued by `/api/auth`, validated in `requireAuth()` in `api/shared/db.js`.

## Code Conventions

- Functions use CommonJS (`require`/`module.exports`), not ESM
- Frontend uses React hooks inline (`useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`)
- All Dutch UI strings are in the `TX.nl` object in `index.html`; English in `TX.en`
- `STAGES` labels are objects `{nl: '...', en: '...'}` — always use `s.l[lang]` not `s.l`
- `PRIS` (priorities) labels are also `{nl, en}` objects
- Form state for modals lives in the `mf` / `setMf` state at App level
- Modal type + id are both tracked in `prevModalRef` to ensure edits always re-initialise the form

## Gotchas

- **Never** render `s.l` directly in JSX — it's an object. Use `s.l[lang] || s.l.nl`.
- **Never** use `sudo npm install -g` for Claude Code itself.
- The `contact_ids` column in `opportunities` is a JSONB array — keep it in sync with `contact_id` (the primary FK).
- The `tags` column in `contacts` and `companies` is JSONB — always store as JSON array string.
- Frontend local storage keys are prefixed `pf_` (via `LS` helper).
- Do not add `DROP`, `TRUNCATE`, or `DELETE` statements to `setup-db.js`.
- The AI endpoint (`/api/ai`) has a 2000-character message limit and requires a valid JWT.
