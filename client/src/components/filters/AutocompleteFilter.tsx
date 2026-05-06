import { useState, useRef, useEffect, useCallback } from 'react';
import { useDistinctValues, type AutocompleteColumn } from '../../hooks/useDistinctValues';
import { FilterPill } from './FilterPill';

interface AutocompleteFilterProps {
  column: AutocompleteColumn;
  label: string;
  selectedValues: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}

export function AutocompleteFilter({
  column,
  label,
  selectedValues,
  onAdd,
  onRemove,
}: AutocompleteFilterProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pass inputValue directly — useDistinctValues debounces internally (300ms).
  const { values, isLoading } = useDistinctValues(column, inputValue);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      if (!selectedValues.includes(value)) {
        onAdd(value);
      }
      setInputValue('');
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [selectedValues, onAdd],
  );

  const filteredValues = values
    .filter((v) => !selectedValues.includes(v))
    .sort((a, b) => {
      const q = inputValue.toLowerCase();
      if (!q) return 0;
      const aPos = a.toLowerCase().indexOf(q);
      const bPos = b.toLowerCase().indexOf(q);
      // Items where query appears earlier rank higher; -1 (no match) goes to end.
      return (aPos === -1 ? Infinity : aPos) - (bPos === -1 ? Infinity : bPos);
    });

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-surface-400">
        {label}
      </label>

      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((v) => (
            <FilterPill key={v} label={v} onRemove={() => onRemove(v)} />
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={`Vyhledat ${label.toLowerCase()}…`}
          className="w-full rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 transition-colors"
        />

        {isOpen && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-surface-600 bg-surface-800 py-1 shadow-lg"
          >
            {isLoading ? (
              <li className="px-3 py-2 text-xs text-surface-400">Načítání…</li>
            ) : filteredValues.length === 0 ? (
              <li className="px-3 py-2 text-xs text-surface-400">Žádné možnosti</li>
            ) : (
              filteredValues.slice(0, 20).map((v) => (
                <li
                  key={v}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => {
                    // prevent input blur before click registers
                    e.preventDefault();
                    handleSelect(v);
                  }}
                  className="cursor-pointer px-3 py-1.5 text-sm text-surface-100 hover:bg-primary-700 transition-colors"
                >
                  {v}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
