import { Router, Request, Response } from 'express';
import supabase from '../services/supabaseClient';
import {
  buildTimestampsQuery,
  buildStatsQuery,
  buildDistinctValuesQuery,
} from '../services/queryBuilder';
import { computeStats } from '../services/statsCalculator';
import {
  parseFilters,
  parseSort,
  parsePagination,
  validateAutocompleteColumn,
  parseSearchTerm,
  asAutocompleteColumn,
} from '../middleware/validation';
import {
  type TimestampsResponse,
  type StatsResponse,
  type DistinctValuesResponse,
  type DistinctYearsResponse,
} from '../types/index';

const router = Router();

// ─── GET /api/timestamps ───────────────────────────────────────────────────────
//
// Returns a paginated, filtered, sorted page of timestamp rows.
//
// Query params:
//   team, category, league, place, attack_type  — comma-separated strings
//   year                                         — comma-separated integers
//   sort       — column name (whitelist-validated), default "attack_date"
//   order      — "asc" | "desc", default "desc"
//   limit      — integer 1-50, default 50
//   offset     — integer ≥ 0, default 0
//
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const filters = parseFilters(req.query);
  const sort = parseSort(req.query);
  const pagination = parsePagination(req.query);

  const { data, error, count } = await buildTimestampsQuery(
    supabase,
    filters,
    sort,
    pagination
  );

  if (error) {
    console.error('[GET /api/timestamps] Supabase error:', error.message);
    res.status(500).json({ error: 'Failed to fetch timestamps.' });
    return;
  }

  const totalCount = count ?? 0;
  const response: TimestampsResponse = {
    data: data ?? [],
    totalCount,
    hasMore: pagination.offset + pagination.limit < totalCount,
  };

  res.json(response);
});

// ─── GET /api/timestamps/stats ─────────────────────────────────────────────────
//
// Returns aggregate statistics over ALL rows matching the active filters.
// Uses the same filter params as the main endpoint but no sort/pagination.
//
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const filters = parseFilters(req.query);

  const { data, error, count } = await buildStatsQuery(supabase, filters);

  if (error) {
    console.error('[GET /api/timestamps/stats] Supabase error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats.' });
    return;
  }

  const totalCount = count ?? 0;
  const stats: StatsResponse = computeStats(data ?? [], totalCount);

  res.json(stats);
});

// ─── GET /api/timestamps/distinct/years ────────────────────────────────────────
//
// Returns all distinct years present in the attack_date column, sorted descending.
// Uses a Supabase RPC (PostgreSQL function) for efficiency at scale.
//
// The RPC function `get_distinct_attack_years` must be created in Supabase;
// the SQL migration is provided in server/sql/get_distinct_attack_years.sql.
//
router.get('/distinct/years', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase.rpc('get_distinct_attack_years');

  if (error) {
    console.error('[GET /api/timestamps/distinct/years] Supabase RPC error:', error.message);
    res.status(500).json({ error: 'Failed to fetch distinct years.' });
    return;
  }

  // RPC returns an array of objects: [{ year: 2025 }, { year: 2024 }, ...]
  const years: number[] = (data as Array<{ year: number }>).map((row) => row.year);
  const response: DistinctYearsResponse = { years };
  res.json(response);
});

// ─── GET /api/timestamps/distinct/:column ──────────────────────────────────────
//
// Returns distinct values for a whitelisted text column.
// Supports optional case-insensitive partial matching via ?search=...
//
// :column must be one of: team, category, league, place, attack_type
//
router.get(
  '/distinct/:column',
  validateAutocompleteColumn,
  async (req: Request, res: Response): Promise<void> => {
    const column = asAutocompleteColumn(req.params['column'] as string);
    const searchTerm = parseSearchTerm(req.query);

    const { data, error } = await buildDistinctValuesQuery(supabase, column, searchTerm);

    if (error) {
      console.error(`[GET /api/timestamps/distinct/${column}] Supabase error:`, error.message);
      res.status(500).json({ error: `Failed to fetch distinct values for "${column}".` });
      return;
    }

    // De-duplicate in Node.js (Supabase JS does not support SELECT DISTINCT natively)
    const seen = new Set<string>();
    const values: string[] = [];
    for (const row of data ?? []) {
      const value = (row as Record<string, string>)[column];
      if (typeof value === 'string' && value.length > 0 && !seen.has(value)) {
        seen.add(value);
        values.push(value);
      }
    }

    const response: DistinctValuesResponse = { values };
    res.json(response);
  }
);

export default router;
