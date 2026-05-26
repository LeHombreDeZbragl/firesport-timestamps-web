import { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPencil, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import {
  COLUMN_DEFINITIONS,
  NULLABLE_NUMERIC_FIELDS,
  EDITABLE_FIELD_INPUT_TYPE,
  EDITABLE_COLUMN_KEYS,
} from '../../constants';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { EmptyState } from '../common/EmptyState';
import { SortableHeader } from './SortableHeader';
import { ClickableCell } from './ClickableCell';
import { EditableCell } from './EditableCell';
import type { Timestamp, SortConfig, FilterKey, EditableTimestampFields } from '../../types';

const BASE_VISIBLE_COLUMNS = COLUMN_DEFINITIONS.filter((col) => col.defaultVisible);

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  team: 180,
  lp: 70,
  pp: 70,
  final_time: 110,
  attack_type: 80,
  category: 110,
  league: 80,
  placement: 96,
  attack_date: 100,
  place: 180,
};

const DELETE_COL_WIDTH = 48;
const EDIT_COL_WIDTH = 72;

const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => i);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateAndBuildPayload(
  draft: Record<string, string>,
): { valid: false; errors: Record<string, string> } | { valid: true; payload: EditableTimestampFields } {
  const errors: Record<string, string> = {};

  for (const key of EDITABLE_COLUMN_KEYS) {
    const strKey = key as string;
    if (!(strKey in draft)) continue;
    const value = draft[strKey];
    const inputType = EDITABLE_FIELD_INPUT_TYPE[key];
    const isNullableNumeric = NULLABLE_NUMERIC_FIELDS.has(key);

    if (inputType === 'number') {
      if (isNullableNumeric) {
        if (value !== '' && (isNaN(parseFloat(value)) || !isFinite(parseFloat(value)))) {
          errors[strKey] = 'Zadejte číslo nebo nechte prázdné';
        }
      } else {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
          errors[strKey] = 'Zadejte kladné celé číslo';
        }
      }
    } else if (inputType === 'date') {
      if (!DATE_REGEX.test(value)) {
        errors[strKey] = 'Zadejte datum ve formátu RRRR-MM-DD';
      }
    } else {
      if (key !== 'link' && value.trim() === '') {
        errors[strKey] = 'Pole nesmí být prázdné';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  const result: Record<string, unknown> = {};
  for (const key of EDITABLE_COLUMN_KEYS) {
    const strKey = key as string;
    const value = draft[strKey] ?? '';
    const inputType = EDITABLE_FIELD_INPUT_TYPE[key];
    const isNullableNumeric = NULLABLE_NUMERIC_FIELDS.has(key);

    if (inputType === 'number') {
      if (isNullableNumeric) {
        result[strKey] = value === '' ? null : parseFloat(value);
      } else {
        result[strKey] = parseInt(value, 10);
      }
    } else {
      result[strKey] = value;
    }
  }

  return { valid: true, payload: result as EditableTimestampFields };
}

interface DataTableProps {
  rows: Timestamp[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  sort: SortConfig;
  onSortChange: (sort: SortConfig | null) => void;
  onAddFilter: (filterKey: FilterKey, value: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onDeleteRow: (id: number) => void;
  onUpdateRow: (id: number, fields: EditableTimestampFields) => void;
}

export function DataTable({
  rows,
  totalCount,
  hasMore,
  isLoading,
  isLoadingMore,
  error,
  sort,
  onSortChange,
  onAddFilter,
  onLoadMore,
  onRetry,
  onDeleteRow,
  onUpdateRow,
}: DataTableProps): React.JSX.Element {
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    BASE_VISIBLE_COLUMNS.map((c) => c.key as string),
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // ─── Inline edit state ────────────────────────────────────────────────────────────
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  function handleEditStart(row: Timestamp): void {
    const draft: Record<string, string> = {};
    for (const key of EDITABLE_COLUMN_KEYS) {
      const val = row[key];
      draft[key as string] = val === null || val === undefined ? '' : String(val);
    }
    setDraftValues(draft);
    setEditErrors({});
    setEditingRowId(row.id);
  }

  function handleCancel(): void {
    setEditingRowId(null);
    setDraftValues({});
    setEditErrors({});
  }

  function handleSave(rowId: number): void {
    const result = validateAndBuildPayload(draftValues);
    if (!result.valid) {
      setEditErrors(result.errors);
      return;
    }
    setEditingRowId(null);
    setDraftValues({});
    setEditErrors({});
    onUpdateRow(rowId, result.payload);
  }

  function handleEditClick(row: Timestamp): void {
    if (editingRowId !== null && editingRowId !== row.id) {
      if (!window.confirm('Zahodit neuložené změny?')) return;
      handleCancel();
    }
    handleEditStart(row);
  }

  const orderedColumns = useMemo(
    () =>
      columnOrder
        .map((key) => BASE_VISIBLE_COLUMNS.find((c) => (c.key as string) === key))
        .filter(Boolean) as typeof BASE_VISIBLE_COLUMNS,
    [columnOrder],
  );

  // Global mouse listeners for column resize dragging
  useEffect(() => {
    if (!isResizing) return;

    function onMouseMove(e: MouseEvent): void {
      // Capture the ref value immediately — the async setColumnWidths updater
      // runs later and by then onMouseUp may have already set the ref to null.
      const resizing = resizingRef.current;
      if (!resizing) return;
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.key]: newWidth }));
    }
    function onMouseUp(): void {
      resizingRef.current = null;
      setIsResizing(false);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  // Full-page loading state (first fetch)
  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-surface-700">
        <table className="min-w-full table-fixed text-left text-sm">
          <thead className="sticky top-0 z-10 bg-surface-900">
            <tr>
              {BASE_VISIBLE_COLUMNS.map((col) => (
                <th
                  key={col.key as string}
                  scope="col"
                  style={{ width: DEFAULT_COLUMN_WIDTHS[col.key as string] ?? 120 }}
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-surface-400"
                >
                  {col.label}
                </th>
              ))}              <th scope="col" style={{ width: EDIT_COL_WIDTH }} className="px-3 py-2" />              <th scope="col" style={{ width: DELETE_COL_WIDTH }} className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {SKELETON_ROWS.map((i) => (
              <tr key={i} className="border-t border-surface-700">
                {BASE_VISIBLE_COLUMNS.map((col) => (
                  <td key={col.key as string} className="px-3 py-2">
                    <div
                      className="h-4 animate-pulse rounded bg-surface-700"
                      style={{ width: `${60 + ((i * (col.key as string).length) % 30)}%` }}
                    />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="h-4 w-6 animate-pulse rounded bg-surface-700" />
                </td>
                <td className="px-3 py-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-surface-700" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  const remaining = totalCount - rows.length;

  return (
    <div className="flex flex-col gap-4">
      {isResizing && (
        <div
          className="fixed inset-0 z-50"
          style={{ userSelect: 'none' }}
          aria-hidden="true"
        />
      )}
      <div className="overflow-x-auto rounded-lg border border-surface-700">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="min-w-full table-fixed text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface-900 shadow-sm">
              <SortableContext
                items={orderedColumns.map((c) => c.key as string)}
                strategy={horizontalListSortingStrategy}
              >
                <tr>
                  {orderedColumns.map((col) => (
                    <SortableHeader
                      key={col.key as string}
                      colKey={col.key as string}
                      sortable={col.sortable}
                      columnKey={col.sortColumn}
                      label={col.label}
                      icon={col.icon}
                      currentSort={sort}
                      onSortChange={onSortChange}
                      width={columnWidths[col.key as string] ?? 120}
                      onResizeStart={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                        resizingRef.current = {
                          key: col.key as string,
                          startX: e.clientX,
                          startWidth: columnWidths[col.key as string] ?? 120,
                        };
                      }}
                    />
                  ))}
                  <th
                    scope="col"
                    style={{ width: DELETE_COL_WIDTH, minWidth: DELETE_COL_WIDTH }}
                    className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-surface-400"
                  >
                    <span className="sr-only">Smazat</span>
                  </th>
                </tr>
              </SortableContext>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  className={`border-t border-surface-700/60 transition-colors hover:bg-surface-800/60 ${rowIndex % 2 === 0 ? '' : 'bg-surface-800/20'}`}
                >
                  {orderedColumns.map((col) =>
                    editingRowId === row.id ? (
                      <EditableCell
                        key={col.key as string}
                        columnKey={col.key as keyof Timestamp}
                        draftValue={draftValues[col.key as string] ?? ''}
                        displayValue={
                          col.format
                            ? col.format(row[col.key as keyof Timestamp])
                            : row[col.key as keyof Timestamp] !== null &&
                                row[col.key as keyof Timestamp] !== undefined
                              ? String(row[col.key as keyof Timestamp])
                              : '—'
                        }
                        onChange={(value) =>
                          setDraftValues((prev) => ({ ...prev, [col.key as string]: value }))
                        }
                        error={editErrors[col.key as string]}
                      />
                    ) : (
                      <ClickableCell
                        key={col.key as string}
                        columnDef={col}
                        value={row[col.key as keyof Timestamp]}
                        onAddFilter={onAddFilter}
                      />
                    ),
                  )}
                  {/* Edit action column */}
                  <td
                    className="whitespace-nowrap px-2 py-2 text-center"
                    style={{ width: EDIT_COL_WIDTH }}
                  >
                    {editingRowId === row.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="rounded text-red-600 transition-colors hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          title="Zrušit změny"
                        >
                          <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(row.id)}
                          className="rounded text-yellow-400 transition-colors hover:text-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                          title="Uložit změny"
                        >
                          <FontAwesomeIcon icon={faFloppyDisk} className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEditClick(row)}
                        className="rounded text-blue-500 transition-colors hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        title="Upravit záznam"
                      >
                        <FontAwesomeIcon icon={faPencil} className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                  {/* Delete column */}
                  <td
                    className="whitespace-nowrap px-2 py-2 text-center"
                    style={{ width: DELETE_COL_WIDTH }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Opravdu smazat tento záznam?')) {
                          onDeleteRow(row.id);
                        }
                      }}
                      className="rounded text-danger-500 transition-colors hover:text-danger-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-400"
                      title="Smazat záznam"
                    >
                      <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>

      {hasMore && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="
              inline-flex items-center gap-2 rounded-md bg-primary-700 px-5 py-2 text-sm font-medium text-white
              hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors
            "
          >
            {isLoadingMore ? (
              <>
                <LoadingSpinner size="sm" />
                Načítání…
              </>
            ) : (
              `Načíst dalších 50 (Zbývá ${remaining.toLocaleString()})`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
