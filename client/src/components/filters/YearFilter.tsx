import { useDistinctYears } from '../../hooks/useDistinctValues';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface YearFilterProps {
  selectedYears: number[];
  onToggle: (year: number) => void;
}

export function YearFilter({ selectedYears, onToggle }: YearFilterProps): React.JSX.Element {
  const { years, isLoading } = useDistinctYears();

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-surface-400">
        Year
      </label>

      {isLoading ? (
        <div className="flex items-center gap-2 py-1">
          <LoadingSpinner size="sm" />
          <span className="text-xs text-surface-500">Loading years…</span>
        </div>
      ) : years.length === 0 ? (
        <p className="text-xs text-surface-500">No years available</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {years.map((year) => {
            const isSelected = selectedYears.includes(year);
            return (
              <button
                key={year}
                type="button"
                onClick={() => onToggle(year)}
                aria-pressed={isSelected}
                className={`
                  rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400
                  ${
                    isSelected
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  }
                `}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
