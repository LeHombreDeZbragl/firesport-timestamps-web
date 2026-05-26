-- Returns all distinct (league, full_league_name) pairs, ordered by league.
-- Used to populate the league filter tooltip and long-name search on the frontend.

CREATE OR REPLACE FUNCTION public.get_distinct_league_pairs()
RETURNS TABLE(short_name text, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT league::text, full_league_name::text
  FROM public.timestamps
  WHERE league IS NOT NULL
    AND full_league_name IS NOT NULL
  ORDER BY league;
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_league_pairs() TO authenticated, anon, service_role;
