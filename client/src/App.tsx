import { useCallback } from 'react';
import { useUrlState } from './hooks/useUrlState';
import { useTimestamps } from './hooks/useTimestamps';
import { useStats } from './hooks/useStats';
import { FilterBar } from './components/filters/FilterBar';
import { StatsPanel } from './components/stats/StatsPanel';
import { DataTable } from './components/table/DataTable';
import { DEFAULT_SORT } from './constants';
import type { FilterKey, SortConfig } from './types';

function App(): React.JSX.Element {
  const {
    filters,
    sort,
    setSort,
    addFilterValue,
    removeFilterValue,
    clearAllFilters,
  } = useUrlState();

  const {
    rows,
    totalCount,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
  } = useTimestamps(filters, sort);

  const { stats, isLoading: statsLoading } = useStats(filters);

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

  return (
    <div className="min-h-screen flex flex-col bg-surface-950 text-surface-100">
      {/* ── Header ── */}
      <header className="bg-surface-900 border-b border-surface-700 px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Firesport Timestamps
        </h1>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Filters */}
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-5">
          <FilterBar
            filters={filters}
            onAddFilter={handleAddFilter}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={clearAllFilters}
          />
        </div>

        {/* Stats */}
        <StatsPanel stats={stats} isLoading={statsLoading} />

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
        />
      </main>
    </div>
  );
}

export default App;
