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
  sql_query       text;
BEGIN
  -- Whitelist check — prevents dynamic SQL injection via column name
  IF NOT (p_column = ANY(allowed_columns)) THEN
    RAISE EXCEPTION 'Column "%" is not allowed for distinct value lookup.', p_column;
  END IF;

  sql_query := format(
    'SELECT DISTINCT %I::text AS value
     FROM timestamps
     WHERE %I IS NOT NULL AND %I <> ''''
     %s
     ORDER BY value
     LIMIT 1000',
    p_column,
    p_column,
    p_column,
    CASE
      WHEN p_search IS NOT NULL AND length(trim(p_search)) > 0
        THEN format('AND %I ILIKE ''%%'' || $1 || ''%%''', p_column)
      ELSE ''
    END
  );

  IF p_search IS NOT NULL AND length(trim(p_search)) > 0 THEN
    RETURN QUERY EXECUTE sql_query USING trim(p_search);
  ELSE
    RETURN QUERY EXECUTE sql_query;
  END IF;
END;
$$;
