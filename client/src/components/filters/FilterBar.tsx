import { AutocompleteFilter } from './AutocompleteFilter';
import { ButtonGroupFilter } from './ButtonGroupFilter';
import { LeagueFilter } from './LeagueFilter';
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
          label="Tým"
          selectedValues={filters.team}
          onAdd={(v) => onAddFilter('team', v)}
          onRemove={(v) => onRemoveFilter('team', v)}
        />
        <AutocompleteFilter
          column="place"
          label="Místo"
          selectedValues={filters.place}
          onAdd={(v) => onAddFilter('place', v)}
          onRemove={(v) => onRemoveFilter('place', v)}
        />
        <LeagueFilter
          selectedValues={filters.league}
          onToggle={(v) => {
            if (filters.league.includes(v)) {
              onRemoveFilter('league', v);
            } else {
              onAddFilter('league', v);
            }
          }}
        />
        <ButtonGroupFilter
          column="attack_type"
          label="Typ útoku"
          selectedValues={filters.attackType}
          onToggle={(v) => {
            if (filters.attackType.includes(v)) {
              onRemoveFilter('attackType', v);
            } else {
              onAddFilter('attackType', v);
            }
          }}
        />
        <ButtonGroupFilter
          column="category"
          label="Kategorie"
          selectedValues={filters.category}
          onToggle={(v) => {
            if (filters.category.includes(v)) {
              onRemoveFilter('category', v);
            } else {
              onAddFilter('category', v);
            }
          }}
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
          Vymazat všechny filtry
        </button>
      </div>
    </section>
  );
}
