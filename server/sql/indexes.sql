-- Secondary indexes on public.timestamps
--
-- Snapshot of the indexes that exist in the live database (from pg_indexes),
-- checked in so the schema is fully reproducible from the repo — the RPC files
-- in this folder + this file + the table/generated-column definition make up the
-- complete schema, independent of any pg_dump backup.
--
-- These back the whitelisted filter columns (team, category, league, place,
-- attack_type), the default sort / year-range filter (attack_date), and the
-- final-time lookup. Every filter/sort the API exposes hits one of these, so the
-- stats/graph aggregates and the paginated read use index scans rather than
-- sequential scans of the whole (~250k-row) table.
--
-- Primary keys (timestamps_pkey, visited_competitions_pkey) are NOT listed here:
-- they are created automatically by the PRIMARY KEY constraint in the table
-- definition, not by a standalone CREATE INDEX.
--
-- Run once in the Supabase SQL editor; IF NOT EXISTS makes it safe to re-run.

CREATE INDEX IF NOT EXISTS timestamps_attack_date ON public.timestamps USING btree (attack_date);
CREATE INDEX IF NOT EXISTS timestamps_attack_type ON public.timestamps USING btree (attack_type);
CREATE INDEX IF NOT EXISTS timestamps_category    ON public.timestamps USING btree (category);
CREATE INDEX IF NOT EXISTS timestamps_league      ON public.timestamps USING btree (league);
CREATE INDEX IF NOT EXISTS timestamps_place       ON public.timestamps USING btree (place);
CREATE INDEX IF NOT EXISTS timestamps_team        ON public.timestamps USING btree (team);

-- NOTE: this targets a column named `only_final_time` (distinct from the
-- generated `final_time` column). Kept verbatim to match the live database.
CREATE INDEX IF NOT EXISTS timestamps_only_final_time_idx ON public.timestamps USING btree (only_final_time);
