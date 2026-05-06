import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTimestamps } from '../services/api';
import type { Timestamp, Filters, SortConfig } from '../types/index';
import { PAGE_SIZE } from '../constants';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UseTimestampsResult {
  rows: Timestamp[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  retry: () => void;
  /** Resets to page 1 and re-fetches — use after mutations (e.g. delete). */
  reload: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches timestamp rows from the backend, supporting pagination, filtering
 * and sorting.
 *
 * Behaviour:
 * - Whenever `filters` or `sort` change, rows are cleared and a fresh first
 *   page is loaded (offset reset to 0).
 * - `loadMore()` increments the offset by PAGE_SIZE and appends the next page.
 * - Concurrent requests are cancelled via AbortController so only the latest
 *   fetch updates state.
 * - `retry()` re-triggers the current load after an error.
 *
 * Loading state is derived purely from `offset`:
 * - `offset === 0`  → isLoading  (first page / replace)
 * - `offset > 0`    → isLoadingMore (subsequent page / append)
 *
 * This avoids ref-based tracking, which caused incorrect loading states when
 * filter changes coincided with a non-zero offset.
 */
export function useTimestamps(filters: Filters, sort: SortConfig): UseTimestampsResult {
  const [rows, setRows] = useState<Timestamp[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Effect 1 — reset to page 1 whenever the query (filters or sort) changes.
  // Only calls setOffset(0) when offset is non-zero to avoid a no-op re-render.
  useEffect(() => {
    setRows([]);
    setError(null);
    setOffset((current) => (current === 0 ? 0 : 0));
    // setOffset is called unconditionally so the stable reference is kept;
    // when offset is already 0 React bails out of the re-render (same value).
  }, [filters, sort]);

  // Effect 2 — fetch whenever offset, filters, sort, or retryCount change.
  // Uses `offset === 0` to decide whether to replace or append rows.
  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isFirstPage = offset === 0;

    setError(null);
    if (isFirstPage) {
      setIsLoading(true);
      setIsLoadingMore(false);
    } else {
      setIsLoading(false);
      setIsLoadingMore(true);
    }

    fetchTimestamps(filters, sort, offset)
      .then((response) => {
        if (controller.signal.aborted) return;
        setTotalCount(response.totalCount);
        setHasMore(response.hasMore);
        if (isFirstPage) {
          setRows(response.data);
        } else {
          setRows((previous) => [...previous, ...response.data]);
        }
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error ? fetchError.message : 'An unexpected error occurred.';
        setError(message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
        setIsLoadingMore(false);
      });

    return () => {
      controller.abort();
    };
  }, [filters, sort, offset, retryCount]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore) {
      setOffset((previous) => previous + PAGE_SIZE);
    }
  }, [hasMore, isLoading, isLoadingMore]);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const reload = useCallback(() => {
    // Reset to page 1 and force a fresh fetch (used after deleting a row).
    setOffset(0);
    setRetryCount((count) => count + 1);
  }, []);

  return {
    rows,
    totalCount,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
    reload,
  };
}
