import type { ColumnDefinition, Timestamp, FilterKey } from '../../types';
import { FIRESPORT_LINK_BASE } from '../../constants';

interface ClickableCellProps {
  columnDef: ColumnDefinition;
  value: Timestamp[keyof Timestamp];
  onAddFilter: (filterKey: FilterKey, value: string) => void;
  strikethrough?: boolean;
}

export function ClickableCell({
  columnDef,
  value,
  onAddFilter,
  strikethrough = false,
}: ClickableCellProps): React.JSX.Element {
  const strikethroughClass = strikethrough ? ' line-through' : '';
  const displayValue = columnDef.format
    ? columnDef.format(value)
    : value !== null && value !== undefined
      ? String(value)
      : '—';

  // Special rendering: link column
  if (columnDef.key === 'link' && typeof value === 'string' && value.length > 0) {
    const href = value.startsWith('http') ? value : `${FIRESPORT_LINK_BASE}${value}`;
    return (
      <td className={`overflow-x-auto whitespace-nowrap px-3 py-2${strikethroughClass}`}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-400 hover:text-primary-300 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          link
        </a>
      </td>
    );
  }

  // Filterable column: clickable to add filter
  if (columnDef.filterable && columnDef.filterKey && value !== null && value !== undefined) {
    const filterKey = columnDef.filterKey;
    const strValue = columnDef.filterValue ? columnDef.filterValue(value) : String(value);
    return (
      <td
        className={`cursor-pointer overflow-x-auto whitespace-nowrap px-3 py-2 text-sm text-surface-200 hover:bg-primary-700/50 hover:text-primary-100 transition-colors${strikethroughClass}`}
        onClick={() => onAddFilter(filterKey, strValue)}
        title={`Filtrovat podle ${columnDef.label}: ${strValue}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAddFilter(filterKey, strValue);
          }
        }}
      >
        {displayValue}
      </td>
    );
  }

  // Non-filterable column
  return (
    <td className={`overflow-x-auto whitespace-nowrap px-3 py-2 text-sm text-surface-200${strikethroughClass}`}>
      {displayValue === '' ? '—' : displayValue}
    </td>
  );
}
