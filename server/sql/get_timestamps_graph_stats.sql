-- RPC function: get_timestamps_graph_stats
--
-- Computes chart data for all timestamps matching the given filters.
-- Accepts the same array parameters as get_timestamps_stats.
--
-- Returns a single row with:
--   dist_under_13     bigint  - successful attacks with final_time < 13 s
--   dist_13_to_14     bigint  - successful attacks 13 s ≤ time < 14 s
--   dist_14_to_15     bigint  - successful attacks 14 s ≤ time < 15 s
--   dist_15_to_16     bigint  - successful attacks 15 s ≤ time < 16 s
--   dist_16_to_17     bigint  - successful attacks 16 s ≤ time < 17 s
--   dist_17_to_18     bigint  - successful attacks 17 s ≤ time < 18 s
--   dist_18_to_19     bigint  - successful attacks 18 s ≤ time < 19 s
--   dist_over_19      bigint  - successful attacks with final_time ≥ 19 s
--   dist_unsuccessful bigint  - attacks where final_time IS NULL
--   progression       json    - array of chronological groups, each:
--                               { group, avg_time, min_time, start_date, end_date,
--                                 avg_lp, avg_pp, place, team, bucket }
--                               Only rows where final_time IS NOT NULL are used.
--
--                               Grouping (decided once for the whole result set):
--                                 ≤60 rows  -> 'row'   one group per row (individual lp/pp)
--                                 ≤30 days  -> 'day'   one group per day
--                                 ≥6 years  -> 'year'  one group per year
--                                 otherwise -> 'month' one group per month
--                               `bucket` names that granularity, so the client can label
--                               each point with the right period ("2023" / "duben 2023" / a date).
--
--                               place/team label each point and are mutually exclusive:
--                                 ≤60 rows, all at one place -> team  (place is redundant)
--                                 ≤60 rows or ≤30 days       -> place
--                                 otherwise                  -> both null
--                               Either is null unless the group agrees on one value.
--
-- Run once in the Supabase SQL editor; re-run to replace on changes.
--
-- CREATE OR REPLACE cannot change a function's return type, so when the
-- RETURNS TABLE shape changes Postgres errors with 42P13. DROP first (by full
-- argument signature) makes this script safe to re-run through shape changes.

DROP FUNCTION IF EXISTS get_timestamps_graph_stats(text[], text[], int[], text[], text[], text[]);

CREATE OR REPLACE FUNCTION get_timestamps_graph_stats(
  p_team        text[]    DEFAULT NULL,
  p_category    text[]    DEFAULT NULL,
  p_year        int[]     DEFAULT NULL,
  p_league      text[]    DEFAULT NULL,
  p_place       text[]    DEFAULT NULL,
  p_attack_type text[]    DEFAULT NULL
)
RETURNS TABLE (
  dist_under_13     bigint,
  dist_13_to_14     bigint,
  dist_14_to_15     bigint,
  dist_15_to_16     bigint,
  dist_16_to_17     bigint,
  dist_17_to_18     bigint,
  dist_18_to_19     bigint,
  dist_over_19      bigint,
  dist_unsuccessful bigint,
  progression       json
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT id, attack_date, final_time, lp, pp, place, team
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
    SELECT id, attack_date, final_time, lp, pp, place, team
    FROM base
    WHERE final_time IS NOT NULL
  ),
  counts AS (
    SELECT
      COUNT(*)                                       AS n_rows,
      COUNT(DISTINCT attack_date)                    AS n_days,
      COUNT(DISTINCT EXTRACT(YEAR FROM attack_date)) AS n_years,
      -- "Every row shares one place", without the sort a COUNT(DISTINCT) costs.
      -- No rows, or an all-NULL place, compares to NULL -> false.
      COALESCE(MIN(place) = MAX(place), false)       AS one_place
    FROM successful
  ),
  modes AS (
    SELECT
      -- ≤40 rows that all sit at a single place: the place is the same on every
      -- point and tells the reader nothing, so label points with the team instead.
      (n_rows <= 60 AND one_place)                        AS show_team,
      (n_rows <= 60 OR n_days <= 30)
        AND NOT (n_rows <= 60 AND one_place)              AS show_place,
      -- Granularity for the whole series; see the header comment.
      CASE
        WHEN n_rows  <= 60 THEN 'row'
        WHEN n_days  <= 30 THEN 'day'
        WHEN n_years >= 6  THEN 'year'
        ELSE                    'month'
      END                                                 AS bucket
    FROM counts
  ),
  keyed AS (
    SELECT
      attack_date,
      final_time,
      lp,
      pp,
      place,
      team,
      -- Collapse every mode onto one sort key, so the ranking below needs a
      -- single window. A CASE over four windows would not help: Postgres
      -- evaluates every window it sees, sorting the whole set once per ordering.
      CASE (SELECT bucket FROM modes)
        WHEN 'year'  THEN date_trunc('year',  attack_date)
        WHEN 'month' THEN date_trunc('month', attack_date)
        ELSE              attack_date::timestamp
      END AS period,
      -- 'row' mode wants one group per row: id makes the key unique, so the rank
      -- below numbers rows 1..n. Other modes share one key per period.
      CASE WHEN (SELECT bucket FROM modes) = 'row' THEN id ELSE 0 END AS tie
    FROM successful
  ),
  ranked AS (
    SELECT
      attack_date,
      final_time,
      lp,
      pp,
      place,
      team,
      -- Buckets follow calendar periods rather than equal-sized tiles, so every
      -- point covers a period a reader can name. DENSE_RANK collapses periods
      -- with no attacks, keeping the series contiguous.
      DENSE_RANK() OVER (ORDER BY period, tie) AS grp
    FROM keyed
  ),
  progression_agg AS (
    SELECT
      grp                                          AS "group",
      ROUND(AVG(final_time)::numeric, 2)::float8   AS avg_time,
      ROUND(MIN(final_time)::numeric, 2)::float8   AS min_time,
      MIN(attack_date)::text                       AS start_date,
      MAX(attack_date)::text                       AS end_date,
      ROUND(AVG(lp)::numeric, 2)::float4           AS avg_lp,
      ROUND(AVG(pp)::numeric, 2)::float4           AS avg_pp,
      -- Label each point with a place or a team (never both, see `modes`), and
      -- only when the group's rows agree on one value. MIN = MAX tests that in a
      -- single pass; COUNT(DISTINCT) would sort every group, and the sort would
      -- run even for the modes that discard the result.
      CASE
        WHEN (SELECT show_place FROM modes) AND MIN(place) = MAX(place)
          THEN MIN(place)
      END                                          AS place,
      CASE
        WHEN (SELECT show_team FROM modes) AND MIN(team) = MAX(team)
          THEN MIN(team)
      END                                          AS team,
      (SELECT bucket FROM modes)                   AS bucket
    FROM ranked
    GROUP BY grp
  )
  SELECT
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time < 13)::bigint                     AS dist_under_13,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 13 AND final_time < 14)::bigint AS dist_13_to_14,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 14 AND final_time < 15)::bigint AS dist_14_to_15,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 15 AND final_time < 16)::bigint AS dist_15_to_16,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 16 AND final_time < 17)::bigint AS dist_16_to_17,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 17 AND final_time < 18)::bigint AS dist_17_to_18,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 18 AND final_time < 19)::bigint AS dist_18_to_19,
    COUNT(*) FILTER (WHERE final_time IS NOT NULL AND final_time >= 19)::bigint             AS dist_over_19,
    COUNT(*) FILTER (WHERE final_time IS NULL)::bigint                                      AS dist_unsuccessful,
    (SELECT COALESCE(json_agg(p ORDER BY p."group"), '[]'::json) FROM progression_agg p)   AS progression
  FROM base;
$$;
