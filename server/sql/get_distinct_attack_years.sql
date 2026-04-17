-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create RPC function get_distinct_attack_years
--
-- Purpose:
--   Returns all distinct calendar years present in the `attack_date` column
--   of the `public.timestamps` table, sorted in descending order (newest first).
--
-- Why an RPC / stored function:
--   The Supabase JS client does not support SELECT DISTINCT or
--   EXTRACT(YEAR FROM ...) directly via the query builder.
--   A PostgreSQL function is the clean, scalable solution — the EXTRACT and
--   DISTINCT happen inside the database; only the small result set is returned.
--
-- How to apply:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. The function will be callable from the backend via:
--        supabase.rpc('get_distinct_attack_years')
--      which returns: [{ year: 2025 }, { year: 2024 }, ...]
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_distinct_attack_years()
RETURNS TABLE(year integer)
LANGUAGE sql
STABLE          -- declares the function does not modify the database
SECURITY DEFINER -- runs with the privileges of the function owner
SET search_path = public
AS $$
  SELECT DISTINCT
    EXTRACT(YEAR FROM attack_date)::integer AS year
  FROM public.timestamps
  WHERE attack_date IS NOT NULL
  ORDER BY year DESC;
$$;

-- Grant execute permission to the authenticated and anon roles so the
-- Supabase client (both service-role and anon key) can call it.
GRANT EXECUTE ON FUNCTION public.get_distinct_attack_years() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_attack_years() TO anon;
GRANT EXECUTE ON FUNCTION public.get_distinct_attack_years() TO service_role;
