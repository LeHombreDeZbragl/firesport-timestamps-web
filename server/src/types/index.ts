// ─── Database row ──────────────────────────────────────────────────────────────

/**
 * Represents one row from the public.timestamps table.
 * Nullable columns are typed as `number | null` for float4 fields.
 * Non-nullable columns (enforced by DB constraints) use their non-null types.
 */
export interface TimestampRow {
  id: number;
  created_at: string;       // timestamptz → ISO string from Supabase
  attack_date: string;      // date → "YYYY-MM-DD"
  league: string;
  place: string;
  placement: number;        // int2
  link: string;
  attack_type: string;
  category: string;
  team: string;
  kos: number | null;       // float4
  naber: number | null;     // float4
  kohout: number | null;    // float4
  rozdelovac: number | null; // float4
  lp_vystrik: number | null; // float4
  pp_vystrik: number | null; // float4
  lp: number | null;        // float4
  pp: number | null;        // float4
  final_time: number | null; // float4, generated: GREATEST(lp,pp) when both non-null
}

// ─── Filter inputs ─────────────────────────────────────────────────────────────

/**
 * All supported filter parameters parsed from query strings.
 * Each text-based filter accepts zero or more values (OR logic within a filter,
 * AND logic across filters).
 */
export interface ParsedFilters {
  team: string[];
  category: string[];
  year: number[];           // extracted from attack_date column
  league: string[];
  place: string[];
  attackType: string[];     // maps to "attack_type" column name
}

// ─── Sort ──────────────────────────────────────────────────────────────────────

/** The set of columns that can be used as a sort key. */
export type SortableColumn =
  | 'id'
  | 'attack_date'
  | 'league'
  | 'place'
  | 'placement'
  | 'attack_type'
  | 'category'
  | 'team'
  | 'kos'
  | 'naber'
  | 'kohout'
  | 'rozdelovac'
  | 'lp_vystrik'
  | 'pp_vystrik'
  | 'lp'
  | 'pp'
  | 'final_time';

export type SortOrder = 'asc' | 'desc';

export interface ParsedSort {
  column: SortableColumn;
  order: SortOrder;
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export interface ParsedPagination {
  limit: number;   // 1-50, default 50
  offset: number;  // ≥ 0, default 0
}

// ─── API response shapes ───────────────────────────────────────────────────────

export interface TimestampsResponse {
  data: TimestampRow[];
  totalCount: number;
  hasMore: boolean;
}

export interface StatsResponse {
  averageTime: number | null;
  bestTime: number | null;
  medianTime: number | null;
  lpFasterCount: number;
  ppFasterCount: number;
  equalCount: number;
  totalCount: number;
}

export interface DistinctValuesResponse {
  values: string[];
}

export interface DistinctYearsResponse {
  years: number[];
}

export interface LeaguePair {
  short: string;
  full: string;
}

export interface LeaguePairsResponse {
  pairs: LeaguePair[];
}

// ─── Filterable text columns ───────────────────────────────────────────────────

/** Known columns for which distinct-value autocomplete is supported. */
export type AutocompleteColumn = 'team' | 'category' | 'league' | 'place' | 'attack_type';

/** All column names that can be used as sort keys (validated whitelist). */
export const SORTABLE_COLUMNS: readonly SortableColumn[] = [
  'id',
  'attack_date',
  'league',
  'place',
  'placement',
  'attack_type',
  'category',
  'team',
  'kos',
  'naber',
  'kohout',
  'rozdelovac',
  'lp_vystrik',
  'pp_vystrik',
  'lp',
  'pp',
  'final_time',
] as const;

/** Supported autocomplete columns (validated whitelist). */
export const AUTOCOMPLETE_COLUMNS: readonly AutocompleteColumn[] = [
  'team',
  'category',
  'league',
  'place',
  'attack_type',
] as const;

// ─── Update payload ────────────────────────────────────────────────────────────

/**
 * Fields that can be sent in a PATCH /api/timestamps/:id request body.
 * `id`, `created_at`, and `final_time` are excluded: the first two are
 * immutable, the last is a GENERATED ALWAYS AS STORED column recomputed by
 * the database automatically whenever `lp` or `pp` changes.
 */
export type UpdatePayload = Partial<Omit<TimestampRow, 'id' | 'created_at' | 'final_time'>>;
