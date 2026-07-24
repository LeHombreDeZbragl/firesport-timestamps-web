import { Router, Request, Response } from 'express';
import supabase from '../services/supabaseClient';
import logger from '../services/logger';
import { buildTimestampsQuery } from '../services/queryBuilder';
import { requireAdmin } from '../middleware/adminAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getCached, setCached, clearCache } from '../services/cache';
import {
  parseFilters,
  parseSort,
  parsePagination,
  validateAutocompleteColumn,
  parseSearchTerm,
  asAutocompleteColumn,
  parseId,
  parseUpdateBody,
  parseBatchBody,
} from '../middleware/validation';
import {
  type ParsedFilters,
  type TimestampsResponse,
  type StatsResponse,
  type GraphStatsResponse,
  type ProgressionBucket,
  type DistinctValuesResponse,
  type DistinctYearsResponse,
  type LeaguePairsResponse,
  type BatchValidationError,
} from '../types/index';

const router = Router();

// TTL for cached read responses. Data changes only on admin writes (which call
// clearCache), so this only bounds staleness if a write somehow doesn't — and it
// absorbs bursts of identical requests (e.g. everyone loading the default view
// at launch) into a single DB round-trip. See services/cache.ts.
const CACHE_TTL_MS = 300_000;

/** True when no filter is active — i.e. the default (whole-table) view, the
 *  most-requested and most-expensive case, so its aggregates are cacheable. */
function hasNoFilters(f: ParsedFilters): boolean {
  return (
    f.team.length === 0 &&
    f.category.length === 0 &&
    f.year.length === 0 &&
    f.league.length === 0 &&
    f.place.length === 0 &&
    f.attackType.length === 0
  );
}

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
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
    logger.error({ err: error }, 'GET /api/timestamps — Supabase error');
    res.status(500).json({ error: 'Failed to fetch timestamps.' });
    return;
  }

  // buildTimestampsQuery fetches limit + 1 rows: a full extra row means more
  // pages exist. Slice the sentinel off so the client only sees `limit` rows.
  const rows = data ?? [];
  const hasMore = rows.length > pagination.limit;
  const pageRows = hasMore ? rows.slice(0, pagination.limit) : rows;

  // The count is an estimate (see queryBuilder). Never report fewer than what
  // we've actually loaded; when we've reached the end, the total is exact.
  const loadedThrough = pagination.offset + pageRows.length;
  const totalCount = hasMore ? Math.max(count ?? 0, loadedThrough + 1) : loadedThrough;

  const response: TimestampsResponse = {
    data: pageRows,
    totalCount,
    hasMore,
  };

  res.json(response);
}));

// ─── GET /api/timestamps/stats ─────────────────────────────────────────────────
//
// Returns aggregate statistics over ALL rows matching the active filters.
// Delegates to the `get_timestamps_stats` Supabase RPC so that statistics are
// computed over the full dataset (not capped by Supabase's JS row limit).
//
router.get('/stats', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const filters = parseFilters(req.query);

  // The unfiltered (default-view) aggregate is the hot path — cache it.
  const cacheable = hasNoFilters(filters);
  if (cacheable) {
    const hit = getCached<StatsResponse>('stats:all');
    if (hit) {
      res.json(hit);
      return;
    }
  }

  const { data, error } = await supabase.rpc('get_timestamps_stats', {
    p_team:        filters.team.length        > 0 ? filters.team        : null,
    p_category:    filters.category.length    > 0 ? filters.category    : null,
    p_year:        filters.year.length        > 0 ? filters.year        : null,
    p_league:      filters.league.length      > 0 ? filters.league      : null,
    p_place:       filters.place.length       > 0 ? filters.place       : null,
    p_attack_type: filters.attackType.length  > 0 ? filters.attackType  : null,
  });

  if (error) {
    logger.error({ err: error }, 'GET /api/timestamps/stats — Supabase RPC error');
    res.status(500).json({ error: 'Failed to fetch stats.' });
    return;
  }

  // RPC returns a single row; Supabase wraps it in an array.
  const row = Array.isArray(data) ? data[0] : data;
  const stats: StatsResponse = row
    ? {
        averageTime:       row.average_time       ?? null,
        bestTime:          row.best_time          ?? null,
        medianTime:        row.median_time        ?? null,
        lpFasterCount:     Number(row.lp_faster        ?? 0),
        ppFasterCount:     Number(row.pp_faster        ?? 0),
        equalCount:        Number(row.equal_count       ?? 0),
        totalCount:        Number(row.total_count       ?? 0),
        successfulCount:   Number(row.successful_count  ?? 0),
        unsuccessfulCount: Number(row.unsuccessful_count ?? 0),
        avgLp:             row.avg_lp ?? null,
        avgPp:             row.avg_pp ?? null,
      }
    : {
        averageTime: null, bestTime: null, medianTime: null,
        lpFasterCount: 0, ppFasterCount: 0, equalCount: 0, totalCount: 0,
        successfulCount: 0, unsuccessfulCount: 0,
        avgLp: null, avgPp: null,
      };

  if (cacheable) setCached('stats:all', stats, CACHE_TTL_MS);
  res.json(stats);
}));

// ─── GET /api/timestamps/graph-stats ─────────────────────────────────────────
//
// Returns chart data: time-bucket distribution + a chronological progression
// series, grouped per row / day / month / year depending on how much data the
// filters match (the RPC decides; each point carries the `bucket` it used).
// Accepts the same filter query params as /stats.
//
router.get('/graph-stats', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const filters = parseFilters(req.query);

  const cacheable = hasNoFilters(filters);
  if (cacheable) {
    const hit = getCached<GraphStatsResponse>('graph:all');
    if (hit) {
      res.json(hit);
      return;
    }
  }

  const { data, error } = await supabase.rpc('get_timestamps_graph_stats', {
    p_team:        filters.team.length        > 0 ? filters.team        : null,
    p_category:    filters.category.length    > 0 ? filters.category    : null,
    p_year:        filters.year.length        > 0 ? filters.year        : null,
    p_league:      filters.league.length      > 0 ? filters.league      : null,
    p_place:       filters.place.length       > 0 ? filters.place       : null,
    p_attack_type: filters.attackType.length  > 0 ? filters.attackType  : null,
  });

  if (error) {
    logger.error({ err: error }, 'GET /api/timestamps/graph-stats — Supabase RPC error');
    res.status(500).json({ error: 'Failed to fetch graph stats.' });
    return;
  }

  type RawProgression = { group: number; avg_time: number; min_time: number; start_date: string; end_date: string; avg_lp: number | null; avg_pp: number | null; place: string | null; team: string | null; bucket: ProgressionBucket | null };

  const row = Array.isArray(data) ? data[0] : data;
  const graphStats: GraphStatsResponse = row
    ? {
        distUnder13:      Number(row.dist_under_13     ?? 0),
        dist13To14:       Number(row.dist_13_to_14     ?? 0),
        dist14To15:       Number(row.dist_14_to_15     ?? 0),
        dist15To16:       Number(row.dist_15_to_16     ?? 0),
        dist16To17:       Number(row.dist_16_to_17     ?? 0),
        dist17To18:       Number(row.dist_17_to_18     ?? 0),
        dist18To19:       Number(row.dist_18_to_19     ?? 0),
        distOver19:       Number(row.dist_over_19      ?? 0),
        distUnsuccessful: Number(row.dist_unsuccessful ?? 0),
        progression: Array.isArray(row.progression)
          ? (row.progression as RawProgression[]).map((p) => ({
              group:     p.group,
              avgTime:   p.avg_time,
              minTime:   p.min_time,
              startDate: p.start_date,
              endDate:   p.end_date,
              avgLp:     p.avg_lp ?? null,
              avgPp:     p.avg_pp ?? null,
              place:     p.place ?? null,
              team:      p.team ?? null,
              bucket:    p.bucket ?? null,
            }))
          : [],
      }
    : {
        distUnder13: 0, dist13To14: 0, dist14To15: 0, dist15To16: 0,
        dist16To17: 0, dist17To18: 0, dist18To19: 0, distOver19: 0,
        distUnsuccessful: 0, progression: [],
      };

  if (cacheable) setCached('graph:all', graphStats, CACHE_TTL_MS);
  res.json(graphStats);
}));

// ─── GET /api/timestamps/distinct/years ────────────────────────────────────────
//
// Returns all distinct years present in the attack_date column, sorted descending.
// Uses a Supabase RPC (PostgreSQL function) for efficiency at scale.
//
// The RPC function `get_distinct_attack_years` must be created in Supabase;
// the SQL migration is provided in server/sql/get_distinct_attack_years.sql.
//
router.get('/distinct/years', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const cached = getCached<DistinctYearsResponse>('distinct:years');
  if (cached) {
    res.json(cached);
    return;
  }

  const { data, error } = await supabase.rpc('get_distinct_attack_years');

  if (error) {
    logger.error({ err: error }, 'GET /api/timestamps/distinct/years — Supabase RPC error');
    res.status(500).json({ error: 'Failed to fetch distinct years.' });
    return;
  }

  // RPC returns an array of objects: [{ year: 2025 }, { year: 2024 }, ...]
  const rows = (data as Array<{ year: number }> | null) ?? [];
  const years: number[] = rows.map((row) => row.year);
  const response: DistinctYearsResponse = { years };
  setCached('distinct:years', response, CACHE_TTL_MS);
  res.json(response);
}));

// ─── GET /api/timestamps/distinct/league-pairs ─────────────────────────────────
//
// Returns distinct (league short code, full league name) pairs.
// Used by the LeagueFilter for tooltips and long-name search.
//
router.get('/distinct/league-pairs', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const cached = getCached<LeaguePairsResponse>('distinct:league-pairs');
  if (cached) {
    res.json(cached);
    return;
  }

  const { data, error } = await supabase.rpc('get_distinct_league_pairs');

  if (error) {
    logger.error({ err: error }, 'GET /api/timestamps/distinct/league-pairs — Supabase RPC error');
    res.status(500).json({ error: 'Failed to fetch league pairs.' });
    return;
  }

  const rows = (data as Array<{ short_name: string; full_name: string }> | null) ?? [];
  const pairs = rows.map((row) => ({
    short: row.short_name,
    full: row.full_name,
  }));
  const response: LeaguePairsResponse = { pairs };
  setCached('distinct:league-pairs', response, CACHE_TTL_MS);
  res.json(response);
}));

// ─── GET /api/timestamps/distinct/:column ──────────────────────────────────────
//
// Returns distinct values for a whitelisted text column.
// Supports optional case-insensitive partial matching via ?search=...
// Delegates to the `get_distinct_column_values` Supabase RPC.
//
// :column must be one of: team, category, league, place, attack_type
//
router.get(
  '/distinct/:column',
  validateAutocompleteColumn,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const column = asAutocompleteColumn(req.params['column'] as string);
    const searchTerm = parseSearchTerm(req.query);

    // Cache only the no-search case (the full list shown when a filter dropdown
    // first opens) — the common, repeated request. Searches vary too much to cache.
    const cacheKey = searchTerm === '' ? `distinct:col:${column}` : null;
    if (cacheKey) {
      const cached = getCached<DistinctValuesResponse>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    const { data, error } = await supabase.rpc('get_distinct_column_values', {
      p_column: column,
      p_search: searchTerm,
    });

    if (error) {
      logger.error({ err: error, column }, 'GET /api/timestamps/distinct/:column — Supabase RPC error');
      res.status(500).json({ error: `Failed to fetch distinct values for "${column}".` });
      return;
    }

    const rows = (data as Array<{ value: string }> | null) ?? [];
    const values: string[] = rows.map((row) => row.value);
    const response: DistinctValuesResponse = { values };
    if (cacheKey) setCached(cacheKey, response, CACHE_TTL_MS);
    res.json(response);
  })
);
// ─── PATCH /api/timestamps/:id ─────────────────────────────────────────────────────
//
// Updates editable fields of a single timestamp row.
// Fields `id`, `created_at`, and `final_time` are not accepted:
//   - `id` and `created_at` are immutable.
//   - `final_time` is a GENERATED ALWAYS AS STORED column; the database
//     recomputes it automatically whenever `lp` or `pp` changes.
//
router.patch('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params['id']);
  if (id === null) {
    res.status(400).json({ error: 'Invalid id. Must be a positive integer.' });
    return;
  }

  const result = parseUpdateBody(req.body);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  const { data, error } = await supabase
    .from('timestamps')
    .update(result.data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'Timestamp not found.' });
      return;
    }
    logger.error({ err: error, id }, 'PATCH /api/timestamps/:id — Supabase error');
    res.status(500).json({ error: 'Failed to update timestamp.' });
    return;
  }

  clearCache(); // row changed — drop cached aggregates/distincts so reads are fresh
  res.json(data);
}));
// ─── DELETE /api/timestamps/:id ────────────────────────────────────────────────
//
// Deletes a single timestamp row by its numeric id.
// Intended for debugging/admin purposes.
//
router.delete('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params['id']);

  if (id === null) {
    res.status(400).json({ error: 'Invalid id. Must be a positive integer.' });
    return;
  }

  const { error } = await supabase
    .from('timestamps')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error({ err: error, id }, 'DELETE /api/timestamps/:id — Supabase error');
    res.status(500).json({ error: 'Failed to delete timestamp.' });
    return;
  }

  clearCache(); // row removed — drop cached aggregates/distincts so reads are fresh
  res.status(204).send();
}));

// ─── POST /api/timestamps/batch ────────────────────────────────────────────────
//
// Atomically saves a batch of changes: updates to existing rows, new inserts,
// and staged deletes. All items are validated before any writes are performed.
// If validation fails, returns 400 with per-field errors. If any write fails
// after validation passes, returns 500.
//
router.post('/batch', requireAdmin, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // 1. Structural + field-level validation
  const parsed = parseBatchBody(req.body);
  if (!parsed.valid) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const { data: { updates, inserts, deletes }, fieldErrors } = parsed;

  // 2. Query distinct allowed values for league / attack_type / category
  const [leagueResult, typeResult, categoryResult] = await Promise.all([
    supabase.rpc('get_distinct_column_values', { p_column: 'league', p_search: '' }),
    supabase.rpc('get_distinct_column_values', { p_column: 'attack_type', p_search: '' }),
    supabase.rpc('get_distinct_column_values', { p_column: 'category', p_search: '' }),
  ]);

  if (leagueResult.error || typeResult.error || categoryResult.error) {
    logger.error(
      { leagueErr: leagueResult.error, typeErr: typeResult.error, categoryErr: categoryResult.error },
      'POST /api/timestamps/batch — failed to fetch distinct values for validation',
    );
    res.status(500).json({ error: 'Failed to validate batch.' });
    return;
  }

  const validLeagues = new Set<string>(
    ((leagueResult.data as Array<{ value: string }>) ?? []).map((r) => r.value),
  );
  const validTypes = new Set<string>(
    ((typeResult.data as Array<{ value: string }>) ?? []).map((r) => r.value),
  );
  const validCategories = new Set<string>(
    ((categoryResult.data as Array<{ value: string }>) ?? []).map((r) => r.value),
  );

  // 3. Validate league / attack_type / category values against DB sets
  const allRows: Array<{ rowRef: string; fields: Record<string, unknown> }> = [
    ...updates.map((u) => ({ rowRef: `update:${u.id}`, fields: u.fields as Record<string, unknown> })),
    ...inserts.map((ins, i) => ({ rowRef: `insert:${i}`, fields: ins as Record<string, unknown> })),
  ];

  for (const { rowRef, fields } of allRows) {
    if ('league' in fields && typeof fields['league'] === 'string' && !validLeagues.has(fields['league'])) {
      fieldErrors.push({ rowRef, field: 'league', message: `Liga "${fields['league']}" neexistuje.` });
    }
    if ('attack_type' in fields && typeof fields['attack_type'] === 'string' && !validTypes.has(fields['attack_type'])) {
      fieldErrors.push({ rowRef, field: 'attack_type', message: `Typ "${fields['attack_type']}" neexistuje.` });
    }
    if ('category' in fields && typeof fields['category'] === 'string' && !validCategories.has(fields['category'])) {
      fieldErrors.push({ rowRef, field: 'category', message: `Kategorie "${fields['category']}" neexistuje.` });
    }
  }

  if (fieldErrors.length > 0) {
    const errors: BatchValidationError[] = fieldErrors;
    res.status(400).json({ errors });
    return;
  }

  // 4. Execute all writes atomically via the batch_save_timestamps RPC.
  //    The plpgsql function body is a single implicit transaction: any failure
  //    (e.g. a constraint violation on one insert) rolls back the whole batch,
  //    so a mid-sequence error can never leave partial changes. Validation has
  //    already run above; the RPC only receives sanitised values.
  //    (SQL: server/sql/batch_save_timestamps.sql — apply by hand in Supabase.)
  const { error: rpcError } = await supabase.rpc('batch_save_timestamps', {
    p_deletes: deletes,
    p_updates: updates,
    p_inserts: inserts,
  });

  if (rpcError) {
    logger.error({ err: rpcError }, 'POST /api/timestamps/batch — write error');
    res.status(500).json({ error: 'Failed to save batch changes.' });
    return;
  }

  clearCache(); // data changed — drop cached aggregates/distincts so reads are fresh
  res.json({ success: true });
}));

export default router;
