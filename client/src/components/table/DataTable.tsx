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
import { faTrash, faPencil, faFloppyDisk, faXmark, faPlus, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
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
import type {
  Timestamp,
  SortConfig,
  FilterKey,
  EditableTimestampFields,
  BatchSavePayload,
  BatchSaveOutcome,
} from '../../types';

const BASE_VISIBLE_COLUMNS = COLUMN_DEFINITIONS.filter((col) => col.defaultVisible);

const COLUMN_ORDER_STORAGE_KEY = 'firesport-column-order';

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
  link: 64,
};

const DELETE_COL_WIDTH = 48;

const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => i);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PLACEMENT_MIN = 1;
const PLACEMENT_MAX = 999;
const LP_PP_MIN = 12.01;
const LP_PP_MAX = 99.99;

function validateAndBuildPayload(
  draft: Record<string, string>,
  validLeagues: string[],
  validTypes: string[],
  validCategories: string[],
): { valid: false; errors: Record<string, string> } | { valid: true; payload: EditableTimestampFields } {
  const errors: Record<string, string> = {};
  const currentYear = new Date().getFullYear();

  for (const key of EDITABLE_COLUMN_KEYS) {
    const strKey = key as string;
    if (!(strKey in draft)) continue;
    const value = draft[strKey];
    const inputType = EDITABLE_FIELD_INPUT_TYPE[key];
    const isNullableNumeric = NULLABLE_NUMERIC_FIELDS.has(key);

    if (inputType === 'number') {
      if (isNullableNumeric) {
        if (value !== '') {
          const n = parseFloat(value);
          if (isNaN(n) || !isFinite(n)) {
            errors[strKey] = 'Zadejte číslo nebo nechte prázdné';
          } else if ((key === 'lp' || key === 'pp') && (n < LP_PP_MIN || n > LP_PP_MAX)) {
            errors[strKey] = `Hodnota musí být mezi ${LP_PP_MIN} a ${LP_PP_MAX}`;
          }
        }
      } else {
        const n = Number(value);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < PLACEMENT_MIN || n > PLACEMENT_MAX) {
          errors[strKey] = `Umístění musí být celé číslo od ${PLACEMENT_MIN} do ${PLACEMENT_MAX}`;
        }
      }
    } else if (inputType === 'date') {
      if (!DATE_REGEX.test(value)) {
        errors[strKey] = 'Zadejte datum ve formátu RRRR-MM-DD';
      } else {
        const year = parseInt(value.split('-')[0], 10);
        if (year < 1990 || year > currentYear) {
          errors[strKey] = `Rok musí být mezi 1990 a ${currentYear}`;
        }
      }
    } else {
      if (key !== 'link' && key !== 'league' && value.trim() === '') {
        errors[strKey] = 'Pole nesmí být prázdné';
      } else if (key === 'league' && validLeagues.length > 0 && value.trim() !== '' && !validLeagues.includes(value)) {
        errors[strKey] = 'Tato liga neexistuje';
      } else if (key === 'attack_type' && validTypes.length > 0 && value.trim() !== '' && !validTypes.includes(value)) {
        errors[strKey] = 'Tento typ neexistuje';
      } else if (key === 'category' && validCategories.length > 0 && value.trim() !== '' && !validCategories.includes(value)) {
        errors[strKey] = 'Tato kategorie neexistuje';
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
    } else if (key === 'league' && value.trim() === '') {
      // `league` is nullable: an empty value is stored as NULL.
      result[strKey] = null;
    } else {
      result[strKey] = value;
    }
  }

  return { valid: true, payload: result as EditableTimestampFields };
}

interface NewRow {
  tempId: string;
  draft: Record<string, string>;
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
  onSave: (payload: BatchSavePayload) => Promise<BatchSaveOutcome>;
  isAdmin: boolean;
  validLeagues: string[];
  validTypes: string[];
  validCategories: string[];
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
  onSave,
  isAdmin,
  validLeagues,
  validTypes,
  validCategories,
}: DataTableProps): React.JSX.Element {
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultOrder = BASE_VISIBLE_COLUMNS.map((c) => c.key as string);
    try {
      const stored = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
          const storedOrder = parsed as string[];
          // Append any newly default-visible columns missing from the stored order
          // (e.g. the "link" column) so they show up for returning users.
          const missing = defaultOrder.filter((key) => !storedOrder.includes(key));
          return [...storedOrder, ...missing];
        }
      }
    } catch {
      // Ignore parse errors — fall through to default
    }
    return defaultOrder;
  });

  useEffect(() => {
    localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder));
  }, [columnOrder]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftRows, setDraftRows] = useState<Record<number, Record<string, string>>>({});
  const [rowErrors, setRowErrors] = useState<Record<string | number, Record<string, string>>>({});
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);

  function buildInitialDraft(row: Timestamp): Record<string, string> {
    const draft: Record<string, string> = {};
    for (const key of EDITABLE_COLUMN_KEYS) {
      const val = row[key as keyof Timestamp];
      draft[key as string] = val === null || val === undefined ? '' : String(val);
    }
    return draft;
  }

  function enterEditMode(): void {
    const drafts: Record<number, Record<string, string>> = {};
    for (const row of rows) {
      drafts[row.id] = buildInitialDraft(row);
    }
    setDraftRows(drafts);
    setRowErrors({});
    setNewRows([]);
    setDeletedIds([]);
    setIsEditMode(true);
  }

  function exitEditMode(): void {
    setIsEditMode(false);
    setDraftRows({});
    setRowErrors({});
    setNewRows([]);
    setDeletedIds([]);
  }

  function handleAddRow(): void {
    if (!isEditMode) {
      const drafts: Record<number, Record<string, string>> = {};
      for (const row of rows) {
        drafts[row.id] = buildInitialDraft(row);
      }
      setDraftRows(drafts);
      setRowErrors({});
      setDeletedIds([]);
      setIsEditMode(true);
    }
    const tempId = `new-${Date.now()}`;
    const draft: Record<string, string> = {};
    for (const key of EDITABLE_COLUMN_KEYS) {
      draft[key as string] = '';
    }
    setNewRows((prev) => [{ tempId, draft }, ...prev]);
  }

  function handleDeleteToggle(id: number): void {
    setDeletedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function removeNewRow(tempId: string): void {
    setNewRows((prev) => prev.filter((r) => r.tempId !== tempId));
    setRowErrors((prev) => {
      if (!(tempId in prev)) return prev;
      const updated = { ...prev };
      delete updated[tempId];
      return updated;
    });
  }

  function handleExistingRowFieldChange(rowId: number, field: string, value: string): void {
    setDraftRows((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: value },
    }));
    setRowErrors((prev) => {
      const rowErrs = prev[rowId];
      if (!rowErrs || !(field in rowErrs)) return prev;
      const updated = { ...rowErrs };
      delete updated[field];
      return { ...prev, [rowId]: updated };
    });
  }

  function handleNewRowFieldChange(tempId: string, field: string, value: string): void {
    setNewRows((prev) =>
      prev.map((r) =>
        r.tempId === tempId ? { ...r, draft: { ...r.draft, [field]: value } } : r,
      ),
    );
    setRowErrors((prev) => {
      const rowErrs = prev[tempId];
      if (!rowErrs || !(field in rowErrs)) return prev;
      const updated = { ...rowErrs };
      delete updated[field];
      return { ...prev, [tempId]: updated };
    });
  }

  async function handleSaveAll(): Promise<void> {
    if (isSaving) return;

    const allErrors: Record<string | number, Record<string, string>> = {};
    let hasErrors = false;
    const updates: BatchSavePayload['updates'] = [];
    const inserts: EditableTimestampFields[] = [];

    for (const rowIdStr of Object.keys(draftRows)) {
      const rowId = Number(rowIdStr);
      if (deletedIds.includes(rowId)) continue;
      const result = validateAndBuildPayload(draftRows[rowId], validLeagues, validTypes, validCategories);
      if (!result.valid) {
        allErrors[rowId] = result.errors;
        hasErrors = true;
      } else {
        updates.push({ id: rowId, fields: result.payload });
      }
    }

    for (const newRow of newRows) {
      const result = validateAndBuildPayload(newRow.draft, validLeagues, validTypes, validCategories);
      if (!result.valid) {
        allErrors[newRow.tempId] = result.errors;
        hasErrors = true;
      } else {
        inserts.push(result.payload);
      }
    }

    if (hasErrors) {
      setRowErrors(allErrors);
      return;
    }

    const payload: BatchSavePayload = { updates, inserts, deletes: deletedIds };

    setIsSaving(true);
    try {
      const outcome = await onSave(payload);
      if (outcome.success) {
        exitEditMode();
      } else if (outcome.errors.length > 0) {
        const mapped: Record<string | number, Record<string, string>> = {};
        for (const err of outcome.errors) {
          let key: string | number;
          if (err.rowRef.startsWith('insert:')) {
            const idx = parseInt(err.rowRef.split(':')[1], 10);
            key = newRows[idx]?.tempId ?? err.rowRef;
          } else {
            key = Number(err.rowRef.split(':')[1]);
          }
          if (!mapped[key]) mapped[key] = {};
          mapped[key][err.field] = err.message;
        }
        setRowErrors(mapped);
      }
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!isEditMode) return;
    setDraftRows((prev) => {
      const newlyLoaded = rows.filter((row) => !(row.id in prev));
      if (newlyLoaded.length === 0) return prev;
      const updated = { ...prev };
      for (const row of newlyLoaded) {
        const draft: Record<string, string> = {};
        for (const key of EDITABLE_COLUMN_KEYS) {
          const val = row[key as keyof Timestamp];
          draft[key as string] = val === null || val === undefined ? '' : String(val);
        }
        updated[row.id] = draft;
      }
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isEditMode]);

  const orderedColumns = useMemo(
    () =>
      columnOrder
        .map((key) => BASE_VISIBLE_COLUMNS.find((c) => (c.key as string) === key))
        .filter(Boolean) as typeof BASE_VISIBLE_COLUMNS,
    [columnOrder],
  );

  useEffect(() => {
    if (!isResizing) return;
    function onMouseMove(e: MouseEvent): void {
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
              ))}
              <th scope="col" style={{ width: DELETE_COL_WIDTH }} className="px-3 py-2" />
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

  const remaining = totalCount - rows.length;

  const toolbar = isAdmin ? (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={handleAddRow}
        disabled={isSaving}
        className="inline-flex items-center gap-1.5 rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        title="Přidat nový záznam"
      >
        <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
        Přidat
      </button>

      {isEditMode ? (
        <>
          <button
            type="button"
            onClick={() => { void handleSaveAll(); }}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            title="Ulozit vsechny zmeny"
          >
            {isSaving ? (
              <LoadingSpinner size="sm" />
            ) : (
              <FontAwesomeIcon icon={faFloppyDisk} className="h-3 w-3" />
            )}
            Uložit
          </button>
          <button
            type="button"
            onClick={exitEditMode}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400"
            title="Zrušit změny"
          >
            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
            Zrušit
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={enterEditMode}
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          title="Upravit zaznamy"
        >
          <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
          Upravit
        </button>
      )}
    </div>
  ) : null;

  if (rows.length === 0 && newRows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isResizing && (
        <div className="fixed inset-0 z-50" style={{ userSelect: 'none' }} aria-hidden="true" />
      )}

      {toolbar}

      <div className="overflow-x-auto rounded-lg border border-surface-700">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                    className="px-2 py-2"
                  >
                    <span className="sr-only">Akce</span>
                  </th>
                </tr>
              </SortableContext>
            </thead>
            <tbody>
              {newRows.map((newRow) => (
                <tr
                  key={newRow.tempId}
                  className="border-t border-primary-700/40 bg-primary-900/10"
                >
                  {orderedColumns.map((col) => (
                    <EditableCell
                      key={col.key as string}
                      columnKey={col.key as keyof Timestamp}
                      draftValue={newRow.draft[col.key as string] ?? ''}
                      displayValue="---"
                      onChange={(value) =>
                        handleNewRowFieldChange(newRow.tempId, col.key as string, value)
                      }
                      error={
                        (rowErrors[newRow.tempId] as Record<string, string> | undefined)?.[
                          col.key as string
                        ]
                      }
                    />
                  ))}
                  <td
                    className="whitespace-nowrap px-2 py-2 text-center"
                    style={{ width: DELETE_COL_WIDTH }}
                  >
                    <button
                      type="button"
                      onClick={() => removeNewRow(newRow.tempId)}
                      className="rounded text-red-500 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      title="Odstranit nový řádek"
                    >
                      <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {rows.map((row, rowIndex) => {
                const isDeleted = deletedIds.includes(row.id);
                const rowClass = [
                  'border-t border-surface-700/60 transition-colors',
                  isDeleted
                    ? 'bg-red-900/20 opacity-60'
                    : rowIndex % 2 === 0
                      ? 'hover:bg-surface-800/60'
                      : 'bg-surface-800/20 hover:bg-surface-800/60',
                ].join(' ');

                return (
                  <tr key={row.id} className={rowClass}>
                    {orderedColumns.map((col) =>
                      isEditMode && !isDeleted ? (
                        <EditableCell
                          key={col.key as string}
                          columnKey={col.key as keyof Timestamp}
                          draftValue={draftRows[row.id]?.[col.key as string] ?? ''}
                          displayValue={
                            col.format
                              ? col.format(row[col.key as keyof Timestamp])
                              : row[col.key as keyof Timestamp] !== null &&
                                  row[col.key as keyof Timestamp] !== undefined
                                ? String(row[col.key as keyof Timestamp])
                                : '---'
                          }
                          onChange={(value) =>
                            handleExistingRowFieldChange(row.id, col.key as string, value)
                          }
                          error={
                            (rowErrors[row.id] as Record<string, string> | undefined)?.[
                              col.key as string
                            ]
                          }
                        />
                      ) : (
                        <ClickableCell
                          key={col.key as string}
                          columnDef={col}
                          value={row[col.key as keyof Timestamp]}
                          onAddFilter={onAddFilter}
                          strikethrough={isDeleted}
                        />
                      ),
                    )}

                    <td
                      className="whitespace-nowrap px-2 py-2 text-center"
                      style={{ width: DELETE_COL_WIDTH }}
                    >
                      {isAdmin && isEditMode && (
                        <button
                          type="button"
                          onClick={() => handleDeleteToggle(row.id)}
                          className={
                            isDeleted
                              ? 'rounded text-surface-400 transition-colors hover:text-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400'
                              : 'rounded text-danger-500 transition-colors hover:text-danger-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-400'
                          }
                          title={isDeleted ? 'Zrušit smazání' : 'Smazat záznam'}
                        >
                          <FontAwesomeIcon
                            icon={isDeleted ? faRotateLeft : faTrash}
                            className="h-3.5 w-3.5"
                          />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
            className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-5 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
          >
            {isLoadingMore ? (
              <>
                <LoadingSpinner size="sm" />
                Nacitani...
              </>
            ) : (
              `Nacist dalsich 50 (Zbyvá ${remaining.toLocaleString()})`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
