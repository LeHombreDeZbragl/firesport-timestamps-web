import { Request, Response, NextFunction } from 'express';
import {
  SORTABLE_COLUMNS,
  AUTOCOMPLETE_COLUMNS,
  type ParsedFilters,
  type ParsedSort,
  type ParsedPagination,
  type AutocompleteColumn,
  type UpdatePayload,
  type InsertPayload,
  type BatchUpdateItem,
  type BatchSavePayload,
  type BatchValidationError,
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

// Range constants for the enhanced validation
const DATE_YEAR_MIN = 1990;
const PLACEMENT_MIN = 1;
const PLACEMENT_MAX = 999;
const LP_PP_MIN = 12.01;
const LP_PP_MAX = 99.99;

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
        if ((key === 'lp' || key === 'pp') && (value < LP_PP_MIN || value > LP_PP_MAX)) {
          return { valid: false, error: `Field "${key}" must be between ${LP_PP_MIN} and ${LP_PP_MAX}.` };
        }
        data[key] = value;
      } else {
        return { valid: false, error: `Field "${key}" must be a finite number or null.` };
      }
    } else if (EDITABLE_REQUIRED_NUMERIC_FIELDS.includes(key)) {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < PLACEMENT_MIN ||
        value > PLACEMENT_MAX ||
        !Number.isInteger(value)
      ) {
        return { valid: false, error: `Field "${key}" must be an integer between ${PLACEMENT_MIN} and ${PLACEMENT_MAX}.` };
      }
      data[key] = value;
    } else if (key === 'attack_date') {
      if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
        return {
          valid: false,
          error: 'Field "attack_date" must be a date string in YYYY-MM-DD format.',
        };
      }
      const year = parseInt(value.split('-')[0], 10);
      const currentYear = new Date().getFullYear();
      if (year < DATE_YEAR_MIN || year > currentYear) {
        return { valid: false, error: `Field "attack_date" year must be between ${DATE_YEAR_MIN} and ${currentYear}.` };
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

// ─── Batch save validation ─────────────────────────────────────────────────────

// Required string fields for an insert (all DB NOT NULL columns minus auto-set ones)
const REQUIRED_INSERT_STRING_FIELDS: ReadonlyArray<string> = [
  'attack_date', 'league', 'place', 'attack_type', 'category', 'team',
];

/**
 * Validates a single field value and pushes an error into the array if invalid.
 * Returns the parsed value on success, or undefined on failure.
 */
function validateBatchField(
  key: string,
  value: unknown,
  rowRef: string,
  errors: BatchValidationError[],
): unknown {
  const currentYear = new Date().getFullYear();

  if (EDITABLE_NULLABLE_NUMERIC_FIELDS.includes(key)) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push({ rowRef, field: key, message: 'Pole musí být číslo nebo prázdné.' });
      return undefined;
    }
    if ((key === 'lp' || key === 'pp') && (value < LP_PP_MIN || value > LP_PP_MAX)) {
      errors.push({ rowRef, field: key, message: `Hodnota musí být mezi ${LP_PP_MIN} a ${LP_PP_MAX}.` });
      return undefined;
    }
    return value;
  }

  if (key === 'placement') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value < PLACEMENT_MIN ||
      value > PLACEMENT_MAX
    ) {
      errors.push({ rowRef, field: key, message: `Umístění musí být celé číslo od ${PLACEMENT_MIN} do ${PLACEMENT_MAX}.` });
      return undefined;
    }
    return value;
  }

  if (key === 'attack_date') {
    if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
      errors.push({ rowRef, field: key, message: 'Zadejte datum ve formátu RRRR-MM-DD.' });
      return undefined;
    }
    const year = parseInt(value.split('-')[0], 10);
    if (year < DATE_YEAR_MIN || year > currentYear) {
      errors.push({ rowRef, field: key, message: `Rok musí být mezi ${DATE_YEAR_MIN} a ${currentYear}.` });
      return undefined;
    }
    return value;
  }

  // Remaining string fields (league, place, attack_type, category, team, link)
  if (typeof value !== 'string') {
    errors.push({ rowRef, field: key, message: 'Pole musí být text.' });
    return undefined;
  }
  if (key !== 'link' && value.trim() === '') {
    errors.push({ rowRef, field: key, message: 'Pole nesmí být prázdné.' });
    return undefined;
  }
  return value;
}

/**
 * Validates a single insert row for the batch endpoint.
 * Returns null if there are validation errors (errors are pushed into the array).
 */
function validateBatchInsert(
  body: unknown,
  rowRef: string,
  errors: BatchValidationError[],
): InsertPayload | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    errors.push({ rowRef, field: '_', message: 'Řádek musí být JSON objekt.' });
    return null;
  }

  const input = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const initialErrorCount = errors.length;

  // Required string fields (including attack_date)
  for (const key of REQUIRED_INSERT_STRING_FIELDS) {
    const raw = input[key] ?? '';
    const value = validateBatchField(key, raw, rowRef, errors);
    if (value !== undefined) data[key] = value;
  }

  // link (optional, can be empty string)
  if (input['link'] !== undefined && input['link'] !== null) {
    const value = validateBatchField('link', input['link'], rowRef, errors);
    if (value !== undefined) data['link'] = value;
  } else {
    data['link'] = '';
  }

  // placement (required)
  if (input['placement'] === undefined || input['placement'] === null) {
    errors.push({ rowRef, field: 'placement', message: 'Umístění je povinné.' });
  } else {
    const value = validateBatchField('placement', input['placement'], rowRef, errors);
    if (value !== undefined) data['placement'] = value;
  }

  // nullable numeric fields (optional)
  for (const key of EDITABLE_NULLABLE_NUMERIC_FIELDS) {
    if (input[key] !== undefined && input[key] !== null) {
      const value = validateBatchField(key, input[key], rowRef, errors);
      if (value !== undefined) data[key] = value;
    } else {
      data[key] = null;
    }
  }

  if (errors.length > initialErrorCount) return null;
  return data as InsertPayload;
}

/**
 * Validates a single update item for the batch endpoint.
 * Returns null if there are validation errors.
 */
function validateBatchUpdate(
  body: unknown,
  errors: BatchValidationError[],
): BatchUpdateItem | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    errors.push({ rowRef: 'update:?', field: '_', message: 'Položka musí být JSON objekt.' });
    return null;
  }

  const input = body as Record<string, unknown>;
  const rawId = input['id'];

  if (typeof rawId !== 'number' || !Number.isInteger(rawId) || rawId <= 0) {
    errors.push({ rowRef: 'update:?', field: 'id', message: 'Neplatné ID.' });
    return null;
  }

  const id = rawId;
  const rowRef = `update:${id}`;

  if (typeof input['fields'] !== 'object' || input['fields'] === null || Array.isArray(input['fields'])) {
    errors.push({ rowRef, field: '_', message: 'Pole "fields" musí být JSON objekt.' });
    return null;
  }

  const fields = input['fields'] as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const initialErrorCount = errors.length;

  for (const key of Object.keys(fields)) {
    if (FORBIDDEN_UPDATE_FIELDS.has(key)) {
      errors.push({ rowRef, field: key, message: `Pole "${key}" nelze upravit.` });
      continue;
    }
    if (!ALL_EDITABLE_FIELDS.has(key)) {
      errors.push({ rowRef, field: key, message: `Neznámé pole "${key}".` });
      continue;
    }
    const value = validateBatchField(key, fields[key], rowRef, errors);
    if (value !== undefined) data[key] = value;
  }

  if (errors.length > initialErrorCount) return null;
  return { id, fields: data as UpdatePayload };
}

/**
 * Parses and validates the request body for POST /api/timestamps/batch.
 * Performs structural and field-level validation for all updates, inserts,
 * and deletes. Returns either a valid parsed payload or a list of field errors.
 */
export function parseBatchBody(body: unknown):
  | { valid: true; data: BatchSavePayload; fieldErrors: BatchValidationError[] }
  | { valid: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const input = body as Record<string, unknown>;

  if (!Array.isArray(input['updates']) || !Array.isArray(input['inserts']) || !Array.isArray(input['deletes'])) {
    return { valid: false, error: 'Body must contain "updates", "inserts", and "deletes" arrays.' };
  }

  const fieldErrors: BatchValidationError[] = [];
  const updates: BatchUpdateItem[] = [];
  const inserts: InsertPayload[] = [];
  const deletes: number[] = [];

  // Validate delete ids
  for (let i = 0; i < (input['deletes'] as unknown[]).length; i++) {
    const rawId = (input['deletes'] as unknown[])[i];
    if (typeof rawId !== 'number' || !Number.isInteger(rawId) || rawId <= 0) {
      return { valid: false, error: `Invalid delete id at index ${i}: must be a positive integer.` };
    }
    deletes.push(rawId as number);
  }

  // Validate updates
  for (const item of input['updates'] as unknown[]) {
    const validated = validateBatchUpdate(item, fieldErrors);
    if (validated !== null) updates.push(validated);
  }

  // Validate inserts
  for (let i = 0; i < (input['inserts'] as unknown[]).length; i++) {
    const item = (input['inserts'] as unknown[])[i];
    const rowRef = `insert:${i}`;
    const validated = validateBatchInsert(item, rowRef, fieldErrors);
    if (validated !== null) inserts.push(validated);
  }

  return { valid: true, data: { updates, inserts, deletes }, fieldErrors };
}
