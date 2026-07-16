# Production-readiness plan

Derived from a full-stack review of the codebase (server, client, SQL RPCs, deploy config).
The goal of this document is to close the gap between "works" and "production-ready" with a
prioritized, concrete, verifiable set of changes.

The security and validation core is already solid (whitelist-driven input validation, `%I`
identifier quoting + parameterized search in the SQL RPCs, anti-timing login with a strict rate
limit, helmet, service-role key kept server-only, JWT-guarded writes, `rel="noopener"` on external
links). This plan does **not** re-litigate those; it targets the specific gaps found.

## Scope decisions (already settled)

These were reviewed and consciously **excluded** from the work below. Recorded here so they don't
resurface as "missing":

- **Database indexes** — Indexes already exist in the live database for nearly every column. They
  are simply not checked into the repo. _Optional follow-up:_ dump the existing index DDL into a
  `server/sql/indexes.sql` file so the schema is fully reproducible from the repo (see W7). No
  functional change.
- **Automated backups** — The Supabase project is on the free plan, which has no automated backups.
  This is an accepted limitation for now. `scripts/backup.sh` remains the manual fallback.
- **New league / category / attack_type vocabulary** — The batch endpoint intentionally rejects any
  `league` / `category` / `attack_type` value not already present in the DB. This is **designed
  behavior** (curated vocabulary), not a bug. W6 only improves how that restriction is documented
  and surfaced; it does not relax it.

## Priority overview

| ID  | Workstream                                   | Priority | Risk if skipped                          | Effort |
| --- | -------------------------------------------- | -------- | ---------------------------------------- | ------ |
| W1  | Async route-handler safety                   | P0       | Silent hung requests, no error response  | S      |
| W2  | Transactional batch save                     | P0       | Partial writes corrupt data on failure   | M      |
| W3  | Focused API test suite + deploy gate         | P1       | Any logic regression ships straight live | M      |
| W4  | `/api/*` 404 guard before SPA fallback       | P1       | Typo'd endpoints return HTML with 200    | S      |
| W5  | Delete legacy / unused code                  | P2       | Landmines (unsafe ILIKE interpolation)   | S      |
| W6  | Documentation & small hardening              | P2       | Papercuts, minor inconsistencies         | S      |
| W7  | Optional: reproducible schema (indexes DDL)  | P3       | Schema not reproducible from repo        | S      |

`S` ≈ under an hour, `M` ≈ a few hours. Sequencing: **W1 → W2 → W3 → W4 → W5 → W6**. W3 (tests)
should land alongside or immediately after W1/W2 so those fixes are covered before anything else is
built on them.

---

## W1 — Async route-handler safety (P0)

### Problem

Every route handler except `POST /batch` is an `async` function with no `try/catch`
(`server/src/routes/timestamps.ts:41, 75, 128, 187, 207, 232, 263, 300`). Express **4.21** does
**not** forward a rejected promise to the global error handler (`server/src/index.ts:114`). If any
of these handlers throws or rejects, the response is never sent and the request hangs until the
client's 15s axios timeout (`client/src/services/api.ts:27`).

This is not purely theoretical. Several handlers cast the RPC result and immediately `.map` over it
with no null guard:

- `distinct/years` — `(data as Array<{ year: number }>).map(...)` (`timestamps.ts:197`)
- `distinct/league-pairs` — `(data as Array<...>).map(...)` (`timestamps.ts:216`)
- `distinct/:column` — `(data as Array<{ value: string }>).map(...)` (`timestamps.ts:250`)

If any RPC ever returns `data: null` with no `error`, `.map` throws → unhandled async rejection →
hung request. (The `/stats` and `/graph-stats` handlers already guard `data` correctly; these three
do not.)

### Fix

1. Add a tiny wrapper that adapts async handlers to Express 4's error path:

   ```ts
   // server/src/middleware/asyncHandler.ts
   import { Request, Response, NextFunction, RequestHandler } from 'express';

   /** Wraps an async handler so rejected promises reach the global error handler. */
   export const asyncHandler =
     (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
     (req, res, next) => {
       fn(req, res, next).catch(next);
     };
   ```

2. Wrap every async handler in `timestamps.ts` and `auth.ts` (the `login` handler already has its
   own `.catch`, but wrapping it too is harmless and consistent).

3. Null-guard the three unguarded `.map` sites — treat missing `data` as an empty result rather
   than throwing:

   ```ts
   const rows = (data as Array<{ year: number }> | null) ?? [];
   const years = rows.map((row) => row.year);
   ```

### Alternative considered

Upgrading to **Express 5** (which auto-forwards async rejections) would remove the need for the
wrapper. Rejected for now: larger surface area / breaking changes for a one-file benefit. Revisit if
Express is upgraded for other reasons.

### Acceptance criteria

- A handler that throws returns a JSON `500` from the global error handler, not a hung socket.
- The three `distinct/*` handlers return a valid (possibly empty) response when the RPC yields
  `data: null`.
- Covered by a test in W3 (force the mocked Supabase client to reject / return null; assert `500` or
  empty payload, no hang).

---

## W2 — Transactional batch save (P0)

### Problem

`POST /api/timestamps/batch` is the **primary admin write path** and it is not atomic. It runs
deletes → updates → inserts sequentially via separate Supabase calls
(`server/src/routes/timestamps.ts:390-414`). A failure partway through leaves partial changes and
returns `500`, corrupting the exact dataset the app exists to curate. CLAUDE.md already flags this;
this workstream fixes it.

### Fix

Move the write phase into a single PostgreSQL function invoked with `supabase.rpc(...)`, so all
three phases run inside one implicit transaction (a plpgsql function body is transactional — any
unhandled error rolls back the whole call).

1. **New SQL file** `server/sql/batch_save_timestamps.sql` defining
   `batch_save_timestamps(p_deletes int[], p_updates jsonb, p_inserts jsonb)`:
   - Deletes `WHERE id = ANY(p_deletes)`.
   - Iterates `p_updates` (array of `{ id, fields }`), applying each `fields` object. Use
     `jsonb_populate_record` / explicit column assignment against a fixed whitelist of editable
     columns — **do not** build dynamic column lists from arbitrary JSON keys.
   - Bulk-inserts `p_inserts`.
   - Never touches `id`, `created_at`, or `final_time` (generated column).
   - Returns a small result (e.g. counts) or raises on any failure.
   - Header comment must state: "Run once in the Supabase SQL editor; re-run to replace on changes."
     (matches the existing RPC convention — there is no migration tooling).

2. **Route change** (`timestamps.ts`): keep steps 1–3 exactly as they are (structural validation,
   distinct-set fetch, league/type/category checks — all still done in Node **before** any write).
   Replace the step-4 sequential block with one `supabase.rpc('batch_save_timestamps', {...})`
   call. On error, return `500` as today.

3. Validation ordering is unchanged: everything is still validated in the app layer first, so the
   RPC only ever receives already-sanitized values. The RPC is the atomicity guarantee, not a
   second validation layer.

### Notes / constraints

- The whitelist of editable columns inside the SQL function must stay in sync with
  `ALL_EDITABLE_FIELDS` in `server/src/middleware/validation.ts`. Add a comment in both places
  pointing at the other (mirror the existing "keep in sync" convention used for `NO_LEAGUE_VALUE`).
- This is a schema change that must be **applied by hand in the Supabase SQL editor**, like every
  other RPC. Document that in the PR / commit message.

### Acceptance criteria

- A batch containing a delete, an update, and an insert where the **insert** violates a DB
  constraint leaves the deleted/updated rows **unchanged** (full rollback), and the endpoint returns
  `500`.
- A fully valid batch applies all three phases and returns `{ success: true }`.
- Covered by W3 tests (mock the RPC to succeed and to reject; assert response shape).

---

## W3 — Focused API test suite + deploy gate (P1)

### Problem

There are zero automated tests and no test runner. Push-to-`main` auto-deploys to production
(`.github/workflows/fly-deploy.yml`) with no staging and no approval gate. The only current safety
net is that the Docker build runs `tsc`, so a **type error** blocks the deploy — but any logic
regression (broken filter, batch bug, validation gap) ships straight to prod.

### Fix

Add **Vitest + supertest** covering validation boundaries and the batch happy/error paths, then gate
the deploy on them.

1. **Dev deps** (`server`): `vitest`, `supertest`, `@types/supertest`.
2. **Testability seam:** routes currently import the Supabase singleton directly
   (`import supabase from '../services/supabaseClient'`). Use Vitest module mocking
   (`vi.mock('../services/supabaseClient')`) so tests run with **no live database** — they exercise
   validation, routing, and orchestration logic against a fake client. No test Supabase project or
   secrets required in CI. (Consider extracting the Express app into `server/src/app.ts` and
   importing it from both `index.ts` and the tests, so supertest can mount it without starting a
   listener.)
3. **Test targets (highest value first):**
   - `middleware/validation.ts` (pure functions — fast, high coverage): `parseUpdateBody`,
     `parseBatchBody`, `validateBatchInsert/Update/Field`, `parseId`, `parsePagination`,
     `parseFilters`, `parseSearchTerm`. Cover range boundaries (`lp/pp` 12.01–99.99, `placement`
     1–999, date year 1990–current), forbidden/unknown fields, `league` null/empty handling, ILIKE
     metacharacter stripping.
   - `POST /batch` route with mocked Supabase: valid batch → `200 { success: true }`; field errors →
     `400 { errors: [...] }`; unknown league/category/attack_type → `400`; RPC rejection (W2) →
     `500`.
   - `GET /timestamps` + `distinct/*` with mocked client: filter param parsing, and the W1
     null-`data` guard (mock returns `data: null` → empty payload, no throw/hang).
   - Auth: `POST /login` wrong password → `401`; missing `ADMIN_SECRET` → `403`; write route without
     `Bearer` token → `401`; with a valid signed token → passes `requireAdmin`.
4. **Scripts:** add `"test": "vitest run"` to `server/package.json` (and a root `"test":
   "npm run test --workspace=server"`).
5. **CI gate:** add a `test` job to `.github/workflows/fly-deploy.yml` that runs `npm ci && npm test`
   and make the existing `deploy` job depend on it (`needs: test`). Deploy only proceeds if tests
   pass. Because the suite mocks Supabase, the job needs no secrets.

### Explicitly out of scope

Client-side tests and broad unit coverage (per the chosen "focused API tests" scope). Can be added
later; not required for prod-readiness.

### Acceptance criteria

- `npm test` runs green locally and in CI with no database or secrets.
- The deploy job does not run when tests fail (verify by pushing a deliberately failing test on a
  branch, or by inspecting the `needs:` wiring).
- W1 and W2 behaviors above are each asserted by at least one test.

---

## W4 — `/api/*` 404 guard before SPA fallback (P1)

### Problem

In production the SPA fallback `app.get('*', ...)` (`server/src/index.ts:131`) sits after the API
routes with no `/api` guard. A request to an unknown `/api/...` path falls through to the catch-all
and returns `index.html` with `200` instead of a `404` JSON error. Clients (and the API's own
contract) then see HTML where JSON is expected.

### Fix

Register an `/api/*` 404 handler **after** the API routers but **before** the static/SPA serving:

```ts
// after app.use('/api/timestamps', ...) and the /api/health route,
// before the production static block:
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});
```

Ensure ordering: API routers → `/api` 404 → global error handler → static + SPA fallback. (The
global error handler should remain registered after routes; confirm it still sits correctly relative
to the new 404.)

### Acceptance criteria

- `GET /api/does-not-exist` returns `404` with a JSON body in production mode.
- A non-API path (e.g. `/some/spa/route`) still returns `index.html` in production.
- Covered by a W3 test.

---

## W5 — Delete legacy / unused code (P2)

### Problem

Dead code that CLAUDE.md itself marks as legacy still compiles and invites misuse:

- `buildStatsQuery` and `buildDistinctValuesQuery` in `server/src/services/queryBuilder.ts`.
- The entire `server/src/services/statsCalculator.ts`.

`buildDistinctValuesQuery` is the worst of these: it interpolates `` `%${searchTerm}%` `` into an
ILIKE (`queryBuilder.ts:158`). It's currently unreachable, but it's a ready-made landmine if someone
wires it up.

### Fix

- Delete `statsCalculator.ts`.
- Delete `buildStatsQuery` and `buildDistinctValuesQuery` from `queryBuilder.ts` (keep
  `buildTimestampsQuery` and `applyFilters`).
- Remove any now-unused imports/types. `tsc` (with `noUnusedLocals`/`noUnusedParameters`) will
  confirm nothing dangling remains — the build **is** the check.

### Acceptance criteria

- `npm run build --workspace=server` passes with the files/functions removed.
- No remaining references to the deleted symbols (`grep` clean).

---

## W6 — Documentation & small hardening (P2)

Small, independent papercuts. Each is optional-but-cheap; batch them into one PR.

1. **Client auth calls bypass the axios instance.** `login()` and `fetchAuthStatus()`
   (`client/src/services/api.ts:78, 245`) use bare `axios`, so the 15s timeout and the 401
   interceptor don't apply. Switch both to `apiClient` for consistent behavior. (Verify the
   interceptor doesn't cause a loop on the login 401 — the login flow surfaces its own error, so
   guard if needed.)
2. **`link` field hardening.** `link` is accepted as any string server-side and rendered as an
   `href` when it `startsWith('http')` (`client/src/components/table/ClickableCell.tsx:26`). It's
   admin-only (low risk, and `javascript:` is already neutralized by the `http` prefix check), but
   add a cheap server-side check in validation: allow empty, otherwise require `https?://` and cap
   length (e.g. 500 chars). Mirror the existing per-field validation style in
   `server/src/middleware/validation.ts`.
3. **Document the batch vocabulary restriction.** Add a short note in `CLAUDE.md` (batch section)
   making explicit that new `league`/`category`/`attack_type` values cannot be introduced through
   the UI **by design**, and confirm the user-facing Czech error message
   (`Liga "X" neexistuje.` etc.) is clear enough for an admin who hits it.
4. **Document accepted limitations.** Note in the `CLAUDE.md` deployment section: free-plan Supabase
   has no automated backups (manual `scripts/backup.sh` only), and login rate limiting is in-memory
   / per-machine (resets on deploy/restart, does not span multiple Fly machines) — acceptable at
   current scale.

### Acceptance criteria

- Auth calls go through `apiClient`; a login failure still surfaces a clean error to the user.
- Invalid `link` values (non-URL, over length cap) are rejected by validation with a clear message;
  empty `link` still allowed.
- CLAUDE.md reflects the documented decisions above.

---

## W7 — Optional: reproducible schema (P3)

### Problem

Indexes exist in the live database but are not in the repo, so the schema can't be fully recreated
from source (`docs/recreate_database.md` + `server/sql/*` are incomplete without them).

### Fix (optional, do only if reproducibility matters)

Export the existing index DDL from Supabase (`pg_dump --schema-only` or query `pg_indexes`) into
`server/sql/indexes.sql`, and reference it from `docs/recreate_database.md`. No behavior change —
purely making the repo a complete source of truth.

### Acceptance criteria

- `server/sql/indexes.sql` reflects the live indexes; `recreate_database.md` links to it.

---

## Non-goals (explicitly not doing now)

- Express 5 upgrade (W1 wrapper covers the need).
- Distributed / shared-store rate limiting (in-memory accepted at current scale — documented).
- Server-side JWT revocation / logout invalidation (8h expiry accepted for single-admin tool).
- ~~`count: 'exact'` → `estimated` on the paginated read.~~ **Done** (the table reached ~250k rows).
  `buildTimestampsQuery` now uses an estimated count and fetches `limit + 1` rows so `hasMore` stays
  exact; the route also caches the unfiltered stats/graph/distinct responses (5 min TTL, cleared on
  writes) via `server/src/services/cache.ts`.
- Client-side test coverage (focused API tests only, per scope).
- Automated backups (free-plan limitation, accepted).

## Definition of done

Production-ready is reached when **W1–W4** are merged and deployed:

- No route can hang on an async error; unknown `/api` paths return JSON `404`.
- Batch saves are atomic — a mid-sequence failure rolls back cleanly.
- A green, database-free API test suite gates every deploy to `main`.

W5–W7 are cleanup/polish and can follow without blocking the "production-ready" milestone.
