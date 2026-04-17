import { AutocompleteFilter } from './AutocompleteFilter';
import { YearFilter } from './YearFilter';
import type { Filters, FilterKey } from '../../types';

interface FilterBarProps {
  filters: Filters;
  onAddFilter: (filterKey: FilterKey, value: string) => void;
  onRemoveFilter: (filterKey: FilterKey, value: string) => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
}: FilterBarProps): React.JSX.Element {
  return (
    <section aria-label="Filters" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AutocompleteFilter
          column="team"
          label="Team"
          selectedValues={filters.team}
          onAdd={(v) => onAddFilter('team', v)}
          onRemove={(v) => onRemoveFilter('team', v)}
        />
        <AutocompleteFilter
          column="category"
          label="Category"
          selectedValues={filters.category}
          onAdd={(v) => onAddFilter('category', v)}
          onRemove={(v) => onRemoveFilter('category', v)}
        />
        <AutocompleteFilter
          column="league"
          label="League"
          selectedValues={filters.league}
          onAdd={(v) => onAddFilter('league', v)}
          onRemove={(v) => onRemoveFilter('league', v)}
        />
        <AutocompleteFilter
          column="place"
          label="Place"
          selectedValues={filters.place}
          onAdd={(v) => onAddFilter('place', v)}
          onRemove={(v) => onRemoveFilter('place', v)}
        />
        <AutocompleteFilter
          column="attack_type"
          label="Attack Type"
          selectedValues={filters.attackType}
          onAdd={(v) => onAddFilter('attackType', v)}
          onRemove={(v) => onRemoveFilter('attackType', v)}
        />
        <YearFilter
          selectedYears={filters.year}
          onToggle={(year) => {
            if (filters.year.includes(year)) {
              onRemoveFilter('year', String(year));
            } else {
              onAddFilter('year', String(year));
            }
          }}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-md border border-surface-500 bg-surface-700 px-4 py-1.5 text-sm font-semibold text-surface-200 hover:border-primary-400 hover:bg-surface-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
        >
          Clear all filters
        </button>
      </div>
    </section>
  );
}
