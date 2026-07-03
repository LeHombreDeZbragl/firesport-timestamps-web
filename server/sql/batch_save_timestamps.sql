-- RPC function: batch_save_timestamps
--
-- Atomically applies a batch of admin edits to public.timestamps: deletes,
-- updates, and inserts. The entire function body runs inside a single implicit
-- transaction — any error (e.g. a constraint violation on one insert) raises and
-- rolls back ALL three phases, so the table is never left in a partial state.
--
-- This is the atomicity guarantee only. All values are already validated and
-- sanitised in the Node layer (server/src/middleware/validation.ts) BEFORE this
-- RPC is called; the function does not re-validate ranges/vocabulary.
--
-- Parameters:
--   p_deletes  int[]  - row ids to delete
--   p_updates  jsonb  - array of { "id": int, "fields": { <editable cols> } }
--   p_inserts  jsonb  - array of full editable-column objects to insert
--
-- Editable columns (fixed whitelist — MUST stay in sync with ALL_EDITABLE_FIELDS
-- in server/src/middleware/validation.ts):
--   attack_date, league, place, link, attack_type, category, team,
--   placement, lp, pp
-- Never touches id, created_at, or final_time (final_time is GENERATED).
--
-- Returns a single jsonb summary: { "deleted": n, "updated": n, "inserted": n }.
--
-- Run once in the Supabase SQL editor; re-run to replace on changes.

CREATE OR REPLACE FUNCTION batch_save_timestamps(
  p_deletes int[]  DEFAULT '{}',
  p_updates jsonb  DEFAULT '[]'::jsonb,
  p_inserts jsonb  DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted  int := 0;
  v_updated  int := 0;
  v_inserted int := 0;
  v_rows     int;
  upd        jsonb;
  fields     jsonb;
BEGIN
  -- ── Phase 1: deletes ─────────────────────────────────────────────────────
  IF p_deletes IS NOT NULL AND array_length(p_deletes, 1) IS NOT NULL THEN
    DELETE FROM timestamps WHERE id = ANY(p_deletes);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  -- ── Phase 2: updates ─────────────────────────────────────────────────────
  -- Each element is { id, fields }. Only columns PRESENT in `fields` are
  -- written (checked with the `?` operator); absent columns keep their value.
  -- The column list is fixed here — arbitrary JSON keys can never reach the
  -- SET clause, so there is no dynamic-SQL / injection surface.
  FOR upd IN SELECT * FROM jsonb_array_elements(COALESCE(p_updates, '[]'::jsonb))
  LOOP
    fields := upd->'fields';

    UPDATE timestamps SET
      attack_date = CASE WHEN fields ? 'attack_date' THEN (fields->>'attack_date')::date ELSE attack_date END,
      league      = CASE WHEN fields ? 'league'      THEN  fields->>'league'             ELSE league      END,
      place       = CASE WHEN fields ? 'place'       THEN  fields->>'place'              ELSE place       END,
      link        = CASE WHEN fields ? 'link'        THEN  fields->>'link'               ELSE link        END,
      attack_type = CASE WHEN fields ? 'attack_type' THEN  fields->>'attack_type'        ELSE attack_type END,
      category    = CASE WHEN fields ? 'category'    THEN  fields->>'category'           ELSE category    END,
      team        = CASE WHEN fields ? 'team'        THEN  fields->>'team'               ELSE team        END,
      placement   = CASE WHEN fields ? 'placement'   THEN (fields->>'placement')::int    ELSE placement   END,
      lp          = CASE WHEN fields ? 'lp'          THEN (fields->>'lp')::real           ELSE lp          END,
      pp          = CASE WHEN fields ? 'pp'          THEN (fields->>'pp')::real           ELSE pp          END
    WHERE id = (upd->>'id')::int;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_updated := v_updated + v_rows;
  END LOOP;

  -- ── Phase 3: inserts ─────────────────────────────────────────────────────
  -- Explicit column list via jsonb_to_recordset; any extra JSON keys are
  -- ignored. `link` is required-with-default '' upstream, league/lp/pp nullable.
  INSERT INTO timestamps (
    attack_date, league, place, link, attack_type, category, team,
    placement, lp, pp
  )
  SELECT
    x.attack_date, x.league, x.place, x.link, x.attack_type, x.category, x.team,
    x.placement, x.lp, x.pp
  FROM jsonb_to_recordset(COALESCE(p_inserts, '[]'::jsonb)) AS x(
    attack_date date,
    league      text,
    place       text,
    link        text,
    attack_type text,
    category    text,
    team        text,
    placement   int,
    lp          real,
    pp          real
  );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted',  v_deleted,
    'updated',  v_updated,
    'inserted', v_inserted
  );
END;
$$;
