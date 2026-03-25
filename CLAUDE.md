# DPM CRM — Sales Pipeline Management

Personal CRM with pipeline kanban, companies, contacts, deals, tasks, team management, AI assistant, and CSV import. Multilingual (NL/EN).

## Stack

| Layer    | Tool                              |
|----------|-----------------------------------|
| Frontend | React 18 + Babel (single-file SPA) — `public/index.html` |
| Backend  | Netlify Functions (serverless) — `netlify/functions/` |
| Database | Neon (PostgreSQL) via `@neondatabase/serverless` |
| AI       | Claude Sonnet via server-side proxy — `netlify/functions/ai.js` |
| Hosting  | Netlify (paid plan) |
| Auth     | JWT (`jsonwebtoken` + `bcryptjs`) |

## Key Files

- `public/index.html` — entire React frontend (single file, Babel transpiled in browser)
- `netlify/functions/shared/db.js` — shared DB client, JWT helpers, rate limiter
- `netlify/functions/*.js` — one file per API route (auth, companies, contacts, opportunities, tasks, atos, interactions, health)
- `scripts/setup-db.js` — safe additive DB migration (run once, idempotent)
- `scripts/reset-db.js` — DESTRUCTIVE reset, triple confirmation required
- `netlify.toml` — build config + redirect rules
- `public/sw.js` — service worker for PWA/offline
- `public/manifest.json` — PWA manifest

## Commands

```bash
npm install          # install dependencies
npm run dev          # local dev via Netlify CLI (port 8888)
npm run db:setup     # run DB migrations (safe, idempotent)
npm run db:health    # check DB connection
npm run db:reset     # DESTRUCTIVE — drops all tables
```

## Environment Variables (Netlify)

| Variable          | Description                        |
|-------------------|------------------------------------|
| `DATABASE_URL`    | Neon pooled connection string      |
| `JWT_SECRET`      | Random 64-byte hex string          |
| `ANTHROPIC_API_KEY` | From console.anthropic.com       |

For local dev, copy these to a `.env` file in the project root (gitignored).

## Architecture Notes

- **Frontend is a single-file React SPA** — all components, state, and styles live in `public/index.html`. No build step for the frontend.
- **Netlify Functions** handle all API calls. Each function exports a `handler`. Shared utilities are in `netlify/functions/shared/db.js`.
- **All API routes** are prefixed `/api/*` and rewritten to `/.netlify/functions/:splat` by `netlify.toml`.
- **Rate limiting** is in-memory per function cold start (120 req/min/IP) — not shared across instances.
- **Data safety**: `setup-db.js` only uses `CREATE IF NOT EXISTS` / `ALTER ADD IF NOT EXISTS` — never drops or truncates. Never run `reset-db.js` in production.
- **Auth**: JWT tokens expire in 30 days, issued by `/api/auth`, validated in `requireAuth()` in `shared/db.js`.

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
