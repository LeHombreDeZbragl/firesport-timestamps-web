import { Request, Response, NextFunction } from 'express';
import {
  SORTABLE_COLUMNS,
  AUTOCOMPLETE_COLUMNS,
  type ParsedFilters,
  type ParsedSort,
  type ParsedPagination,
  type AutocompleteColumn,
  type UpdatePayload,
} from '../types/index';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 50;
const DEFAULT_SORT_COLUMN = 'attack_date' as const;
const DEFAULT_SORT_ORDER = 'desc' as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits a comma-separated query string value into a trimmed, non-empty array.
 * e.g. "Jistebník, Bělá, " → ["Jistebník", "Bělá"]
 */
function parseCommaSeparated(value: unknown): string[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parses a query param as a non-negative integer with a fallback default.
 * Returns the default if the value is missing, non-numeric, or negative.
 */
function parseNonNegativeInt(value: unknown, defaultValue: number): number {
  if (typeof value !== 'string') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}

// ─── Exported parsers ──────────────────────────────────────────────────────────

/**
 * Parses and validates filter-related query parameters from the request.
 * Unknown/extra params are silently ignored.
 */
export function parseFilters(query: Request['query']): ParsedFilters {
  const yearStrings = parseCommaSeparated(query['year']);
  const year = yearStrings
    .map((yearString) => parseInt(yearString, 10))
    .filter((yearNumber) => Number.isFinite(yearNumber) && yearNumber > 1900 && yearNumber < 2100);

  return {
    team: parseCommaSeparated(query['team']),
    category: parseCommaSeparated(query['category']),
    year,
    league: parseCommaSeparated(query['league']),
    place: parseCommaSeparated(query['place']),
    attackType: parseCommaSeparated(query['attack_type']),
  };
}

/**
 * Parses and validates sort-related query parameters.
 * Falls back to default (attack_date desc) for invalid or missing values.
 */
export function parseSort(query: Request['query']): ParsedSort {
  const sortParam = typeof query['sort'] === 'string' ? query['sort'] : DEFAULT_SORT_COLUMN;
  const orderParam = typeof query['order'] === 'string' ? query['order'] : DEFAULT_SORT_ORDER;

  const column = (SORTABLE_COLUMNS as readonly string[]).includes(sortParam)
    ? (sortParam as ParsedSort['column'])
    : DEFAULT_SORT_COLUMN;

  const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : DEFAULT_SORT_ORDER;

  return { column, order };
}

/**
 * Parses and validates pagination query parameters.
 * Clamps limit to [1, PAGE_SIZE_MAX].
 */
export function parsePagination(query: Request['query']): ParsedPagination {
  const offset = parseNonNegativeInt(query['offset'], 0);
  const rawLimit = parseNonNegativeInt(query['limit'], PAGE_SIZE_DEFAULT);
  const limit = Math.min(Math.max(rawLimit, 1), PAGE_SIZE_MAX);
  return { limit, offset };
}

// ─── Route-level middleware ────────────────────────────────────────────────────

/**
 * Express middleware that validates the `:column` route param for the
 * distinct values endpoint. Responds with 400 if the column is not in the
 * autocomplete whitelist.
 */
export function validateAutocompleteColumn(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const column = req.params['column'];
  if (!(AUTOCOMPLETE_COLUMNS as readonly string[]).includes(column)) {
    res.status(400).json({
      error: `Invalid column "${column}". Allowed values: ${AUTOCOMPLETE_COLUMNS.join(', ')}.`,
    });
    return;
  }
  next();
}

/**
 * Parses the optional `search` query param for autocomplete filtering.
 * Returns an empty string if not provided or blank.
 */
export function parseSearchTerm(query: Request['query']): string {
  const search = query['search'];
  if (typeof search !== 'string') {
    return '';
  }
  return search.trim().slice(0, 100); // cap length to avoid excessively long ILIKE patterns
}

/**
 * Asserts that a column value from a route param is a valid AutocompleteColumn.
 * This is a type-narrowing helper for use inside route handlers after the
 * `validateAutocompleteColumn` middleware has already verified the value.
 */
export function asAutocompleteColumn(value: string): AutocompleteColumn {
  return value as AutocompleteColumn;
}

/**
 * Parses a route param as a positive integer (row id).
 * Returns null if the value is missing, non-numeric, or not a positive integer.
 */
export function parseId(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== value) return null;
  return parsed;
}

// ─── Update body validation ────────────────────────────────────────────────────

const EDITABLE_STRING_FIELDS: ReadonlyArray<string> = [
  'attack_date', 'league', 'place', 'link', 'attack_type', 'category', 'team',
];

const EDITABLE_NULLABLE_NUMERIC_FIELDS: ReadonlyArray<string> = [
  'kos', 'naber', 'kohout', 'rozdelovac', 'lp_vystrik', 'pp_vystrik', 'lp', 'pp',
];

const EDITABLE_REQUIRED_NUMERIC_FIELDS: ReadonlyArray<string> = ['placement'];

const ALL_EDITABLE_FIELDS = new Set<string>([
  ...EDITABLE_STRING_FIELDS,
  ...EDITABLE_NULLABLE_NUMERIC_FIELDS,
  ...EDITABLE_REQUIRED_NUMERIC_FIELDS,
]);

const FORBIDDEN_UPDATE_FIELDS = new Set<string>(['id', 'created_at', 'final_time']);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses and validates the request body for PATCH /api/timestamps/:id.
 * Rejects forbidden fields (id, created_at, final_time), unknown fields,
 * and type-invalid values.
 */
export function parseUpdateBody(
  body: unknown,
): { valid: true; data: UpdatePayload } | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const input = body as Record<string, unknown>;
  const inputKeys = Object.keys(input);

  if (inputKeys.length === 0) {
    return { valid: false, error: 'No fields provided to update.' };
  }

  for (const key of inputKeys) {
    if (FORBIDDEN_UPDATE_FIELDS.has(key)) {
      return { valid: false, error: `Field "${key}" cannot be updated.` };
    }
  }

  const unknownKeys = inputKeys.filter((k) => !ALL_EDITABLE_FIELDS.has(k));
  if (unknownKeys.length > 0) {
    return { valid: false, error: `Unknown field(s): ${unknownKeys.join(', ')}.` };
  }

  const data: Record<string, unknown> = {};

  for (const key of inputKeys) {
    const value = input[key];

    if (EDITABLE_NULLABLE_NUMERIC_FIELDS.includes(key)) {
      if (value === null) {
        data[key] = null;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        data[key] = value;
      } else {
        return { valid: false, error: `Field "${key}" must be a finite number or null.` };
      }
    } else if (EDITABLE_REQUIRED_NUMERIC_FIELDS.includes(key)) {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 1 ||
        !Number.isInteger(value)
      ) {
        return { valid: false, error: `Field "${key}" must be a positive integer.` };
      }
      data[key] = value;
    } else if (key === 'attack_date') {
      if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
        return {
          valid: false,
          error: 'Field "attack_date" must be a date string in YYYY-MM-DD format.',
        };
      }
      data[key] = value;
    } else {
      // Remaining string fields
      if (typeof value !== 'string') {
        return { valid: false, error: `Field "${key}" must be a string.` };
      }
      if (key !== 'link' && value.trim() === '') {
        return { valid: false, error: `Field "${key}" cannot be empty.` };
      }
      data[key] = value;
    }
  }

  return { valid: true, data: data as UpdatePayload };
}
