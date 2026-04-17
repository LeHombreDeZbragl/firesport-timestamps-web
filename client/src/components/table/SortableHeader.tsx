import type { SortableColumn, SortConfig } from '../../types';

interface SortableHeaderProps {
  columnKey: SortableColumn;
  label: string;
  currentSort: SortConfig;
  onSortChange: (sort: SortConfig | null) => void;
}

type SortState = 'asc' | 'desc' | 'none';

function nextSortState(current: SortState): SortState {
  if (current === 'none') return 'asc';
  if (current === 'asc') return 'desc';
  return 'none';
}

export function SortableHeader({
  columnKey,
  label,
  currentSort,
  onSortChange,
}: SortableHeaderProps): React.JSX.Element {
  const isActive = currentSort.column === columnKey;
  const currentState: SortState = isActive ? currentSort.order : 'none';

  function handleClick(): void {
    const next = nextSortState(currentState);
    if (next === 'none') {
      onSortChange(null);
    } else {
      onSortChange({ column: columnKey, order: next });
    }
  }

  return (
    <th scope="col" className="whitespace-nowrap px-3 py-2 text-left">
      <button
        type="button"
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide
          transition-colors focus:outline-none focus-visible:underline
          ${isActive ? 'text-primary-300' : 'text-surface-400 hover:text-surface-200'}
        `}
        aria-sort={isActive ? (currentSort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <SortIcon state={currentState} />
      </button>
    </th>
  );
}

function SortIcon({ state }: { state: SortState }): React.JSX.Element {
  if (state === 'asc') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
      </svg>
    );
  }
  if (state === 'desc') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
      </svg>
    );
  }
  // neutral icon for unsorted columns
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-30" aria-hidden="true">
      <path fillRule="evenodd" d="M2.24 6.8a.75.75 0 001.06-.04l1.95-2.1v8.59a.75.75 0 001.5 0V4.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L2.2 5.74a.75.75 0 00.04 1.06zm8 6.4a.75.75 0 00-.04 1.06l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75a.75.75 0 00-1.5 0v8.59l-1.95-2.1a.75.75 0 00-1.06.04z" clipRule="evenodd" />
    </svg>
  );
}
