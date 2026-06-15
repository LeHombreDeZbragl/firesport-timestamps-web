-- RPC function: get_timestamps_stats
--
-- Computes aggregate statistics for all timestamps matching the given filters.
-- Accepts array parameters; NULL means "no filter for this dimension".
--
-- Returns a single row with the following columns:
--   average_time       float4  - arithmetic mean of final_time
--   best_time          float4  - minimum final_time
--   median_time        float8  - 50th percentile of final_time
--   lp_faster          int8    - rows where lp < pp (LP side was faster)
--   pp_faster          int8    - rows where pp < lp (PP side was faster)
--   equal_count        int8    - rows where lp = pp (both present, same time)
--   total_count        int8    - all rows matching the filter (incl. nulls)
--   successful_count   int8    - rows where final_time IS NOT NULL
--   unsuccessful_count int8    - rows where final_time IS NULL
--   avg_lp             float4  - avg lp time on rows where both lp and pp are not null
--   avg_pp             float4  - avg pp time on rows where both lp and pp are not null
--
-- Run once in the Supabase SQL editor; re-run to replace on changes.

DROP FUNCTION IF EXISTS get_timestamps_stats(text[],text[],integer[],text[],text[],text[]);

CREATE OR REPLACE FUNCTION get_timestamps_stats(
  p_team        text[]    DEFAULT NULL,
  p_category    text[]    DEFAULT NULL,
  p_year        int[]     DEFAULT NULL,
  p_league      text[]    DEFAULT NULL,
  p_place       text[]    DEFAULT NULL,
  p_attack_type text[]    DEFAULT NULL
)
RETURNS TABLE (
  average_time       float4,
  best_time          float4,
  median_time        float8,
  lp_faster          bigint,
  pp_faster          bigint,
  equal_count        bigint,
  total_count        bigint,
  successful_count   bigint,
  unsuccessful_count bigint,
  avg_lp             float4,
  avg_pp             float4
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    AVG(final_time)::float4                                               AS average_time,
    MIN(final_time)::float4                                               AS best_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY final_time)               AS median_time,
    COUNT(*) FILTER (WHERE lp IS NOT NULL AND pp IS NOT NULL AND lp < pp) AS lp_faster,
    COUNT(*) FILTER (WHERE lp IS NOT NULL AND pp IS NOT NULL AND pp < lp) AS pp_faster,
    COUNT(*) FILTER (WHERE lp IS NOT NULL AND pp IS NOT NULL AND lp = pp) AS equal_count,
    COUNT(*)                                                               AS total_count,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL)                        AS successful_count,
    COUNT(*) FILTER (WHERE final_time IS NULL)                            AS unsuccessful_count,
    AVG(lp) FILTER (WHERE lp IS NOT NULL AND pp IS NOT NULL)::float4      AS avg_lp,
    AVG(pp) FILTER (WHERE lp IS NOT NULL AND pp IS NOT NULL)::float4      AS avg_pp
  FROM timestamps
  WHERE
    (p_team        IS NULL OR team        = ANY(p_team))
    AND (p_category    IS NULL OR category    = ANY(p_category))
    AND (
      p_league IS NULL
      OR league = ANY(p_league)
      OR (league IS NULL AND '__none__' = ANY(p_league))  -- NO_LEAGUE_VALUE sentinel
    )
    AND (p_place       IS NULL OR place       = ANY(p_place))
    AND (p_attack_type IS NULL OR attack_type = ANY(p_attack_type))
    AND (
      p_year IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(p_year) AS y
        WHERE attack_date >= make_date(y, 1, 1)
          AND attack_date <= make_date(y, 12, 31)
      )
    );
$$;
