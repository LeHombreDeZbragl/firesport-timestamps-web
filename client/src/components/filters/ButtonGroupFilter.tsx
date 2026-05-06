import { useDistinctValues, type AutocompleteColumn } from '../../hooks/useDistinctValues';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ButtonGroupFilterProps {
  column: AutocompleteColumn;
  label: string;
  selectedValues: string[];
  onToggle: (value: string) => void;
}

export function ButtonGroupFilter({
  column,
  label,
  selectedValues,
  onToggle,
}: ButtonGroupFilterProps): React.JSX.Element {
  const { values, isLoading } = useDistinctValues(column, '');

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-surface-400">
        {label}
      </label>

      {isLoading ? (
        <div className="flex items-center gap-2 py-1">
          <LoadingSpinner size="sm" />
          <span className="text-xs text-surface-500">Loading…</span>
        </div>
      ) : values.length === 0 ? (
        <p className="text-xs text-surface-500">No options available</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => {
            const isSelected = selectedValues.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
                aria-pressed={isSelected}
                className={`
                  rounded-md px-2.5 py-1 text-xs font-medium transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400
                  ${isSelected
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}
                `}
              >
                {value}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
