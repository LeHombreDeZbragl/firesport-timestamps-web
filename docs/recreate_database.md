Plan: Recreate Supabase DB from Backup
This is a read-only, zero-code-change plan — nothing in the app source is modified. The backup firesport_2026-05-28_193720.sql.gz is a standard pg_dump gzipped SQL dump that includes table schema, all data, and the 5 RPC functions. Only environment variables change at the end.

Phase 1 — Create New Supabase Project
Go to supabase.com → New Project
Set region to EU West (to match the current aws-0-eu-west-1 setup; keeps latency low)
Choose a strong DB password and save it securely — you'll need it in Phase 2
Wait for the project to finish provisioning (~1-2 minutes).

Phase 2 — Collect Connection Details
Project Settings → Database → Connection string

Use the Direct connection tab — NOT the pooler (Supabase shows both)
The direct URL looks like: postgresql://postgres:[password]@db.[ref].supabase.co:**5432**/postgres
Port 5432 is required for psql restore. The pooler (port 6543) doesn't support full SQL sessions needed for restoring dumps.
Project Settings → API

Copy SUPABASE_URL (e.g. https://[ref].supabase.co)
Copy service_role key (SUPABASE_SERVICE_ROLE_KEY) — keep this secret, server-side only
Phase 3 — Restore the Backup
From the project root on your local machine, run:

If you see errors about role/ownership (common with Supabase's postgres superuser), add flags:

The dump contains: the public.timestamps table (all 14 columns including the final_time generated column), all row data, and all 5 RPC functions.

Phase 4 — Verify the Restore
Connect with psql or use the Supabase SQL Editor and run:

If RPC functions are missing (rare — sometimes pg_dump omits them depending on dump options), run each file manually in the Supabase SQL Editor:

get_distinct_attack_years.sql
get_distinct_column_values.sql
get_distinct_league_pairs.sql
get_timestamps_stats.sql
get_timestamps_graph_stats.sql
If final_time generated column is missing, run: add_final_time_column.sql

Phase 5 — Update Environment Variables
Update your local .env file with the new project values:

Note: DATABASE_URL for the running app uses the pooler port 6543. The direct port 5432 was only for the restore.

If deployed on fly.io, update secrets (do not hardcode — use fly secrets):

Phase 6 — Verify the Application
Run locally: npm run dev (or whatever the dev command is) and check the app loads data from the new DB
Confirm in the browser that filters, stats, and chart data all return correctly
If on fly.io, check the health endpoint: GET /api/health should return 200
Relevant files — nothing to modify, only reference:

firesport_2026-05-28_193720.sql.gz — the backup to restore
.env.example — template for new env values
backup.sh — shows how backup was created (confirms it's pg_dump + gzip)
sql — all 5 RPC functions + generated column migration (fallback if restore is incomplete)
Decisions / Scope:

No source code changes — this is pure DB + infra ops
The old Supabase project should only be decommissioned after verifying the new one works end-to-end
RLS (Row Level Security) — the app uses the service-role key which bypasses RLS, so RLS policies don't need to be replicated if none were set