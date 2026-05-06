-- Migration: add computed final_time column to timestamps table
--
-- final_time = max(lp, pp) when BOTH lp and pp are non-null.
-- NULL if either value is null (one-sided attacks are not ranked by final time).
--
-- Run once in the Supabase SQL editor.

ALTER TABLE timestamps
  ADD COLUMN IF NOT EXISTS final_time float4
    GENERATED ALWAYS AS (
      CASE
        WHEN lp IS NOT NULL AND pp IS NOT NULL THEN GREATEST(lp, pp)
        ELSE NULL
      END
    ) STORED;
