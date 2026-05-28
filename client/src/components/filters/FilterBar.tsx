import { AutocompleteFilter } from './AutocompleteFilter';
import { ButtonGroupFilter } from './ButtonGroupFilter';
import { LeagueFilter } from './LeagueFilter';
import { YearFilter } from './YearFilter';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { Filters, FilterKey } from '../../types';

interface FilterBarProps {
  filters: Filters;
  onAddFilter: (filterKey: FilterKey, value: string) => void;
  onRemoveFilter: (filterKey: FilterKey, value: string) => void;
  onClearAll: () => void;
  onSearch: () => void;
  filtersChanged: boolean;
  isSearching: boolean;
}

export function FilterBar({
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  onSearch,
  filtersChanged,
  isSearching,
}: FilterBarProps): React.JSX.Element {
  return (
    <section aria-label="Filters">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Team - sm: col1 row1, lg: auto */}
        <div className="sm:col-start-1 sm:row-start-1 lg:col-auto lg:row-auto">
          <AutocompleteFilter
            column="team"
            label="Tým"
            selectedValues={filters.team}
            onAdd={(v) => onAddFilter('team', v)}
            onRemove={(v) => onRemoveFilter('team', v)}
          />
        </div>

        {/* Place - sm: col1 row2, lg: auto */}
        <div className="sm:col-start-1 sm:row-start-2 lg:col-auto lg:row-auto">
          <AutocompleteFilter
            column="place"
            label="Místo"
            selectedValues={filters.place}
            onAdd={(v) => onAddFilter('place', v)}
            onRemove={(v) => onRemoveFilter('place', v)}
          />
        </div>

        {/* League - sm: col1 row3, lg: auto */}
        <div className="sm:col-start-1 sm:row-start-3 lg:col-auto lg:row-auto">
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
        </div>

        {/* Year - sm: col2 row1-3, lg: auto */}
        <div className="sm:col-start-2 sm:row-start-1 sm:row-span-3 lg:col-auto lg:row-auto">
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

        {/* Category - sm: col1 row4-5, lg: auto */}
        <div className="sm:col-start-1 sm:row-start-4 sm:row-span-2 lg:col-auto lg:row-auto">
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
        </div>

        {/* Attack Type + Clear - sm: col2 row4-5, lg: auto */}
        <div className="flex flex-col justify-between gap-3 sm:col-start-2 sm:row-start-4 sm:row-span-2 lg:col-auto lg:row-auto">
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
          <div className="flex justify-between items-center gap-3">
            <button
              type="button"
              onClick={onClearAll}
              className={`rounded-md border px-4 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 transition-colors ${
                filtersChanged
                  ? 'border-red-400 bg-surface-700 text-red-300 hover:bg-surface-600 hover:text-red-200 focus-visible:ring-red-400 shadow-[0_0_6px_rgba(255,0,0,0.25)]'
                  : 'border-surface-500 bg-surface-700 text-surface-200 hover:border-primary-400 hover:bg-surface-600 hover:text-white focus-visible:ring-orange-400'
              }`}
            >
              Vymazat filtry
            </button>
            <button
              type="button"
              onClick={onSearch}
              disabled={isSearching}
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                filtersChanged && !isSearching
                  ? 'border-emerald-400 bg-surface-700 text-emerald-300 hover:bg-surface-600 hover:text-emerald-200 focus-visible:ring-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.25)]'
                  : 'border-surface-500 bg-surface-700 text-surface-200 hover:border-primary-400 hover:bg-surface-600 hover:text-white focus-visible:ring-orange-400'
              }`}
            >
              {isSearching ? <LoadingSpinner size="sm" /> : 'Vyhledat'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
