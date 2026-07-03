/**
 * Test helpers for faking the Supabase client without a live database.
 *
 * The real client (services/supabaseClient) is replaced per test file with
 * `vi.mock('../src/services/supabaseClient')`; these helpers build the return
 * values that mock hands back.
 */

export interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

/**
 * Builds a chainable PostgREST-style query-builder stub. Every filter/sort/
 * range/write method returns the same object, and the object is *thenable* —
 * awaiting it (or returning it from an async fn, as buildTimestampsQuery does)
 * resolves to `result`. This mirrors how @supabase/supabase-js query builders
 * behave without pulling in the real library.
 */
export function createChain(result: QueryResult): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'order', 'range', 'in', 'or', 'is', 'gte', 'lte',
    'ilike', 'limit', 'eq', 'update', 'insert', 'delete', 'single',
  ];
  for (const method of methods) {
    chain[method] = () => chain;
  }
  chain['then'] = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return chain;
}
