import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  FILTER_KEY_TO_URL_PARAM,
  URL_PARAM_TO_FILTER_KEY,
} from '../constants';
import type { Filters, SortConfig, SortableColumn, SortOrder } from '../types/index';

// ─── URL parsing helpers ───────────────────────────────────────────────────────

function parseFiltersFromParams(searchParams: URLSearchParams): Filters {
  const filters: Filters = { ...EMPTY_FILTERS };

  for (const [urlParam, filterKey] of Object.entries(URL_PARAM_TO_FILTER_KEY)) {
    const raw = searchParams.get(urlParam);
    if (!raw || raw.trim() === '') continue;

    const values = raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (filterKey === 'year') {
      filters.year = values
        .map((yearString) => parseInt(yearString, 10))
        .filter((year) => Number.isFinite(year) && year > 1900 && year < 2100);
    } else {
      (filters[filterKey] as string[]) = values;
    }
  }

  return filters;
}

function parseSortFromParams(searchParams: URLSearchParams): SortConfig {
  const sortParam = searchParams.get('sort');
  const orderParam = searchParams.get('order');

  const column: SortableColumn =
    sortParam !== null
      ? (sortParam as SortableColumn)
      : DEFAULT_SORT.column;

  const order: SortOrder =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : DEFAULT_SORT.order;

  return { column, order };
}

// ─── URL serialisation helpers ─────────────────────────────────────────────────

function filtersToSearchParams(
  filters: Filters,
  sort: SortConfig,
  existing: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(existing);

  // Remove all filter params first, then re-add active ones
  for (const urlParam of Object.keys(URL_PARAM_TO_FILTER_KEY)) {
    next.delete(urlParam);
  }

  for (const filterKey of Object.keys(filters) as Array<keyof Filters>) {
    const values = filters[filterKey];
    if (values.length === 0) continue;
    const urlParam = FILTER_KEY_TO_URL_PARAM[filterKey];
    next.set(urlParam, values.join(','));
  }

  // Persist sort only when it differs from the default
  if (sort.column === DEFAULT_SORT.column && sort.order === DEFAULT_SORT.order) {
    next.delete('sort');
    next.delete('order');
  } else {
    next.set('sort', sort.column);
    next.set('order', sort.order);
  }

  return next;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface UrlState {
  filters: Filters;
  sort: SortConfig;
  setFilters: (updater: Filters | ((previous: Filters) => Filters)) => void;
  setSort: (sort: SortConfig) => void;
  addFilterValue: (filterKey: keyof Filters, value: string | number) => void;
  removeFilterValue: (filterKey: keyof Filters, value: string | number) => void;
  clearAllFilters: () => void;
}

/**
 * Manages filter + sort state, keeping it synchronised with the URL search
 * params so that the page state is preserved on refresh and shareable via link.
 *
 * URL format:
 *   ?team=Jistebník,Bělá&year=2025&sort=attack_date&order=desc
 *
 * Uses `replaceState` (setSearchParams with `replace: true`) to avoid polluting
 * browser history on every filter interaction.
 */
export function useUrlState(): UrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialise from URL on first render only
  const [filters, setFiltersState] = useState<Filters>(() =>
    parseFiltersFromParams(searchParams)
  );
  const [sort, setSortState] = useState<SortConfig>(() =>
    parseSortFromParams(searchParams)
  );

  // Keep a ref of the current searchParams so the effect below can read
  // the latest value without re-registering as a dependency.
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  });

  // Sync state → URL whenever filters or sort change
  useEffect(() => {
    const next = filtersToSearchParams(filters, sort, searchParamsRef.current);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort]);

  const setFilters = useCallback(
    (updater: Filters | ((previous: Filters) => Filters)) => {
      setFiltersState(updater);
    },
    []
  );

  const setSort = useCallback((newSort: SortConfig) => {
    setSortState(newSort);
  }, []);

  const addFilterValue = useCallback(
    (filterKey: keyof Filters, value: string | number) => {
      setFiltersState((previous) => {
        const current = previous[filterKey] as Array<string | number>;
        if (current.includes(value)) return previous;
        return {
          ...previous,
          [filterKey]: [...current, value],
        };
      });
    },
    []
  );

  const removeFilterValue = useCallback(
    (filterKey: keyof Filters, value: string | number) => {
      setFiltersState((previous) => ({
        ...previous,
        [filterKey]: (previous[filterKey] as Array<string | number>).filter(
          (existing) => existing !== value
        ),
      }));
    },
    []
  );

  const clearAllFilters = useCallback(() => {
    setFiltersState({ ...EMPTY_FILTERS });
  }, []);

  return {
    filters,
    sort,
    setFilters,
    setSort,
    addFilterValue,
    removeFilterValue,
    clearAllFilters,
  };
}
