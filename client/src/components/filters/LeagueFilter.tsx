import { useState, useRef, useEffect } from 'react';
import { useDistinctValues } from '../../hooks/useDistinctValues';
import { useLeaguePairs } from '../../hooks/useLeaguePairs';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { NO_LEAGUE_VALUE } from '../../constants';

interface LeagueFilterProps {
  selectedValues: string[];
  onToggle: (value: string) => void;
}

/** Human-readable label for a league filter value (the no-league sentinel → "—"). */
function leagueLabel(value: string): string {
  return value === NO_LEAGUE_VALUE ? '—' : value;
}

export function LeagueFilter({ selectedValues, onToggle }: LeagueFilterProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // All distinct league values from the server (filtered by search term)
  const { values: serverValues, isLoading } = useDistinctValues('league', '');
  // Pair map: short code → full name (fetched once)
  const { pairs } = useLeaguePairs();
  const pairMap = new Map(pairs.map((p) => [p.short, p.full]));

  // Filter leagues by both short code and full name
  const values = search.trim().length === 0
    ? serverValues
    : serverValues.filter((v) => {
        const lc = search.toLowerCase();
        return (
          v.toLowerCase().includes(lc) ||
          (pairMap.get(v) ?? '').toLowerCase().includes(lc)
        );
      });

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

  // On select: toggle, clear the search text, close and unfocus the input.
  function handleSelect(value: string): void {
    onToggle(value);
    setSearch('');
    setIsOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-surface-400">
        Liga
      </label>

      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
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

        {!isOpen && selectedValues.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {selectedValues.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
                aria-pressed={true}
                title={value === NO_LEAGUE_VALUE ? 'Bez ligy' : pairMap.get(value) ?? value}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {leagueLabel(value)}
              </button>
            ))}
          </div>
        )}

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-surface-600 bg-surface-800 p-2 shadow-lg">
            <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
              {/* No-league filter: selects rows whose league is empty/NULL. */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(NO_LEAGUE_VALUE);
                }}
                aria-pressed={selectedValues.includes(NO_LEAGUE_VALUE)}
                title="Bez ligy"
                className={`
                  rounded-md px-2.5 py-1 text-xs font-medium transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400
                  ${selectedValues.includes(NO_LEAGUE_VALUE)
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}
                `}
              >
                —
              </button>

              {isLoading ? (
                <div className="flex items-center gap-2 py-1">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs text-surface-500">Načítání…</span>
                </div>
              ) : values.length === 0 ? (
                <p className="text-xs text-surface-500 py-1">Nebyly nalezeny žádné ligy</p>
              ) : (
                values.map((value) => {
                  const isSelected = selectedValues.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onMouseDown={(e) => {
                        // prevent input blur before click registers
                        e.preventDefault();
                        handleSelect(value);
                      }}
                      aria-pressed={isSelected}
                      title={pairMap.get(value) ?? value}
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
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

