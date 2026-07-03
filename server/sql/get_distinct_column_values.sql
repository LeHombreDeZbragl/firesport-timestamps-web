-- RPC function: get_distinct_column_values
--
-- Returns all distinct non-empty values for a whitelisted column,
-- optionally filtered by a case-insensitive partial match.
-- The column name is whitelisted inside the function to prevent SQL injection.
--
-- Parameters:
--   p_column  text  - column name (must be in the allowed whitelist)
--   p_search  text  - optional partial-match filter (empty string = all)
--
-- Returns a set of rows: { value text }
--
-- Run once in the Supabase SQL editor; re-run to replace on changes.

CREATE OR REPLACE FUNCTION get_distinct_column_values(
  p_column text,
  p_search text DEFAULT ''
)
RETURNS TABLE (value text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  allowed_columns text[] := ARRAY['team', 'category', 'league', 'place', 'attack_type'];
  -- Columns ordered by most recent competition date (newest first) instead of
  -- alphabetically. Everything else keeps its A–Z ordering.
  recency_columns text[] := ARRAY['team', 'place'];
  filter_clause   text := '';
  sql_query       text;
BEGIN
  -- Whitelist check — prevents dynamic SQL injection via column name
  IF NOT (p_column = ANY(allowed_columns)) THEN
    RAISE EXCEPTION 'Column "%" is not allowed for distinct value lookup.', p_column;
  END IF;

  IF p_search IS NOT NULL AND length(trim(p_search)) > 0 THEN
    filter_clause := format('AND %I ILIKE ''%%'' || $1 || ''%%''', p_column);
  END IF;

  IF p_column = ANY(recency_columns) THEN
    -- Order by the value's latest attack_date, so the most recently active
    -- teams/places surface first. attack_date is non-null, so no NULLS handling
    -- is needed; the column itself breaks ties deterministically.
    sql_query := format(
      'SELECT %1$I::text AS value
       FROM timestamps
       WHERE %1$I IS NOT NULL AND %1$I <> ''''
       %2$s
       GROUP BY %1$I
       ORDER BY MAX(attack_date) DESC, %1$I
       LIMIT 1000',
      p_column,
      filter_clause
    );
  ELSE
    sql_query := format(
      'SELECT DISTINCT %1$I::text AS value
       FROM timestamps
       WHERE %1$I IS NOT NULL AND %1$I <> ''''
       %2$s
       ORDER BY value
       LIMIT 1000',
      p_column,
      filter_clause
    );
  END IF;

  IF p_search IS NOT NULL AND length(trim(p_search)) > 0 THEN
    RETURN QUERY EXECUTE sql_query USING trim(p_search);
  ELSE
    RETURN QUERY EXECUTE sql_query;
  END IF;
END;
$$;
