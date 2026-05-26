import { useState, useEffect, useRef } from 'react';
import { fetchGraphStats } from '../services/api';
import { useDebounce } from './useDebounce';
import type { Filters, GraphStats } from '../types/index';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UseGraphStatsResult {
  graphStats: GraphStats | null;
  isLoading: boolean;
  error: string | null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches chart data (distribution + progression) for the current filter state.
 *
 * Requests are debounced (400 ms) and cancelled on filter change via AbortController.
 */
export function useGraphStats(filters: Filters): UseGraphStatsResult {
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedFilters = useDebounce(filters, 400);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetchGraphStats(debouncedFilters)
      .then((response) => {
        if (controller.signal.aborted) return;
        setGraphStats(response);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error ? fetchError.message : 'Failed to load chart data.';
        setError(message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedFilters]);

  return { graphStats, isLoading, error };
}
