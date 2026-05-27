import { useCallback, useState } from 'react';
import { useUrlState } from './hooks/useUrlState';
import { useTimestamps } from './hooks/useTimestamps';
import { useStats } from './hooks/useStats';
import { useGraphStats } from './hooks/useGraphStats';
import { useDistinctValues } from './hooks/useDistinctValues';
import { FilterBar } from './components/filters/FilterBar';
import { StatsPanel } from './components/stats/StatsPanel';
import { DataTable } from './components/table/DataTable';
import { DEFAULT_SORT, EMPTY_FILTERS } from './constants';
import { batchSave } from './services/api';
import type { FilterKey, SortConfig, BatchSavePayload, BatchSaveOutcome, Filters } from './types';

function App(): React.JSX.Element {
  const isAdmin = !!import.meta.env.VITE_ADMIN_SECRET;

  const {
    filters,
    sort,
    setSort,
    addFilterValue,
    removeFilterValue,
    clearAllFilters,
  } = useUrlState();

  // `appliedFilters` is what actually drives API calls.
  // It only updates when the user clicks "Vyhledat" or clears all filters.
  // Initialise from URL so that shared/bookmarked links load data immediately.
  const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);

  // True when the pending UI filters differ from what was last applied.
  const filtersChanged = JSON.stringify(filters) !== JSON.stringify(appliedFilters);

  const {
    rows,
    totalCount,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
    reload,
  } = useTimestamps(appliedFilters, sort);

  const { stats, isLoading: statsLoading } = useStats(appliedFilters);
  const { graphStats, isLoading: graphStatsLoading } = useGraphStats(appliedFilters);

  // Distinct values for edit-mode validation (league, type, category)
  const { values: validLeagues } = useDistinctValues('league', '');
  const { values: validTypes } = useDistinctValues('attack_type', '');
  const { values: validCategories } = useDistinctValues('category', '');

  const handleSortChange = useCallback(
    (newSort: SortConfig | null) => {
      setSort(newSort ?? DEFAULT_SORT);
    },
    [setSort],
  );

  const toFilterValue = (filterKey: FilterKey, value: string): string | number =>
    filterKey === 'year' ? Number(value) : value;

  const handleAddFilter = useCallback(
    (filterKey: FilterKey, value: string) => {
      addFilterValue(filterKey, toFilterValue(filterKey, value));
    },
    [addFilterValue],
  );

  const handleRemoveFilter = useCallback(
    (filterKey: FilterKey, value: string) => {
      removeFilterValue(filterKey, toFilterValue(filterKey, value));
    },
    [removeFilterValue],
  );

  // Apply pending filters to the API — bail out if nothing changed.
  const handleSearch = useCallback(() => {
    setAppliedFilters((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(filters)) return prev;
      return filters;
    });
  }, [filters]);

  // Clear all pending + applied filters, but only if there is something to clear.
  const handleClearAll = useCallback(() => {
    const hasPending = Object.values(filters).some((arr) => arr.length > 0);
    const hasApplied = Object.values(appliedFilters).some((arr) => arr.length > 0);
    if (!hasPending && !hasApplied) return;
    clearAllFilters();
    setAppliedFilters(EMPTY_FILTERS);
  }, [filters, appliedFilters, clearAllFilters]);

  const handleBatchSave = useCallback(
    async (payload: BatchSavePayload): Promise<BatchSaveOutcome> => {
      try {
        const outcome = await batchSave(payload);
        if (outcome.success) {
          reload();
        }
        return outcome;
      } catch (err: unknown) {
        console.error('[handleBatchSave] Failed to save batch:', err);
        return { success: false, errors: [] };
      }
    },
    [reload],
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface-950 text-surface-100">
      {/* ── Header ── */}
      <header className="bg-surface-900 border-b border-surface-700 px-6 py-4 shrink-0">
        <a
          href="https://firesport-timestamps-web.fly.dev/"
          className="inline-block text-xl font-bold tracking-tight text-white hover:text-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
        >
          Firesport Timestamps
        </a>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Filters */}
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-5">
          <FilterBar
            filters={filters}
            onAddFilter={handleAddFilter}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAll}
            onSearch={handleSearch}
            filtersChanged={filtersChanged}
          />
        </div>

        {/* Stats */}
        <StatsPanel stats={stats} isLoading={statsLoading} graphStats={graphStats} graphStatsLoading={graphStatsLoading} />

        {/* Data table */}
        <DataTable
          rows={rows}
          totalCount={totalCount}
          hasMore={hasMore}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          error={error}
          sort={sort}
          onSortChange={handleSortChange}
          onAddFilter={handleAddFilter}
          onLoadMore={loadMore}
          onRetry={retry}
          onSave={handleBatchSave}
          isAdmin={isAdmin}
          validLeagues={validLeagues}
          validTypes={validTypes}
          validCategories={validCategories}
        />
      </main>

      {/* ── Footer ── */}
      <footer className="shrink-0 border-t border-surface-800 bg-surface-900 px-6 py-4 text-center text-xs text-surface-500">
        © Tomáš Buchta &mdash; Data z{' '}
        <a
          href="https://firesport.eu"
          target="_blank"
          rel="noopener noreferrer"
          className="text-surface-400 underline underline-offset-2 hover:text-surface-200 transition-colors"
        >
          firesport.eu
        </a>
      </footer>
    </div>
  );
}

export default App;
