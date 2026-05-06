import { useState, useRef, useEffect } from 'react';
import { useDistinctValues } from '../../hooks/useDistinctValues';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface LeagueFilterProps {
  selectedValues: string[];
  onToggle: (value: string) => void;
}

export function LeagueFilter({ selectedValues, onToggle }: LeagueFilterProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { values, isLoading } = useDistinctValues('league', search);

  // Close when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-surface-400">
        Liga
      </label>

      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Vyhledat ligu…"
          className="w-full rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 transition-colors"
        />

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-surface-600 bg-surface-800 p-2 shadow-lg">
            {isLoading ? (
              <div className="flex items-center gap-2 py-1">
                <LoadingSpinner size="sm" />
                <span className="text-xs text-surface-500">Načítání…</span>
              </div>
            ) : values.length === 0 ? (
              <p className="text-xs text-surface-500">Nebyly nalezeny žádné ligy</p>
            ) : (
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {values.map((value) => {
                  const isSelected = selectedValues.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onMouseDown={(e) => {
                        // prevent input blur before click registers
                        e.preventDefault();
                        onToggle(value);
                      }}
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
        )}
      </div>
    </div>
  );
}

