import { SupabaseClient } from '@supabase/supabase-js';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import {
  type ParsedFilters,
  type ParsedSort,
  type ParsedPagination,
  NO_LEAGUE_VALUE,
} from '../types/index';

/**
 * Quotes a value for use inside a PostgREST `column.in.(...)` filter string,
 * escaping embedded backslashes and double quotes.
 */
function quotePostgrestIn(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// ─── Internal type alias ───────────────────────────────────────────────────────

// After .select() is called, all subsequent filter/sort/range methods are on
// PostgrestFilterBuilder. Using a broad `any` generic here is intentional —
// the specific row shape changes between the data query and the stats query,
// but the filter-application logic is identical for both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterBuilder = PostgrestFilterBuilder<any, any, any, any, any>;

// ─── Filter application ────────────────────────────────────────────────────────

/**
 * Applies all active filter values to a Supabase filter builder.
 *
 * Text filters (team, category, league, place, attack_type):
 *   Multiple values → OR via `.in(column, values)`.
 *   Single value    → same path (in() handles single values fine).
 *
 * Year filter:
 *   Each year is converted to a date range: [YYYY-01-01, YYYY-12-31].
 *   Multiple years use OR logic, e.g. "year=2024,2025" fetches rows
 *   from either year.  When only one year is selected, the simpler
 *   gte/lte form is used; multiple years require an OR expression.
 */
function applyFilters(query: FilterBuilder, filters: ParsedFilters): FilterBuilder {
  if (filters.team.length > 0) {
    query = query.in('team', filters.team);
  }
  if (filters.category.length > 0) {
    query = query.in('category', filters.category);
  }
  if (filters.league.length > 0) {
    // The NO_LEAGUE_VALUE sentinel means "league IS NULL"; real codes use IN.
    const hasNull = filters.league.includes(NO_LEAGUE_VALUE);
    const realLeagues = filters.league.filter((v) => v !== NO_LEAGUE_VALUE);
    if (hasNull && realLeagues.length > 0) {
      const inList = realLeagues.map(quotePostgrestIn).join(',');
      query = query.or(`league.is.null,league.in.(${inList})`);
    } else if (hasNull) {
      query = query.is('league', null);
    } else {
      query = query.in('league', realLeagues);
    }
  }
  if (filters.place.length > 0) {
    query = query.in('place', filters.place);
  }
  if (filters.attackType.length > 0) {
    query = query.in('attack_type', filters.attackType);
  }

  if (filters.year.length === 1) {
    const year = filters.year[0];
    query = query
      .gte('attack_date', `${year}-01-01`)
      .lte('attack_date', `${year}-12-31`);
  } else if (filters.year.length > 1) {
    // Build an OR condition for multiple years:
    // attack_date.gte.2024-01-01,attack_date.lte.2024-12-31
    // is expressed as: (gte.2024-01-01 AND lte.2024-12-31) OR (gte.2025-01-01 AND lte.2025-12-31)
    // Supabase JS .or() accepts a PostgREST filter string.
    const yearConditions = filters.year
      .map((year) => `and(attack_date.gte.${year}-01-01,attack_date.lte.${year}-12-31)`)
      .join(',');
    query = query.or(yearConditions);
  }

  return query;
}

// ─── Public builders ───────────────────────────────────────────────────────────

/**
 * Builds the main paginated, filtered, sorted data query.
 *
 * Uses an *estimated* count (planner statistic — O(1)) instead of `exact`,
 * which on a 250k-row table would scan the whole matching set on every page
 * load. The route derives an exact `hasMore` separately by fetching one extra
 * row (limit + 1), so pagination stays correct even though the total is
 * approximate; the estimate is only used for the displayed grand total.
 */
export async function buildTimestampsQuery(
  supabase: SupabaseClient,
  filters: ParsedFilters,
  sort: ParsedSort,
  pagination: ParsedPagination
) {
  // .select() returns a PostgrestFilterBuilder — then we apply filters, sort, range.
  let query: FilterBuilder = supabase
    .from('timestamps')
    .select('*', { count: 'estimated' });

  query = applyFilters(query, filters);

  query = query.order(sort.column, { ascending: sort.order === 'asc' });

  const from = pagination.offset;
  // Fetch one extra row so the route can tell whether more rows exist without
  // an exact count. The route slices this sentinel row off before responding.
  const to = pagination.offset + pagination.limit;
  query = query.range(from, to);

  return query;
}
