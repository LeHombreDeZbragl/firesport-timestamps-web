import { faClock, faPeopleLine, faRankingStar } from '@fortawesome/free-solid-svg-icons';
import type { ColumnDefinition, Filters, SortConfig } from './types/index';

// ─── Pagination ────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 50;

// ─── Default state ─────────────────────────────────────────────────────────────

export const DEFAULT_SORT: SortConfig = {
  column: 'final_time',
  order: 'asc',
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

// Column order for the visible table:
// tým → lp → pp → výsledný čas → typ → kategorie → liga → umístění → datum → místo
// Hidden columns follow at the end.
export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  // ── Visible columns (in display order) ────────────────────────────────────
  {
    key: 'team',
    label: 'Tým',
    filterable: true,
    filterKey: 'team',
    sortable: true,
    sortColumn: 'team',
    defaultVisible: true,
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
    key: 'final_time',
    label: 'Výsledný čas',
    filterable: false,
    sortable: true,
    sortColumn: 'final_time',
    defaultVisible: true,
    icon: faClock,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'attack_type',
    label: 'Typ',
    filterable: true,
    filterKey: 'attackType',
    sortable: true,
    sortColumn: 'attack_type',
    defaultVisible: true,
  },
  {
    key: 'category',
    label: 'Kategorie',
    filterable: true,
    filterKey: 'category',
    sortable: true,
    sortColumn: 'category',
    defaultVisible: true,
    icon: faPeopleLine,
  },
  {
    key: 'league',
    label: 'Liga',
    filterable: true,
    filterKey: 'league',
    sortable: true,
    sortColumn: 'league',
    defaultVisible: true,
  },
  {
    key: 'placement',
    label: 'Umístění',
    filterable: false,
    sortable: true,
    sortColumn: 'placement',
    defaultVisible: true,
    icon: faRankingStar,
  },
  {
    key: 'attack_date',
    label: 'Datum',
    filterable: false,
    sortable: true,
    sortColumn: 'attack_date',
    defaultVisible: true,
    format: (value) => {
      if (typeof value !== 'string') return '-';
      const [y, m, d] = value.split('-');
      if (!y || !m || !d) return value;
      return `${+d}.${+m}.${y}`;
    },
  },
  {
    key: 'place',
    label: 'Místo',
    filterable: true,
    filterKey: 'place',
    sortable: true,
    sortColumn: 'place',
    defaultVisible: true,
  },
  // ── Hidden columns ─────────────────────────────────────────────────────────
  {
    key: 'id',
    label: 'ID',
    filterable: false,
    sortable: true,
    sortColumn: 'id',
    defaultVisible: false,
  },
  {
    key: 'kos',
    label: 'Koš',
    filterable: false,
    sortable: true,
    sortColumn: 'kos',
    defaultVisible: false,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'naber',
    label: 'Náběr',
    filterable: false,
    sortable: true,
    sortColumn: 'naber',
    defaultVisible: false,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'kohout',
    label: 'Kohout',
    filterable: false,
    sortable: true,
    sortColumn: 'kohout',
    defaultVisible: false,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'rozdelovac',
    label: 'Rozdělovač',
    filterable: false,
    sortable: true,
    sortColumn: 'rozdelovac',
    defaultVisible: false,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'lp_vystrik',
    label: 'LP Výstřik',
    filterable: false,
    sortable: true,
    sortColumn: 'lp_vystrik',
    defaultVisible: false,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'pp_vystrik',
    label: 'PP Výstřik',
    filterable: false,
    sortable: true,
    sortColumn: 'pp_vystrik',
    defaultVisible: false,
    format: (value) => (value !== null && value !== undefined ? String(value) : '-'),
  },
  {
    key: 'link',
    label: 'Link',
    filterable: false,
    sortable: false,
    defaultVisible: false,
  },
  {
    key: 'created_at',
    label: 'Created At',
    filterable: false,
    sortable: false,
    defaultVisible: false,
  },
];

// ─── Filter label map ──────────────────────────────────────────────────────────
//
// Maps each filter key to the human-readable label shown in active filter pills
// and filter group headings.

export const FILTER_LABELS: Record<keyof Filters, string> = {
  team: 'Tým',
  category: 'Kategorie',
  year: 'Rok',
  league: 'Liga',
  place: 'Místo',
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
