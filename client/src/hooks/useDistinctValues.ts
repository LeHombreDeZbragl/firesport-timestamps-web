import { useState, useEffect, useRef } from 'react';
import { fetchDistinctValues, fetchDistinctYears } from '../services/api';
import { useDebounce } from './useDebounce';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UseDistinctValuesResult {
  values: string[];
  isLoading: boolean;
  error: string | null;
}

export interface UseDistinctYearsResult {
  years: number[];
  isLoading: boolean;
  error: string | null;
}

type AutocompleteColumn = 'team' | 'category' | 'league' | 'place' | 'attack_type';

// ─── Text column hook ──────────────────────────────────────────────────────────

/**
 * Fetches distinct values for a text autocomplete column.
 *
 * The `searchTerm` is debounced (300ms) before triggering a fetch, so the
 * request fires only after the user pauses typing.
 *
 * Concurrent requests are cancelled via AbortController.
 *
 * @param column - The database column to fetch distinct values for.
 * @param searchTerm - The current input text used as a partial match filter.
 */
export function useDistinctValues(
  column: AutocompleteColumn,
  searchTerm: string
): UseDistinctValuesResult {
  const [values, setValues] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetchDistinctValues(column, debouncedSearch)
      .then((fetchedValues) => {
        if (controller.signal.aborted) return;
        setValues(fetchedValues);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : `Failed to load suggestions for "${column}".`;
        setError(message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [column, debouncedSearch]);

  return { values, isLoading, error };
}

// ─── Years hook ────────────────────────────────────────────────────────────────

/**
 * Fetches the list of distinct years present in the `attack_date` column.
 * Fetches only once on mount (years change infrequently).
 */
export function useDistinctYears(): UseDistinctYearsResult {
  const [years, setYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    fetchDistinctYears()
      .then((fetchedYears) => {
        setYears(fetchedYears);
      })
      .catch((fetchError: unknown) => {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Failed to load years.';
        setError(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []); // Empty array — fetch once on mount

  return { years, isLoading, error };
}
