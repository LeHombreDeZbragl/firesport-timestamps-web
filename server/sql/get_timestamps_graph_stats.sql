-- RPC function: get_timestamps_graph_stats
--
-- Computes chart data for all timestamps matching the given filters.
-- Accepts the same array parameters as get_timestamps_stats.
--
-- Returns a single row with:
--   dist_under_16     bigint  - successful attacks with final_time < 16 s
--   dist_16_to_17     bigint  - successful attacks 16 s ≤ time < 17 s
--   dist_17_to_18     bigint  - successful attacks 17 s ≤ time < 18 s
--   dist_over_18      bigint  - successful attacks with final_time ≥ 18 s
--   dist_unsuccessful bigint  - attacks where final_time IS NULL
--   progression       json    - array of chronological groups, each:
--                               { group, avg_time, min_time, start_date, end_date, avg_lp, avg_pp }
--                               Only rows where final_time IS NOT NULL are used.
--                               Grouping: when the data spans 5–30 distinct days,
--                               one group per day; otherwise 30 equal NTILE buckets.
--
-- Run once in the Supabase SQL editor; re-run to replace on changes.

CREATE OR REPLACE FUNCTION get_timestamps_graph_stats(
  p_team        text[]    DEFAULT NULL,
  p_category    text[]    DEFAULT NULL,
  p_year        int[]     DEFAULT NULL,
  p_league      text[]    DEFAULT NULL,
  p_place       text[]    DEFAULT NULL,
  p_attack_type text[]    DEFAULT NULL
)
RETURNS TABLE (
  dist_under_16     bigint,
  dist_16_to_17     bigint,
  dist_17_to_18     bigint,
  dist_over_18      bigint,
  dist_unsuccessful bigint,
  progression       json
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT id, attack_date, final_time, lp, pp
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
      )
  ),
  successful AS (
    SELECT id, attack_date, final_time, lp, pp
    FROM base
    WHERE final_time IS NOT NULL
  ),
  day_count AS (
    SELECT COUNT(DISTINCT attack_date) AS n FROM successful
  ),
  with_tiles AS (
    SELECT
      attack_date,
      final_time,
      lp,
      pp,
      -- When the data spans 5–30 distinct days, use one bucket per day so each
      -- point is a real day's avg/min. Otherwise fall back to 30 equal
      -- chronological NTILE buckets.
      CASE
        WHEN (SELECT n FROM day_count) BETWEEN 5 AND 30
          THEN DENSE_RANK() OVER (ORDER BY attack_date)
        ELSE NTILE(30)      OVER (ORDER BY attack_date, id)
      END AS grp
    FROM successful
  ),
  progression_agg AS (
    SELECT
      grp                                          AS "group",
      ROUND(AVG(final_time)::numeric, 2)::float8   AS avg_time,
      ROUND(MIN(final_time)::numeric, 2)::float8   AS min_time,
      MIN(attack_date)::text                       AS start_date,
      MAX(attack_date)::text                       AS end_date,
      ROUND(AVG(lp)::numeric, 2)::float4           AS avg_lp,
      ROUND(AVG(pp)::numeric, 2)::float4           AS avg_pp
    FROM with_tiles
    GROUP BY grp
  )
  SELECT
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time < 16)::bigint              AS dist_under_16,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 16 AND final_time < 17)::bigint AS dist_16_to_17,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 17 AND final_time < 18)::bigint AS dist_17_to_18,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 18)::bigint             AS dist_over_18,
    COUNT(*) FILTER (WHERE final_time IS NULL)::bigint                                      AS dist_unsuccessful,
    (SELECT COALESCE(json_agg(p ORDER BY p."group"), '[]'::json) FROM progression_agg p)   AS progression
  FROM base;
$$;
