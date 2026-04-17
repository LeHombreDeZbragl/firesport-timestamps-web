import { useState, useEffect, useRef } from 'react';
import { fetchStats } from '../services/api';
import { useDebounce } from './useDebounce';
import type { Filters, Stats } from '../types/index';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UseStatsResult {
  stats: Stats | null;
  isLoading: boolean;
  error: string | null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches aggregate statistics for the current filter state.
 *
 * Stats are recomputed over the FULL filtered dataset on every filter change.
 * Requests are debounced (400ms) so that rapidly typing in an autocomplete
 * field does not fire a stats request on every keystroke.
 *
 * Concurrent requests are cancelled via AbortController.
 */
export function useStats(filters: Filters): UseStatsResult {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce filters so stats don't fire on every filter keystroke
  const debouncedFilters = useDebounce(filters, 400);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetchStats(debouncedFilters)
      .then((response) => {
        if (controller.signal.aborted) return;
        setStats(response);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error ? fetchError.message : 'Failed to load statistics.';
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

  return { stats, isLoading, error };
}
