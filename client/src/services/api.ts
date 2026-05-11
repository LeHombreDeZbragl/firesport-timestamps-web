import axios, { type AxiosResponse } from 'axios';
import { PAGE_SIZE, FILTER_KEY_TO_URL_PARAM } from '../constants';
import type {
  Filters,
  SortConfig,
  TimestampsApiResponse,
  Stats,
  DistinctValuesApiResponse,
  DistinctYearsApiResponse,
  Timestamp,
  EditableTimestampFields,
} from '../types/index';

// ─── Axios instance ─────────────────────────────────────────────────────────────
//
// In development, Vite's proxy forwards /api/* to http://localhost:3001.
// In production, Express serves both the static bundle and /api/* from the
// same origin, so the relative base URL works in both environments.

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// ─── Param serialisation helpers ───────────────────────────────────────────────

/**
 * Converts the Filters state object into URLSearchParams entries.
 * Empty arrays produce no param entries.
 * `attackType` is serialised as `attack_type` to match the server param name.
 * Year numbers are serialised as strings.
 */
function filtersToParams(filters: Filters): Record<string, string> {
  const params: Record<string, string> = {};

  for (const filterKey of Object.keys(filters) as Array<keyof Filters>) {
    const values = filters[filterKey];
    if (values.length === 0) continue;
    const urlParam = FILTER_KEY_TO_URL_PARAM[filterKey];
    params[urlParam] = values.join(',');
  }

  return params;
}

// ─── API functions ──────────────────────────────────────────────────────────────

/**
 * Fetches a page of timestamp rows with optional filtering, sorting and offset.
 */
export async function fetchTimestamps(
  filters: Filters,
  sort: SortConfig,
  offset: number
): Promise<TimestampsApiResponse> {
  const params: Record<string, string | number> = {
    ...filtersToParams(filters),
    sort: sort.column,
    order: sort.order,
    limit: PAGE_SIZE,
    offset,
  };

  const response: AxiosResponse<TimestampsApiResponse> = await apiClient.get('/timestamps', {
    params,
  });

  return response.data;
}

/**
 * Fetches aggregate statistics over the full filtered dataset (no pagination).
 */
export async function fetchStats(filters: Filters): Promise<Stats> {
  const params = filtersToParams(filters);

  const response: AxiosResponse<Stats> = await apiClient.get('/timestamps/stats', {
    params,
  });

  return response.data;
}

/**
 * Fetches distinct values for an autocomplete text filter column.
 * The optional `search` string is case-insensitively matched against values.
 */
export async function fetchDistinctValues(
  column: 'team' | 'category' | 'league' | 'place' | 'attack_type',
  search?: string
): Promise<string[]> {
  const params: Record<string, string> = {};
  if (search && search.trim().length > 0) {
    params['search'] = search.trim();
  }

  const response: AxiosResponse<DistinctValuesApiResponse> = await apiClient.get(
    `/timestamps/distinct/${column}`,
    { params }
  );

  return response.data.values;
}

/**
 * Fetches all distinct years present in the attack_date column.
 * Backed by the Supabase RPC `get_distinct_attack_years`.
 */
export async function fetchDistinctYears(): Promise<number[]> {
  const response: AxiosResponse<DistinctYearsApiResponse> = await apiClient.get(
    '/timestamps/distinct/years'
  );

  return response.data.years;
}

/**
 * Deletes a single timestamp row by id.
 * Intended for debugging/admin use only.
 */
export async function deleteTimestamp(id: number): Promise<void> {
  await apiClient.delete(`/timestamps/${id}`);
}

/**
 * Updates editable fields of a single timestamp row.
 * Returns the full updated row, including the DB-recomputed `final_time`.
 */
export async function patchTimestamp(
  id: number,
  fields: EditableTimestampFields,
): Promise<Timestamp> {
  const response: AxiosResponse<Timestamp> = await apiClient.patch(`/timestamps/${id}`, fields);
  return response.data;
}
