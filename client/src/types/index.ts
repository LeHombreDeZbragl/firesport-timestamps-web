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
  league: string | null;     // nullable — empty league allowed
  place: string;
  placement: number;
  link: string;
  attack_type: string;
  category: string;
  team: string;
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
  /**
   * Optional transform mapping the raw cell value to the value sent to the
   * filter. Defaults to `String(value)`. Use it when the displayed/stored cell
   * value differs from what should be filtered — e.g. the `attack_date` cell
   * holds a full "YYYY-MM-DD" date but filters by year only.
   */
  filterValue?: (value: Timestamp[keyof Timestamp]) => string;
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
  successfulCount: number;
  unsuccessfulCount: number;
  avgLp: number | null;
  avgPp: number | null;
}

/** Calendar granularity each progression point covers. */
export type ProgressionBucket = 'row' | 'day' | 'month' | 'year';

/** One point in the chronological progression series. */
export interface ProgressionPoint {
  group: number;
  avgTime: number;
  minTime: number;
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  avgLp: number | null;
  avgPp: number | null;
  // Mutually exclusive point label: team when ≤40 rows all share one place
  // (place would be redundant), otherwise place in the small-data tiers.
  place: string | null;
  team: string | null;
  // Calendar period this point covers. Null when the server predates the field.
  bucket: ProgressionBucket | null;
}

/** Chart data: time-bucket distribution + chronological progression. */
export interface GraphStats {
  distUnder13: number;
  dist13To14: number;
  dist14To15: number;
  dist15To16: number;
  dist16To17: number;
  dist17To18: number;
  dist18To19: number;
  distOver19: number;
  distUnsuccessful: number;
  progression: ProgressionPoint[];
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

// ─── Batch save ────────────────────────────────────────────────────────────────

export interface BatchUpdateItem {
  id: number;
  fields: Partial<EditableTimestampFields>;
}

export interface BatchSavePayload {
  updates: BatchUpdateItem[];
  inserts: EditableTimestampFields[];
  deletes: number[];
}

export interface BatchValidationError {
  /** e.g. "update:1234", "insert:0" */
  rowRef: string;
  field: string;
  message: string;
}

/** Return value of the onSave callback passed to DataTable. */
export type BatchSaveOutcome =
  | { success: true }
  | { success: false; errors: BatchValidationError[] };
