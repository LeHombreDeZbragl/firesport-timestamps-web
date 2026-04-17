import { FILTER_LABELS } from '../../constants';
import { FilterPill } from './FilterPill';
import type { Filters, FilterKey } from '../../types';

interface ActiveFiltersProps {
  filters: Filters;
  onRemove: (filterKey: FilterKey, value: string) => void;
  onClearAll: () => void;
}

export function ActiveFilters({
  filters,
  onRemove,
  onClearAll,
}: ActiveFiltersProps): React.JSX.Element | null {
  const entries = (Object.entries(filters) as [FilterKey, (string | number)[] ][]).filter(
    ([, values]) => values.length > 0,
  );

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-surface-600 bg-surface-800/50 px-3 py-2">
      <span className="text-xs font-semibold text-surface-400 shrink-0">Active filters:</span>

      {entries.map(([filterKey, values]) =>
        values.map((value) => (
          <FilterPill
            key={`${filterKey}-${value}`}
            label={`${FILTER_LABELS[filterKey]}: ${value}`}
            onRemove={() => onRemove(filterKey, String(value))}
          />
        )),
      )}

      <button
        type="button"
        onClick={onClearAll}
        className="ml-auto text-xs text-surface-400 hover:text-white transition-colors focus:outline-none focus-visible:underline"
      >
        Clear all
      </button>
    </div>
  );
}
