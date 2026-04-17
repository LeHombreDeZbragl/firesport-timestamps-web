import type { ColumnDefinition, Filters, SortConfig } from './types/index';

// ─── Pagination ────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 50;

// ─── Default state ─────────────────────────────────────────────────────────────

export const DEFAULT_SORT: SortConfig = {
  column: 'attack_date',
  order: 'desc',
};

export const EMPTY_FILTERS: Filters = {
  team: [],
  category: [],
  year: [],
  league: [],
  place: [],
  attackType: [],
};

// ─── Column definitions ────────────────────────────────────────────────────────
//
// This array drives ALL table rendering: headers, cells, sort toggles, and
// click-to-filter behaviour.  To add, hide, reorder, or rename a column in the
// future, edit only this array — no component code needs to change.
//
// `defaultVisible: false` columns are included in the config but hidden until
// the user explicitly enables them (column visibility toggle — Phase 5+).

export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  {
    key: 'id',
    label: 'ID',
    filterable: false,
    sortable: true,
    sortColumn: 'id',
    defaultVisible: true,
  },
  {
    key: 'attack_date',
    label: 'Date',
    filterable: false,
    sortable: true,
    sortColumn: 'attack_date',
    defaultVisible: true,
    format: (value) => (typeof value === 'string' ? value : '-'),
  },
  {
    key: 'league',
    label: 'League',
    filterable: true,
    filterKey: 'league',
    sortable: true,
    sortColumn: 'league',
    defaultVisible: true,
  },
  {
    key: 'place',
    label: 'Place',
    filterable: true,
    filterKey: 'place',
    sortable: true,
    sortColumn: 'place',
    defaultVisible: true,
  },
  {
    key: 'placement',
    label: 'Placement',
    filterable: false,
    sortable: true,
    sortColumn: 'placement',
    defaultVisible: true,
  },
  {
    key: 'attack_type',
    label: 'Attack Type',
    filterable: true,
    filterKey: 'attackType',
    sortable: true,
    sortColumn: 'attack_type',
    defaultVisible: true,
  },
  {
    key: 'category',
    label: 'Category',
    filterable: true,
    filterKey: 'category',
    sortable: true,
    sortColumn: 'category',
    defaultVisible: true,
  },
  {
    key: 'team',
    label: 'Team',
    filterable: true,
    filterKey: 'team',
    sortable: true,
    sortColumn: 'team',
    defaultVisible: true,
  },
  {
    key: 'kos',
    label: 'KOS',
    filterable: false,
    sortable: true,
    sortColumn: 'kos',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'naber',
    label: 'Naber',
    filterable: false,
    sortable: true,
    sortColumn: 'naber',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'kohout',
    label: 'Kohout',
    filterable: false,
    sortable: true,
    sortColumn: 'kohout',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'rozdelovac',
    label: 'Rozdělovač',
    filterable: false,
    sortable: true,
    sortColumn: 'rozdelovac',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'lp_vystrik',
    label: 'LP Výstřik',
    filterable: false,
    sortable: true,
    sortColumn: 'lp_vystrik',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'pp_vystrik',
    label: 'PP Výstřik',
    filterable: false,
    sortable: true,
    sortColumn: 'pp_vystrik',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'lp',
    label: 'LP',
    filterable: false,
    sortable: true,
    sortColumn: 'lp',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'pp',
    label: 'PP',
    filterable: false,
    sortable: true,
    sortColumn: 'pp',
    defaultVisible: true,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'link',
    label: 'Link',
    filterable: false,
    sortable: false,
    defaultVisible: true,
  },
  {
    key: 'created_at',
    label: 'Created At',
    filterable: false,
    sortable: false,
    defaultVisible: false,  // hidden by default — available for future column toggle
  },
];

// ─── Filter label map ──────────────────────────────────────────────────────────
//
// Maps each filter key to the human-readable label shown in active filter pills
// and filter group headings.

export const FILTER_LABELS: Record<keyof Filters, string> = {
  team: 'Team',
  category: 'Category',
  year: 'Year',
  league: 'League',
  place: 'Place',
  attackType: 'Attack Type',
};

// ─── URL param ↔ filter key mapping ────────────────────────────────────────────
//
// URL uses snake_case params matching the DB column names.
// Internal state uses camelCase (attackType).

export const URL_PARAM_TO_FILTER_KEY: Record<string, keyof Filters> = {
  team: 'team',
  category: 'category',
  year: 'year',
  league: 'league',
  place: 'place',
  attack_type: 'attackType',
};

export const FILTER_KEY_TO_URL_PARAM: Record<keyof Filters, string> = {
  team: 'team',
  category: 'category',
  year: 'year',
  league: 'league',
  place: 'place',
  attackType: 'attack_type',
};
