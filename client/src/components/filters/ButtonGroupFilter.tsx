import { useDistinctValues, type AutocompleteColumn } from '../../hooks/useDistinctValues';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CATEGORY_ORDER } from '../../constants';

interface ButtonGroupFilterProps {
  column: AutocompleteColumn;
  label: string;
  selectedValues: string[];
  onToggle: (value: string) => void;
}

function sortedValues(values: string[], column: AutocompleteColumn): string[] {
  if (column !== 'category') return values;
  const ordered = CATEGORY_ORDER.filter((c) => values.includes(c));
  const rest = values.filter((v) => !CATEGORY_ORDER.includes(v)).sort((a, b) => a.localeCompare(b, 'cs'));
  return [...ordered, ...rest];
}

export function ButtonGroupFilter({
  column,
  label,
  selectedValues,
  onToggle,
}: ButtonGroupFilterProps): React.JSX.Element {
  const { values, isLoading } = useDistinctValues(column, '');
  const displayValues = sortedValues(values, column);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-surface-400">
        {label}
      </label>

      {isLoading ? (
        <div className="flex items-center gap-2 py-1">
          <LoadingSpinner size="sm" />
          <span className="text-xs text-surface-500">Načítání…</span>
        </div>
      ) : values.length === 0 ? (
        <p className="text-xs text-surface-500">Žádné možnosti</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {displayValues.map((value) => {
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
