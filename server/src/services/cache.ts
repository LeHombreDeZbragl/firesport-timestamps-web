/**
 * Tiny in-memory TTL cache for read-heavy, filter-independent responses.
 *
 * The dashboard's most expensive queries (the unfiltered stats / graph-stats
 * aggregates over the whole table, and the distinct-value lookups) are also the
 * most repeated — every fresh landing-page load hits the same default view. A
 * short TTL collapses a burst of identical requests into one DB round-trip.
 *
 * Scope/limitations (accepted at current scale, mirrors the rate limiter):
 *   - Process-local: each Fly machine has its own cache; not shared across
 *     machines and reset on deploy/restart. Fine for a short TTL.
 *   - Admin writes call `clearCache()` so edits are reflected immediately rather
 *     than waiting out the TTL.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Returns the cached value for `key` if present and not expired, else undefined. */
export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/** Stores `value` under `key` for `ttlMs` milliseconds. */
export function setCached(key: string, value: unknown, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Drops every cached entry. Called after any admin write so reads are fresh. */
export function clearCache(): void {
  store.clear();
}
