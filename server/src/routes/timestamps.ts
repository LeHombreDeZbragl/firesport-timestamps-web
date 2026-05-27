import { Router, Request, Response } from 'express';
import supabase from '../services/supabaseClient';
import { buildTimestampsQuery } from '../services/queryBuilder';
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
  type TimestampsResponse,
  type StatsResponse,
  type GraphStatsResponse,
  type DistinctValuesResponse,
  type DistinctYearsResponse,
  type LeaguePairsResponse,
  type BatchValidationError,
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
// Delegates to the `get_timestamps_stats` Supabase RPC so that statistics are
// computed over the full dataset (not capped by Supabase's JS row limit).
//
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const filters = parseFilters(req.query);

  const { data, error } = await supabase.rpc('get_timestamps_stats', {
    p_team:        filters.team.length        > 0 ? filters.team        : null,
    p_category:    filters.category.length    > 0 ? filters.category    : null,
    p_year:        filters.year.length        > 0 ? filters.year        : null,
    p_league:      filters.league.length      > 0 ? filters.league      : null,
    p_place:       filters.place.length       > 0 ? filters.place       : null,
    p_attack_type: filters.attackType.length  > 0 ? filters.attackType  : null,
  });

  if (error) {
    console.error('[GET /api/timestamps/stats] Supabase RPC error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats.' });
    return;
  }

  // RPC returns a single row; Supabase wraps it in an array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    res.json({
      averageTime: null, bestTime: null, medianTime: null,
      lpFasterCount: 0, ppFasterCount: 0, equalCount: 0, totalCount: 0,
      successfulCount: 0, unsuccessfulCount: 0,
      avgLp: null, avgPp: null,
    });
    return;
  }

  const stats: StatsResponse = {
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
  };

  res.json(stats);
});

// ─── GET /api/timestamps/graph-stats ─────────────────────────────────────────
//
// Returns chart data: time-bucket distribution + 20-point chronological
// progression series (avg & min per NTILE group).
// Accepts the same filter query params as /stats.
//
router.get('/graph-stats', async (req: Request, res: Response): Promise<void> => {
  const filters = parseFilters(req.query);

  const { data, error } = await supabase.rpc('get_timestamps_graph_stats', {
    p_team:        filters.team.length        > 0 ? filters.team        : null,
    p_category:    filters.category.length    > 0 ? filters.category    : null,
    p_year:        filters.year.length        > 0 ? filters.year        : null,
    p_league:      filters.league.length      > 0 ? filters.league      : null,
    p_place:       filters.place.length       > 0 ? filters.place       : null,
    p_attack_type: filters.attackType.length  > 0 ? filters.attackType  : null,
  });

  if (error) {
    console.error('[GET /api/timestamps/graph-stats] Supabase RPC error:', error.message);
    res.status(500).json({ error: 'Failed to fetch graph stats.' });
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    res.json({
      distUnder16: 0, dist16To17: 0, dist17To18: 0, distOver18: 0,
      distUnsuccessful: 0, progression: [],
    });
    return;
  }

  type RawProgression = { group: number; avg_time: number; min_time: number; start_date: string; end_date: string; avg_lp: number | null; avg_pp: number | null };

  const graphStats: GraphStatsResponse = {
    distUnder16:      Number(row.dist_under_16     ?? 0),
    dist16To17:       Number(row.dist_16_to_17     ?? 0),
    dist17To18:       Number(row.dist_17_to_18     ?? 0),
    distOver18:       Number(row.dist_over_18      ?? 0),
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
        }))
      : [],
  };

  res.json(graphStats);
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

// ─── GET /api/timestamps/distinct/league-pairs ─────────────────────────────────
//
// Returns distinct (league short code, full league name) pairs.
// Used by the LeagueFilter for tooltips and long-name search.
//
router.get('/distinct/league-pairs', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase.rpc('get_distinct_league_pairs');

  if (error) {
    console.error('[GET /api/timestamps/distinct/league-pairs] Supabase RPC error:', error.message);
    res.status(500).json({ error: 'Failed to fetch league pairs.' });
    return;
  }

  const pairs = (data as Array<{ short_name: string; full_name: string }>).map((row) => ({
    short: row.short_name,
    full: row.full_name,
  }));
  const response: LeaguePairsResponse = { pairs };
  res.json(response);
});

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
  async (req: Request, res: Response): Promise<void> => {
    const column = asAutocompleteColumn(req.params['column'] as string);
    const searchTerm = parseSearchTerm(req.query);

    const { data, error } = await supabase.rpc('get_distinct_column_values', {
      p_column: column,
      p_search: searchTerm,
    });

    if (error) {
      console.error(`[GET /api/timestamps/distinct/${column}] Supabase RPC error:`, error.message);
      res.status(500).json({ error: `Failed to fetch distinct values for "${column}".` });
      return;
    }

    const values: string[] = (data as Array<{ value: string }>).map((row) => row.value);
    const response: DistinctValuesResponse = { values };
    res.json(response);
  }
);
// ─── PATCH /api/timestamps/:id ─────────────────────────────────────────────────────
//
// Updates editable fields of a single timestamp row.
// Fields `id`, `created_at`, and `final_time` are not accepted:
//   - `id` and `created_at` are immutable.
//   - `final_time` is a GENERATED ALWAYS AS STORED column; the database
//     recomputes it automatically whenever `lp` or `pp` changes.
//
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
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
    console.error(`[PATCH /api/timestamps/${id}] Supabase error:`, error.message);
    res.status(500).json({ error: 'Failed to update timestamp.' });
    return;
  }

  res.json(data);
});
// ─── DELETE /api/timestamps/:id ────────────────────────────────────────────────
//
// Deletes a single timestamp row by its numeric id.
// Intended for debugging/admin purposes.
//
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
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
    console.error(`[DELETE /api/timestamps/${id}] Supabase error:`, error.message);
    res.status(500).json({ error: 'Failed to delete timestamp.' });
    return;
  }

  res.status(204).send();
});

// ─── POST /api/timestamps/batch ────────────────────────────────────────────────
//
// Atomically saves a batch of changes: updates to existing rows, new inserts,
// and staged deletes. All items are validated before any writes are performed.
// If validation fails, returns 400 with per-field errors. If any write fails
// after validation passes, returns 500.
//
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
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
    console.error('[POST /api/timestamps/batch] Failed to fetch distinct values');
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

  // 4. Execute writes (validate-first approach: errors above catch field problems)
  try {
    if (deletes.length > 0) {
      const { error: deleteError } = await supabase
        .from('timestamps')
        .delete()
        .in('id', deletes);
      if (deleteError) throw deleteError;
    }

    for (const item of updates) {
      const { error: updateError } = await supabase
        .from('timestamps')
        .update(item.fields)
        .eq('id', item.id);
      if (updateError) throw updateError;
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from('timestamps')
        .insert(inserts);
      if (insertError) throw insertError;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[POST /api/timestamps/batch] Write error:', err);
    res.status(500).json({ error: 'Failed to save batch changes.' });
  }
});

export default router;
