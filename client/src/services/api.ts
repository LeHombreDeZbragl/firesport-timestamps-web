import axios, { type AxiosResponse } from 'axios';
import { PAGE_SIZE, FILTER_KEY_TO_URL_PARAM } from '../constants';
import type {
  Filters,
  SortConfig,
  TimestampsApiResponse,
  Stats,
  GraphStats,
  DistinctValuesApiResponse,
  DistinctYearsApiResponse,
  LeaguePairsApiResponse,
  Timestamp,
  EditableTimestampFields,
  BatchSavePayload,
  BatchSaveOutcome,
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

// ─── Token helpers ──────────────────────────────────────────────────────────────

const TOKEN_KEY = 'admin_token';

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  delete apiClient.defaults.headers.common['Authorization'];
}

export function isAdminAuthenticated(): boolean {
  return getAdminToken() !== null;
}

// Restore token from sessionStorage on module load (e.g. page refresh within the same tab).
const _storedToken = getAdminToken();
if (_storedToken) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${_storedToken}`;
}

// ─── 401 interceptor ────────────────────────────────────────────────────────────
//
// When the server returns 401 (expired or invalid JWT) clear the stored token
// and dispatch a custom event so the app can show the login modal.

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAdminToken();
      window.dispatchEvent(new CustomEvent('admin-auth-required'));
    }
    return Promise.reject(error);
  },
);

/**
 * Returns whether the server has admin login enabled (i.e. ADMIN_SECRET is set).
 * The client uses this to decide whether to show the "Admin login" button.
 */
export async function fetchAuthStatus(): Promise<boolean> {
  const response: AxiosResponse<{ adminEnabled: boolean }> = await axios.get('/api/auth/status');
  return response.data.adminEnabled;
}

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
 * Fetches all distinct (league short code, full league name) pairs.
 * Backed by the Supabase RPC `get_distinct_league_pairs`.
 */
export async function fetchLeaguePairs(): Promise<LeaguePairsApiResponse['pairs']> {
  const response: AxiosResponse<LeaguePairsApiResponse> = await apiClient.get(
    '/timestamps/distinct/league-pairs'
  );

  return response.data.pairs;
}

/**
 * Fetches chart data: time-bucket distribution + 20-point progression series.
 */
export async function fetchGraphStats(filters: Filters): Promise<GraphStats> {
  const params = filtersToParams(filters);

  const response: AxiosResponse<GraphStats> = await apiClient.get('/timestamps/graph-stats', {
    params,
  });

  return response.data;
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

/**
 * Atomically saves a batch of changes: updates to existing rows, new inserts,
 * and staged deletes. Returns a BatchSaveOutcome indicating success or
 * per-field validation errors from the server.
 */
export async function batchSave(payload: BatchSavePayload): Promise<BatchSaveOutcome> {
  try {
    await apiClient.post('/timestamps/batch', payload);
    return { success: true };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 400) {
      const data = err.response.data as { errors?: { rowRef: string; field: string; message: string }[]; error?: string };
      if (Array.isArray(data.errors)) {
        return { success: false, errors: data.errors };
      }
    }
    throw err;
  }
}

/**
 * Sends the admin password to the server and, on success, stores the returned
 * JWT in sessionStorage via setAdminToken().
 * Throws with a user-facing message on failure.
 */
export async function login(password: string): Promise<void> {
  const response: AxiosResponse<{ token: string }> = await axios.post('/api/auth/login', {
    password,
  });
  setAdminToken(response.data.token);
}
