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
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches timestamp rows from the backend, supporting pagination, filtering
 * and sorting.
 *
 * Behaviour:
 * - Whenever `filters` or `sort` change, the accumulated rows are cleared and
 *   a fresh first page is loaded (offset = 0).
 * - `loadMore()` increments the offset by PAGE_SIZE and appends the next page.
 * - Concurrent requests are cancelled via AbortController so only the latest
 *   fetch updates state.
 * - `retry()` re-triggers the current page load after an error.
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

  // Track whether a filter/sort change reset the offset so we know if we're
  // loading page 1 (full replace) or a subsequent page (append).
  const isFirstPageRef = useRef(true);

  // Abort controller ref to cancel in-flight requests on filter change
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset to page 1 whenever filters or sort change
  useEffect(() => {
    isFirstPageRef.current = true;
    setOffset(0);
    setRows([]);
    setError(null);
    // retryCount intentionally not reset here — it's managed separately
  }, [filters, sort]);

  // Fetch whenever offset, filters, sort, or retryCount changes
  useEffect(() => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isFirstPage = isFirstPageRef.current;
    isFirstPageRef.current = false;

    if (isFirstPage) {
      setIsLoading(true);
      setIsLoadingMore(false);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

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
    // `offset` is intentionally in the dependency array — changing it loads the next page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, filters, sort, retryCount]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore) {
      isFirstPageRef.current = false;
      setOffset((previous) => previous + PAGE_SIZE);
    }
  }, [hasMore, isLoading, isLoadingMore]);

  const retry = useCallback(() => {
    setError(null);
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
  };
}
