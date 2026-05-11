import type { Timestamp } from '../../types';
import { NON_EDITABLE_FIELDS, EDITABLE_FIELD_INPUT_TYPE, NULLABLE_NUMERIC_FIELDS } from '../../constants';

interface EditableCellProps {
  columnKey: keyof Timestamp;
  /** Current draft string value for this cell (raw, not formatted). */
  draftValue: string;
  /** Formatted display value used only for non-editable read-only cells. */
  displayValue: string;
  onChange: (value: string) => void;
  error?: string;
}

export function EditableCell({
  columnKey,
  draftValue,
  displayValue,
  onChange,
  error,
}: EditableCellProps): React.JSX.Element {
  // Non-editable fields (id, created_at, final_time) are shown as read-only text.
  if (NON_EDITABLE_FIELDS.has(columnKey)) {
    return (
      <td className="whitespace-nowrap px-3 py-2 text-sm text-surface-400">
        {displayValue}
      </td>
    );
  }

  const inputType = EDITABLE_FIELD_INPUT_TYPE[columnKey] ?? 'text';
  const isNullableNumeric = NULLABLE_NUMERIC_FIELDS.has(columnKey);

  return (
    <td className="px-2 py-1">
      <div className="flex flex-col gap-0.5">
        <input
          type={inputType}
          value={draftValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isNullableNumeric ? '—' : undefined}
          step={inputType === 'number' ? 'any' : undefined}
          className={`
            w-full min-w-0 rounded border px-2 py-0.5 text-sm
            bg-surface-800 text-surface-100 placeholder-surface-500
            focus:outline-none focus:ring-1
            ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-surface-600 focus:ring-primary-500'
            }
          `}
        />
        {error && (
          <span className="text-xs text-red-400 leading-tight">{error}</span>
        )}
      </div>
    </td>
  );
}
