# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A full-stack dashboard for browsing Czech firesport attack results stored in a Supabase
`public.timestamps` table. Users filter/sort/paginate rows and see live aggregate stats and
charts. Admins can additionally edit/insert/delete rows inline. The UI text is in **Czech**.

## Commands

All commands run from the repo root (npm workspaces: `client` + `server`).

```bash
npm install                         # installs all workspace deps
npm run dev                         # server (:3001) + client (:5173) concurrently; Vite proxies /api → :3001
npm run build                       # server: tsc → server/dist  |  client: tsc -b && vite build → client/dist
NODE_ENV=production npm start       # serves API + built SPA from a single port (3001, or 8080 in Docker/Fly)

npm run dev   --workspace=server    # run just one side
npm run build --workspace=client
```

- **Type-checking is the build.** There is no separate typecheck/lint script. `npm run build --workspace=server`
  (plain `tsc`) is the fastest way to type-check the server; the client build runs `tsc -b` first.
  Both tsconfigs use `strict` + `noUnusedLocals` + `noUnusedParameters`, so unused vars fail the build.
- **There are no tests** and no test runner configured. Don't invent a test command.
- **Backups:** `./scripts/backup.sh` runs `pg_dump` (reads `DATABASE_URL` from `.env`) → `backups/*.sql.gz`.
  Restore procedure is in `docs/recreate_database.md`.

## Environment

`.env` lives at the **repo root**, not in `server/`. Both `server/src/index.ts` and
`server/src/services/supabaseClient.ts` load it by climbing up from `server/src/` — keep it there.
See `.env.example` for the full list. Key vars:

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service-role key bypasses RLS, server-only; falls back to `SUPABASE_ANON_KEY`).
- `ADMIN_SECRET` + `JWT_SECRET` — **both required to enable write access.** If `ADMIN_SECRET` is unset the server is read-only and every write returns 403.
- `DATABASE_URL` — used only by `scripts/backup.sh`.
- `CORS_ORIGIN` — optional; defaults to same-origin in prod, `http://localhost:5173` in dev.

## Architecture

### Supabase RPCs are the source of truth for aggregates — and are NOT auto-migrated

Stats, distinct-value autocomplete, distinct years, and league pairs are all computed by
**PostgreSQL functions** invoked via `supabase.rpc(...)`, not by the JS query builder. The SQL for
these lives in `server/sql/*.sql` and **must be applied by hand in the Supabase SQL editor** — there
is no migration tooling. If you change a route's RPC contract, you must edit the matching `.sql` file
*and* re-run it in Supabase. RPCs in use: `get_timestamps_stats`, `get_timestamps_graph_stats`,
`get_distinct_attack_years`, `get_distinct_league_pairs`, `get_distinct_column_values`.

Only `buildTimestampsQuery` in `server/src/services/queryBuilder.ts` is live (the main paginated
data fetch). `buildStatsQuery`, `buildDistinctValuesQuery`, and the entire `statsCalculator.ts` are
**legacy/unused** leftovers from before stats moved to RPCs — don't wire new code through them.

### The `timestamps` table and `final_time`

`final_time` is a **`GENERATED ALWAYS AS STORED`** column (`GREATEST(lp, pp)` when both are non-null).
The DB recomputes it whenever `lp`/`pp` change. It is in `FORBIDDEN_UPDATE_FIELDS` alongside `id` and
`created_at` — never send it in an update/insert; it will be rejected. The row shape is duplicated in
`server/src/types/index.ts` (`TimestampRow`) and `client/src/types/index.ts` (`Timestamp`); keep them in sync.
`league` is **nullable** (`string | null`): an empty league in an edit/insert is stored as `NULL` (validation
accepts `null`/empty *before* the string-type check), and the table renders it as "—".

### Single-port production model

In production `server/src/index.ts` serves the compiled React bundle from `client/dist` and adds an
SPA fallback (`*` → `index.html`) *after* the API routes. In dev the two run separately and Vite
proxies `/api`. The client's axios `baseURL` is the relative `/api`, so the same code works in both.

### Auth (admin write access)

JWT-based, in `server/src/routes/auth.ts` + `server/src/middleware/adminAuth.ts`:
- `POST /api/auth/login` checks the password against `ADMIN_SECRET`, returns a JWT (`role: admin`, 8h expiry).
  It enforces a constant ~200ms min response time (anti-timing) and a strict 5-attempts/15-min rate limit.
- `requireAdmin` guards every write route (`PATCH`/`DELETE /:id`, `POST /batch`).
- Client stores the token in **`sessionStorage`** (`client/src/services/api.ts`). A 401 interceptor clears it
  and dispatches a `admin-auth-required` window event; `App.tsx` listens and reopens the login modal.
- `GET /api/auth/status` exposes only a boolean so the client can decide whether to show the "Admin login" button.

### Validation is the security boundary

`server/src/middleware/validation.ts` is the gatekeeper for all untrusted input. Whitelist-driven:
sortable columns and autocomplete columns are validated against the `SORTABLE_COLUMNS` /
`AUTOCOMPLETE_COLUMNS` arrays in `server/src/types/index.ts`. Field ranges (e.g. `lp`/`pp` ∈ [12.01, 99.99],
`placement` ∈ [1, 999], dates `YYYY-MM-DD` within [1990, current year]) are enforced here. Note: **batch
validation error messages are user-facing Czech strings**; single-PATCH errors are English. Search terms
have ILIKE wildcards (`%`, `_`) stripped to prevent slow-pattern DoS.

### Batch save semantics (`POST /api/timestamps/batch`)

The primary admin write path. It **validates everything first** (structure, field types/ranges, and
league/attack_type/category values against the DB's distinct sets) and returns 400 with per-row/per-field
errors before touching the DB. Writes then run sequentially as deletes → updates → inserts. This is
**not a real transaction** — a mid-sequence failure can leave partial changes (returns 500). The single
`PATCH`/`DELETE /:id` routes still exist for one-off edits.

### Client state model

- **Filter state lives in the URL** (`client/src/hooks/useUrlState.ts`) via react-router `useSearchParams`
  (with `replace: true` to avoid history spam), so views are shareable/bookmarkable.
- **Instant filtering:** the URL-backed `filters` drive the data/stats/graph hooks directly in `App.tsx`
  (no Search button) — every filter change applies immediately. Filter changes are discrete selections,
  so no debounce; only autocomplete *suggestion* lookups are debounced (in `useDistinctValues`).
- **No-league filter:** the league filter accepts a sentinel value `NO_LEAGUE_VALUE` (`'__none__'`,
  shown as "—") meaning *league IS NULL*. It flows through the URL/API unchanged; `queryBuilder.applyFilters`
  turns it into an `IS NULL` (or `.or(league.is.null,...)`) condition, and the stats/graph RPCs special-case
  the same literal. Keep the constant in sync across `client/src/constants.ts`, `server/src/types/index.ts`,
  and both `.sql` files.
- **`COLUMN_DEFINITIONS` in `client/src/constants.ts` drives the entire table** — headers, cell formatting,
  sort toggles, click-to-filter, and visibility. Add/reorder/rename columns there, not in components.
- **Inline editing** (`DataTable.tsx` + `EditableCell.tsx`) keeps all edits as string drafts (`draftRows`,
  `newRows`, staged deletes) and serialises them into one batch payload on save.

### Naming convention: camelCase ↔ snake_case

Client state uses camelCase (`attackType`); the DB columns, URL query params, and API params use
snake_case (`attack_type`). The mappings live in `client/src/constants.ts`
(`URL_PARAM_TO_FILTER_KEY` / `FILTER_KEY_TO_URL_PARAM`). When adding a filter, update both maps.

### Server hardening (`server/src/index.ts`)

`helmet`, global rate limit (200 req/min/IP on `/api`), `trust proxy = 1` (for correct client IPs behind
Fly/Nginx), `pino` request logging with a per-request `X-Request-Id` (health checks excluded from logs),
a catch-all error handler that hides internals, and SIGTERM/SIGINT graceful shutdown. `/api/health`
deliberately does **not** ping the DB.

## Deployment

Deployed to **Fly.io** (`fly.toml`, region `fra`, port 8080, autostop/autostart, health-checks `/api/health`)
via the multi-stage `Dockerfile` (builder compiles both workspaces; production image installs only the
server's prod deps and copies `server/dist` + `client/dist`). `fly deploy` builds and ships the Dockerfile.

**Pushing to `main` auto-deploys to production.** `.github/workflows/fly-deploy.yml` runs
`flyctl deploy --remote-only` on every push to `main` (build runs on Fly's remote builders). There is no
staging environment and no manual approval gate — a merge to `main` ships live. Branch and open a PR for
anything you don't want deployed immediately.
