import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// ─── Database row ──────────────────────────────────────────────────────────────

/**
 * One row from the public.timestamps table as returned by the API.
 * Columns that are non-nullable in the DB use non-null types.
 * Float4 columns that are nullable are typed as `number | null`.
 */
export interface Timestamp {
  id: number;
  created_at: string;        // ISO timestamp string
  attack_date: string;       // "YYYY-MM-DD"
  league: string;
  place: string;
  placement: number;
  link: string;
  attack_type: string;
  category: string;
  team: string;
  kos: number | null;
  naber: number | null;
  kohout: number | null;
  rozdelovac: number | null;
  lp_vystrik: number | null;
  pp_vystrik: number | null;
  lp: number | null;
  pp: number | null;
  final_time: number | null; // generated: GREATEST(lp, pp) when both non-null
}

// ─── Filters ───────────────────────────────────────────────────────────────────

/**
 * All filter state held by the app.
 * Each text filter holds zero or more selected values (OR within, AND across).
 */
export interface Filters {
  team: string[];
  category: string[];
  year: number[];
  league: string[];
  place: string[];
  attackType: string[];  // maps to attack_type column
}

/**
 * A mapping from a filter key to its human-readable label.
 * Used for rendering active filter pills and filter headings.
 */
export type FilterKey = keyof Filters;

// ─── Sort ──────────────────────────────────────────────────────────────────────

/** Columns the user can sort by — mirrors the server-side whitelist. */
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

export interface SortConfig {
  column: SortableColumn;
  order: SortOrder;
}

// ─── Column definitions ────────────────────────────────────────────────────────

/**
 * Drives the table rendering and supports future column visibility toggling
 * without touching component code — just update the config array in constants.ts.
 */
export interface ColumnDefinition {
  /** The key that matches the Timestamp interface property. */
  key: keyof Timestamp;
  /** Human-readable column header. */
  label: string;
  /** Whether this column participates in click-to-filter. */
  filterable: boolean;
  /**
   * Which filter key to update when this column's cell is clicked.
   * Must be set when `filterable` is true.
   */
  filterKey?: FilterKey;
  /** Whether the column is sortable (has a sort toggle in the header). */
  sortable: boolean;
  /**
   * The server-side column name used for sorting.
   * Defaults to `key` if not specified.
   */
  sortColumn?: SortableColumn;
  /** Whether the column is visible by default. */
  defaultVisible: boolean;
  /**
   * Optional cell value formatter. If provided, it is called instead of the
   * default string coercion. Receives the raw value (may be null).
   */
  format?: (value: Timestamp[keyof Timestamp]) => string;
  /**
   * Optional Font Awesome icon shown instead of the label on narrow screens.
   * When set, the label is shown only on sm+ screens; the icon is shown on xs.
   */
  icon?: IconDefinition;
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

/** Aggregate statistics over the current filtered dataset. */
export interface Stats {
  averageTime: number | null;
  bestTime: number | null;
  medianTime: number | null;
  lpFasterCount: number;
  ppFasterCount: number;
  equalCount: number;
  totalCount: number;
}

// ─── API response shapes ───────────────────────────────────────────────────────

export interface TimestampsApiResponse {
  data: Timestamp[];
  totalCount: number;
  hasMore: boolean;
}

export interface DistinctValuesApiResponse {
  values: string[];
}

export interface DistinctYearsApiResponse {
  years: number[];
}

export interface LeaguePair {
  short: string;
  full: string;
}

export interface LeaguePairsApiResponse {
  pairs: LeaguePair[];
}

// ─── URL-serialisable filter key ───────────────────────────────────────────────

/**
 * The set of query param names used to serialise filters in the URL.
 * `attack_type` is the param name (snake_case, matching the DB column).
 */
export type FilterUrlParam =
  | 'team'
  | 'category'
  | 'year'
  | 'league'
  | 'place'
  | 'attack_type';

// ─── Inline row editing ────────────────────────────────────────────────────────────

/**
 * Fields that can be modified by the user via the inline row editor.
 * `id` and `created_at` are immutable; `final_time` is computed by the DB.
 */
export type EditableTimestampFields = Omit<Timestamp, 'id' | 'created_at' | 'final_time'>;
