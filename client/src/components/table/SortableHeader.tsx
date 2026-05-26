import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { SortableColumn, SortConfig } from '../../types';

interface SortableHeaderProps {
  /** Unique column key — used as the dnd-kit sortable id. */
  colKey: string;
  /** Whether this column can be sorted. */
  sortable: boolean;
  /** Server-side sort column name. Required when sortable=true. */
  columnKey?: SortableColumn;
  /** Display label. */
  label: string;
  /** Optional icon shown on narrow screens (sm breakpoint) instead of label. */
  icon?: IconDefinition;
  /** Current active sort state. */
  currentSort: SortConfig;
  onSortChange: (sort: SortConfig | null) => void;
  /** Current pixel width of this column (set by resize state in DataTable). */
  width: number;
  /** Called on mousedown on the resize handle. */
  onResizeStart: (e: React.MouseEvent) => void;
}

type SortState = 'asc' | 'desc' | 'none';

function nextSortState(current: SortState): SortState {
  if (current === 'none') return 'asc';
  if (current === 'asc') return 'desc';
  return 'none';
}

export function SortableHeader({
  colKey,
  sortable,
  columnKey,
  label,
  icon,
  currentSort,
  onSortChange,
  width,
  onResizeStart,
}: SortableHeaderProps): React.JSX.Element {
  const isActive = sortable && columnKey !== undefined && currentSort.column === columnKey;
  const currentState: SortState = isActive ? currentSort.order : 'none';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colKey,
  });

  const thStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width,
    minWidth: width,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  function handleSortClick(): void {
    if (!sortable || !columnKey) return;
    const next = nextSortState(currentState);
    if (next === 'none') {
      onSortChange(null);
    } else {
      onSortChange({ column: columnKey, order: next });
    }
  }

  const labelContent = icon ? (
    <>
      <span className="compact:hidden" aria-hidden="true">
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="hidden compact:inline">{label}</span>
    </>
  ) : (
    <span>{label}</span>
  );

  return (
    <th
      ref={setNodeRef}
      scope="col"
      style={thStyle}
      onClick={handleSortClick}
      className={`select-none transition-colors hover:bg-surface-800/60 ${sortable ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-0.5 px-1 py-2">
        {/* Drag handle — listeners go here so clicking the sort button does not activate drag */}
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-grab touch-none px-1 text-surface-600 hover:text-surface-400 active:cursor-grabbing"
          title="Přetáhněte pro změnu pořadí"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3"
            aria-hidden="true"
          >
            <circle cx="4" cy="3" r="1.25" />
            <circle cx="8" cy="3" r="1.25" />
            <circle cx="12" cy="3" r="1.25" />
            <circle cx="4" cy="8" r="1.25" />
            <circle cx="8" cy="8" r="1.25" />
            <circle cx="12" cy="8" r="1.25" />
            <circle cx="4" cy="13" r="1.25" />
            <circle cx="8" cy="13" r="1.25" />
            <circle cx="12" cy="13" r="1.25" />
          </svg>
        </span>

        {/* Sort button or plain label */}
        {sortable && columnKey ? (
          <button
            type="button"
            onClick={handleSortClick}
            className={`
              inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide
              whitespace-nowrap transition-colors focus:outline-none focus-visible:underline
              ${isActive ? 'cursor-pointer text-primary-400' : 'cursor-pointer text-surface-400 hover:text-surface-200'}
            `}
            aria-sort={
              isActive
                ? currentSort.order === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            title={label}
          >
            {labelContent}
            <SortIcon state={currentState} />
          </button>
        ) : (
          <span
            className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-surface-400"
            title={label}
          >
            {labelContent}
          </span>
        )}
      </div>

      {/* Resize handle — absolute right edge */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary-500/60 active:bg-primary-500"
        onMouseDown={onResizeStart}
        onClick={(e) => e.stopPropagation()}
        aria-hidden="true"
      />
    </th>
  );
}

function SortIcon({ state }: { state: SortState }): React.JSX.Element {
  if (state === 'asc') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3 w-3"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (state === 'desc') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3 w-3"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 opacity-30"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M2.24 6.8a.75.75 0 001.06-.04l1.95-2.1v8.59a.75.75 0 001.5 0V4.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L2.2 5.74a.75.75 0 00.04 1.06zm8 6.4a.75.75 0 00-.04 1.06l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75a.75.75 0 00-1.5 0v8.59l-1.95-2.1a.75.75 0 00-1.06.04z"
        clipRule="evenodd"
      />
    </svg>
  );
}
