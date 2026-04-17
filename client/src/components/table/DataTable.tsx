import { COLUMN_DEFINITIONS } from '../../constants';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { EmptyState } from '../common/EmptyState';
import { SortableHeader } from './SortableHeader';
import { ClickableCell } from './ClickableCell';
import type { Timestamp, SortConfig, FilterKey } from '../../types';

const VISIBLE_COLUMNS = COLUMN_DEFINITIONS.filter((col) => col.defaultVisible);

const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => i);

interface DataTableProps {
  rows: Timestamp[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  sort: SortConfig;
  onSortChange: (sort: SortConfig | null) => void;
  onAddFilter: (filterKey: FilterKey, value: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function DataTable({
  rows,
  totalCount,
  hasMore,
  isLoading,
  isLoadingMore,
  error,
  sort,
  onSortChange,
  onAddFilter,
  onLoadMore,
  onRetry,
}: DataTableProps): React.JSX.Element {
  // Full-page loading state (first fetch)
  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-surface-700">
        <table className="min-w-full table-auto text-left text-sm">
          <thead className="sticky top-0 z-10 bg-surface-900">
            <tr>
              {VISIBLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-surface-400"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SKELETON_ROWS.map((i) => (
              <tr key={i} className="border-t border-surface-700">
                {VISIBLE_COLUMNS.map((col) => (
                  <td key={col.key} className="px-3 py-2">
                    <div className="h-4 animate-pulse rounded bg-surface-700" style={{ width: `${60 + ((i * col.key.length) % 30)}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  const remaining = totalCount - rows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-surface-700">
        <table className="min-w-full table-auto text-left text-sm">
          <thead className="sticky top-0 z-10 bg-surface-900 shadow-sm">
            <tr>
              {VISIBLE_COLUMNS.map((col) => {
                if (col.sortable && col.sortColumn) {
                  return (
                    <SortableHeader
                      key={col.key}
                      columnKey={col.sortColumn}
                      label={col.label}
                      currentSort={sort}
                      onSortChange={onSortChange}
                    />
                  );
                }
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-surface-400"
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={`border-t border-surface-700/60 transition-colors hover:bg-surface-800/60 ${rowIndex % 2 === 0 ? '' : 'bg-surface-800/20'}`}
              >
                {VISIBLE_COLUMNS.map((col) => (
                  <ClickableCell
                    key={col.key}
                    columnDef={col}
                    value={row[col.key]}
                    onAddFilter={onAddFilter}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="
              inline-flex items-center gap-2 rounded-md bg-primary-700 px-5 py-2 text-sm font-medium text-white
              hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors
            "
          >
            {isLoadingMore ? (
              <>
                <LoadingSpinner size="sm" />
                Loading…
              </>
            ) : (
              `Load more (${remaining.toLocaleString()} remaining)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
