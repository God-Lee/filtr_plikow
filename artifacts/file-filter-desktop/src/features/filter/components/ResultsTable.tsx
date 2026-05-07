import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  DateFilterKey,
  DateFilterPreset,
  DateFilterValue,
  FileRecord,
  FilterColumnKey,
  ScanResult,
  SortConfig,
  SortKey,
} from "../../../app/types";
import { FilterSummaryBar } from "./FilterSummaryBar";
import { SORTABLE_COLUMNS, getValidationLabel } from "../domain";

type TableViewMode = "comfortable" | "narrow";

const TABLE_VIEW_MODE_STORAGE_KEY = "file-filter.tableViewMode";
const COLUMN_ORDER_STORAGE_KEY = "file-filter.columnOrder";
const CHECK_COLUMN_WIDTH = 46;
const NARROW_ACTIONS_COLUMN_WIDTH = 118;
const STANDARD_VALID_FILENAME_SAMPLE = "25144-CR-CR-PDW-XX-X01-R07-S0.dwg";
const DEFAULT_REORDERABLE_COLUMN_KEYS = SORTABLE_COLUMNS
  .map((column) => column.key)
  .filter((columnKey) => columnKey !== "fileName") as FilterColumnKey[];
const NARROW_COLUMN_MIN_WIDTHS: Partial<Record<FilterColumnKey, number>> = {
  fileName: 72,
  isValid: 112,
  createdAt: 102,
  modifiedAt: 132,
  phase: 72,
  disciplineCode: 82,
  documentType: 68,
  level: 78,
  drawingNumber: 118,
  revision: 82,
  status: 82,
};

let textMeasureCanvas: HTMLCanvasElement | null = null;

const DATE_FILTER_LABELS: Record<DateFilterPreset, string> = {
  today: "Dzisiaj",
  week: "Ten tydzień",
  month: "Ten miesiąc",
  custom: "Własny zakres",
};

function shouldToggleSelectionFromTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && !target.closest("button, input, select, textarea, a, label");
}

function isDateFilterKey(columnKey: FilterColumnKey): columnKey is DateFilterKey {
  return columnKey === "createdAt" || columnKey === "modifiedAt";
}

function getInitialTableViewMode(): TableViewMode {
  try {
    return window.localStorage.getItem(TABLE_VIEW_MODE_STORAGE_KEY) === "narrow" ? "narrow" : "comfortable";
  } catch {
    return "comfortable";
  }
}

function sanitizeColumnOrder(value: unknown): FilterColumnKey[] {
  if (!Array.isArray(value)) {
    return DEFAULT_REORDERABLE_COLUMN_KEYS;
  }

  const allowedColumnKeys = new Set<FilterColumnKey>(DEFAULT_REORDERABLE_COLUMN_KEYS);
  const nextOrder = value.filter(
    (columnKey): columnKey is FilterColumnKey =>
      typeof columnKey === "string" && allowedColumnKeys.has(columnKey as FilterColumnKey),
  );

  return [
    ...Array.from(new Set(nextOrder)),
    ...DEFAULT_REORDERABLE_COLUMN_KEYS.filter((columnKey) => !nextOrder.includes(columnKey)),
  ];
}

function getInitialColumnOrder() {
  try {
    const rawValue = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
    return rawValue ? sanitizeColumnOrder(JSON.parse(rawValue)) : DEFAULT_REORDERABLE_COLUMN_KEYS;
  } catch {
    return DEFAULT_REORDERABLE_COLUMN_KEYS;
  }
}

function measureTextWidth(text: string, font: string) {
  if (typeof document === "undefined") {
    return text.length * 8;
  }

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) {
    return text.length * 8;
  }

  context.font = font;
  return context.measureText(text).width;
}

function getDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDatePresetFilter(preset: Exclude<DateFilterPreset, "custom">): DateFilterValue {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  if (preset === "today") {
    return {
      preset,
      from: getDateInputValue(from),
      to: getDateInputValue(to),
    };
  }

  if (preset === "week") {
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
    return {
      preset,
      from: getDateInputValue(from),
      to: getDateInputValue(to),
    };
  }

  from.setDate(1);
  return {
    preset,
    from: getDateInputValue(from),
    to: getDateInputValue(to),
  };
}

function getNormalizedCustomDateFilter(from: string, to: string): DateFilterValue | null {
  if (!from || !to) {
    return null;
  }

  return {
    preset: "custom",
    from: from <= to ? from : to,
    to: from <= to ? to : from,
  };
}

function getDateFilterLabel(filter: DateFilterValue | null) {
  if (!filter) {
    return "";
  }

  if (filter.preset !== "custom") {
    return DATE_FILTER_LABELS[filter.preset];
  }

  return `${filter.from} - ${filter.to}`;
}

function isWindowEffectivelyFullSize() {
  return (
    window.outerWidth >= window.screen.availWidth - 12 &&
    window.outerHeight >= window.screen.availHeight - 12
  );
}

function formatFileDate(value: string | null | undefined) {
  const date = new Date(value ?? "");

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderColumnCell(
  file: FileRecord,
  columnKey: FilterColumnKey,
  onOpenFolder: (targetPath: string) => void,
) {
  switch (columnKey) {
    case "fileName":
      return (
        <td key={columnKey} className="column-file">
          <div className="file-cell">
            <button
              type="button"
              className="file-name-button"
              onClick={() => onOpenFolder(file.folderPath)}
              aria-label={`Otwórz folder dla pliku ${file.fileName}`}
              data-tooltip="Kliknij aby otworzyć folder"
            >
              {file.fileName}
            </button>
          </div>
        </td>
      );
    case "isValid":
      return (
        <td key={columnKey} className="column-status">
          <span
            className={`status-pill ${file.isValid ? "valid" : "invalid"} ${
              !file.isValid && file.invalidReason && file.invalidReason !== "Błędna lokalizacja"
                ? "with-tooltip"
                : ""
            }`}
            data-tooltip={
              !file.isValid && file.invalidReason !== "Błędna lokalizacja"
                ? (file.invalidReason ?? "")
                : undefined
            }
          >
            {getValidationLabel(file)}
          </span>
        </td>
      );
    case "createdAt":
      return (
        <td key={columnKey} className="column-date">
          {formatFileDate(file.createdAt)}
        </td>
      );
    case "modifiedAt":
      return (
        <td key={columnKey} className="column-date">
          {formatFileDate(file.modifiedAt)}
        </td>
      );
    case "phase":
      return <td key={columnKey}>{file.parsedSegments?.phase ?? "-"}</td>;
    case "disciplineCode":
      return <td key={columnKey}>{file.parsedSegments?.disciplineCode ?? "-"}</td>;
    case "documentType":
      return <td key={columnKey}>{file.parsedSegments?.documentType ?? "-"}</td>;
    case "level":
      return <td key={columnKey}>{file.parsedSegments?.level ?? "-"}</td>;
    case "drawingNumber":
      return <td key={columnKey}>{file.parsedSegments?.drawingNumber ?? "-"}</td>;
    case "revision":
      return <td key={columnKey}>{file.parsedSegments?.revision ?? "-"}</td>;
    case "status":
      return <td key={columnKey}>{file.parsedSegments?.status ?? "-"}</td>;
    default:
      return null;
  }
}

type ResultsTableProps = {
  dateFilters: Record<DateFilterKey, DateFilterValue | null>;
  onClearSelection: () => void;
  onDecodeSelected: () => void;
  onOpenFile: (targetPath: string) => void;
  onOpenFolder: (targetPath: string) => void;
  onRefreshProject: () => void;
  onSetDateFilter: (dateKey: DateFilterKey, filter: DateFilterValue | null) => void;
  onToggleColumnVisibility: (columnKey: FilterColumnKey) => void;
  onToggleSelectedOnly: (checked: boolean) => void;
  resultsCountLabel: string;
  scanResult: ScanResult | null;
  scanning: boolean;
  selectedFileIds: string[];
  selectedFilesCount: number;
  showSelectedOnly: boolean;
  sortedFiles: FileRecord[];
  sortConfig: SortConfig;
  toggleAllVisibleFiles: () => void;
  toggleFileSelection: (fileId: string) => void;
  toggleSort: (sortKey: SortKey) => void;
  visibleColumnKeys: FilterColumnKey[];
};

export function ResultsTable({
  dateFilters,
  onClearSelection,
  onDecodeSelected,
  onOpenFile,
  onOpenFolder,
  onRefreshProject,
  onSetDateFilter,
  onToggleColumnVisibility,
  onToggleSelectedOnly,
  resultsCountLabel,
  scanResult,
  scanning,
  selectedFileIds,
  selectedFilesCount,
  showSelectedOnly,
  sortedFiles,
  sortConfig,
  toggleAllVisibleFiles,
  toggleFileSelection,
  toggleSort,
  visibleColumnKeys,
}: ResultsTableProps) {
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [tableViewMode, setTableViewMode] = useState<TableViewMode>(getInitialTableViewMode);
  const [columnOrder, setColumnOrder] = useState<FilterColumnKey[]>(getInitialColumnOrder);
  const [draggedColumnKey, setDraggedColumnKey] = useState<FilterColumnKey | null>(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState<FilterColumnKey | null>(null);
  const [dateMenu, setDateMenu] = useState<{ key: DateFilterKey; x: number; y: number } | null>(null);
  const [customDateRange, setCustomDateRange] = useState({ from: "", to: "" });
  const suppressNextSortClickRef = useRef(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const dateMenuRef = useRef<HTMLDivElement | null>(null);
  const resultsPanelRef = useRef<HTMLElement | null>(null);
  const wasWindowFullSizeRef = useRef<boolean | null>(null);
  const visibleColumnKeySet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);
  const visibleColumns = useMemo(
    () => {
      const columnsByKey = new Map(SORTABLE_COLUMNS.map((column) => [column.key, column]));
      const fileColumn = columnsByKey.get("fileName");
      const orderedColumns = columnOrder
        .map((columnKey) => columnsByKey.get(columnKey))
        .filter((column): column is (typeof SORTABLE_COLUMNS)[number] => Boolean(column));

      return [
        ...(fileColumn ? [fileColumn] : []),
        ...orderedColumns,
      ].filter((column) => visibleColumnKeySet.has(column.key));
    },
    [columnOrder, visibleColumnKeySet],
  );
  const narrowColumnWidths = useMemo(() => {
    const correctlyNamedFileNames = sortedFiles.filter((file) => file.isValid).map((file) => file.fileName);
    const longestVisibleFileName = [STANDARD_VALID_FILENAME_SAMPLE, ...correctlyNamedFileNames].reduce(
      (longest, fileName) => (fileName.length > longest.length ? fileName : longest),
      "Plik",
    );
    const fileNameWidth = Math.ceil(
      measureTextWidth(longestVisibleFileName, "700 16px Trebuchet MS, Segoe UI, sans-serif") + 38,
    );

    return Object.fromEntries(
      visibleColumns.map((column) => {
        if (column.key === "fileName") {
          return [column.key, Math.max(NARROW_COLUMN_MIN_WIDTHS.fileName ?? 0, fileNameWidth)];
        }

        const labelWidth = Math.ceil(
          measureTextWidth(column.label.toUpperCase(), "700 12px Trebuchet MS, Segoe UI, sans-serif") +
            column.label.length +
            46,
        );

        return [column.key, Math.max(NARROW_COLUMN_MIN_WIDTHS[column.key] ?? 64, labelWidth)];
      }),
    ) as Record<FilterColumnKey, number>;
  }, [sortedFiles, visibleColumns]);
  const narrowTableWidth = useMemo(
    () =>
      CHECK_COLUMN_WIDTH +
      visibleColumns.reduce((sum, column) => sum + narrowColumnWidths[column.key], 0) +
      NARROW_ACTIONS_COLUMN_WIDTH,
    [narrowColumnWidths, visibleColumns],
  );
  const allVisibleSelected = sortedFiles.length > 0 && sortedFiles.every((file) => selectedFileIds.includes(file.id));

  function toggleViewMode() {
    setTableViewMode((current) => (current === "narrow" ? "comfortable" : "narrow"));
  }

  function openDateFilterMenu(dateKey: DateFilterKey, event: ReactMouseEvent) {
    event.preventDefault();
    const currentFilter = dateFilters[dateKey];
    const headerElement = event.currentTarget as HTMLElement;
    const triggerRect = headerElement.querySelector(".sort-button")?.getBoundingClientRect();
    const targetRect = triggerRect ?? headerElement.getBoundingClientRect();
    const panelRect = resultsPanelRef.current?.getBoundingClientRect();
    const left = panelRect ? targetRect.left - panelRect.left : targetRect.left;
    const top = panelRect ? targetRect.bottom - panelRect.top + 6 : targetRect.bottom + 6;
    const maxLeft = (panelRect?.width ?? window.innerWidth) - 252;
    setCustomDateRange({
      from: currentFilter?.from ?? "",
      to: currentFilter?.to ?? "",
    });
    setDateMenu({
      key: dateKey,
      x: Math.max(8, Math.min(left, maxLeft)),
      y: Math.max(8, top),
    });
  }

  function applyDateFilter(dateKey: DateFilterKey, filter: DateFilterValue | null) {
    onSetDateFilter(dateKey, filter);
    setDateMenu(null);
  }

  function applyCustomDateFilter() {
    if (!dateMenu) {
      return;
    }

    const filter = getNormalizedCustomDateFilter(customDateRange.from, customDateRange.to);
    if (!filter) {
      return;
    }

    applyDateFilter(dateMenu.key, filter);
  }

  function resetTableView() {
    setTableViewMode("comfortable");
    setColumnOrder(DEFAULT_REORDERABLE_COLUMN_KEYS);
    setColumnsMenuOpen(false);
  }

  function handleRefreshAndResetView() {
    resetTableView();
    onRefreshProject();
  }

  function reorderColumn(targetColumnKey: FilterColumnKey) {
    if (!draggedColumnKey || draggedColumnKey === "fileName" || targetColumnKey === "fileName") {
      return;
    }

    setColumnOrder((current) => {
      const sourceIndex = current.indexOf(draggedColumnKey);
      const targetIndex = current.indexOf(targetColumnKey);

      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return current;
      }

      const nextOrder = current.filter((columnKey) => columnKey !== draggedColumnKey);
      const targetIndexAfterRemoval = nextOrder.indexOf(targetColumnKey);
      const insertIndex = targetIndex > sourceIndex ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
      nextOrder.splice(insertIndex, 0, draggedColumnKey);

      return nextOrder;
    });
  }

  function finishColumnDrag() {
    setDraggedColumnKey(null);
    setDragOverColumnKey(null);
    window.setTimeout(() => {
      suppressNextSortClickRef.current = false;
    }, 200);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!columnsMenuRef.current?.contains(event.target as Node)) {
        setColumnsMenuOpen(false);
      }
      if (!dateMenuRef.current?.contains(event.target as Node)) {
        setDateMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    function syncViewModeWithWindowSize() {
      const isFullSize = isWindowEffectivelyFullSize();

      if (wasWindowFullSizeRef.current === null) {
        wasWindowFullSizeRef.current = isFullSize;
        if (!isFullSize) {
          setTableViewMode("narrow");
        }
        return;
      }

      if (wasWindowFullSizeRef.current && !isFullSize) {
        setTableViewMode("narrow");
      }

      if (!wasWindowFullSizeRef.current && isFullSize) {
        setTableViewMode("comfortable");
      }

      wasWindowFullSizeRef.current = isFullSize;
    }

    syncViewModeWithWindowSize();
    window.addEventListener("resize", syncViewModeWithWindowSize);
    return () => window.removeEventListener("resize", syncViewModeWithWindowSize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TABLE_VIEW_MODE_STORAGE_KEY, tableViewMode);
    } catch {
      // Tryb widoku nadal działa w bieżącej sesji.
    }
  }, [tableViewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder));
    } catch {
      // Kolejność kolumn nadal działa w bieżącej sesji.
    }
  }, [columnOrder]);

  return (
    <section className="results-panel" ref={resultsPanelRef}>
      {scanResult ? (
        <div className="panel-header">
          <div>
            <h2>{scanResult.projectName}</h2>
            <FilterSummaryBar
              className="filter-summary-bar-inline"
              onToggleSelectedOnly={onToggleSelectedOnly}
              resultsCountLabel={resultsCountLabel}
              scannedAt={new Date(scanResult.scannedAt).toLocaleString("pl-PL")}
              selectedFilesCount={selectedFilesCount}
              showSelectedOnly={showSelectedOnly}
            />
          </div>
          <div className="results-selection-actions">
            <button
              type="button"
              className={`table-icon-button ${tableViewMode === "narrow" ? "active" : ""}`}
              onClick={toggleViewMode}
              aria-label={tableViewMode === "narrow" ? "Przełącz na widok komfortowy" : "Przełącz na widok wąski"}
              data-tooltip={tableViewMode === "narrow" ? "Widok komfortowy" : "Widok wąski"}
            >
              <span className="window-restore-icon" aria-hidden="true" />
            </button>
            <div className={`table-columns-menu-wrap ${columnsMenuOpen ? "open" : ""}`} ref={columnsMenuRef}>
              <button
                type="button"
                className="table-icon-button"
                onClick={() => setColumnsMenuOpen((current) => !current)}
                aria-label="Wybierz widoczne kolumny"
                aria-expanded={columnsMenuOpen}
                aria-haspopup="true"
                data-tooltip="Kolumny"
              >
                <span className="table-columns-icon" aria-hidden="true" />
              </button>
              {columnsMenuOpen ? (
                <div className="table-columns-menu" aria-label="Widoczne kolumny">
                  {SORTABLE_COLUMNS.map((column) => {
                    const checked = visibleColumnKeySet.has(column.key);
                    const disabled = checked && visibleColumns.length === 1;

                    return (
                      <label
                        key={column.key}
                        className={`column-picker-option ${disabled ? "disabled" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => onToggleColumnVisibility(column.key)}
                        />
                        <span>{column.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button type="button" className="ghost-button" onClick={handleRefreshAndResetView} disabled={scanning}>
              {scanning ? "Odświeżanie..." : "Odśwież"}
            </button>
            <button type="button" className="ghost-button" onClick={onClearSelection} disabled={selectedFilesCount === 0}>
              Wyczyść zaznaczenie
            </button>
            <button type="button" className="primary-button" onClick={onDecodeSelected} disabled={selectedFilesCount === 0}>
              Do odkodowania
            </button>
          </div>
        </div>
      ) : null}

      {dateMenu ? (
        <div
          className="date-filter-menu"
          ref={dateMenuRef}
          style={{ left: dateMenu.x, top: dateMenu.y }}
          role="menu"
          aria-label={`Filtr daty ${dateMenu.key === "createdAt" ? "utworzenia" : "modyfikacji"}`}
        >
          <button
            type="button"
            className="date-filter-menu-item"
            onClick={() => applyDateFilter(dateMenu.key, getDatePresetFilter("today"))}
          >
            Dzisiaj
          </button>
          <button
            type="button"
            className="date-filter-menu-item"
            onClick={() => applyDateFilter(dateMenu.key, getDatePresetFilter("week"))}
          >
            Ten tydzień
          </button>
          <button
            type="button"
            className="date-filter-menu-item"
            onClick={() => applyDateFilter(dateMenu.key, getDatePresetFilter("month"))}
          >
            Ten miesiąc
          </button>
          <div className="date-filter-custom">
            <span>Własny zakres</span>
            <label>
              Od
              <input
                type="date"
                value={customDateRange.from}
                onChange={(event) =>
                  setCustomDateRange((current) => ({ ...current, from: event.target.value }))
                }
              />
            </label>
            <label>
              Do
              <input
                type="date"
                value={customDateRange.to}
                onChange={(event) =>
                  setCustomDateRange((current) => ({ ...current, to: event.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="date-filter-apply"
              onClick={applyCustomDateFilter}
              disabled={!customDateRange.from || !customDateRange.to}
            >
              Zastosuj
            </button>
          </div>
          {dateFilters[dateMenu.key] ? (
            <button
              type="button"
              className="date-filter-menu-item muted"
              onClick={() => applyDateFilter(dateMenu.key, null)}
            >
              Wyczyść filtr
            </button>
          ) : null}
        </div>
      ) : null}

      {scanResult?.missingFolders?.length ? (
        <div className="banner muted">
          Niektóre oczekiwane foldery nie istniały w projekcie. To nie blokuje działania programu, ale warto to sprawdzić.
        </div>
      ) : null}

      {!scanResult ? (
        <div className="empty-state empty-state-compact">
          <h3>Wybierz projekt</h3>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table
              className={`results-table ${tableViewMode === "narrow" ? "narrow-view" : "comfortable-view"}`}
              style={tableViewMode === "narrow" ? { minWidth: narrowTableWidth, width: narrowTableWidth } : undefined}
            >
              {tableViewMode === "narrow" ? (
                <colgroup>
                  <col style={{ width: CHECK_COLUMN_WIDTH }} />
                  {visibleColumns.map((column) => (
                    <col key={column.key} style={{ width: narrowColumnWidths[column.key] }} />
                  ))}
                  <col style={{ width: NARROW_ACTIONS_COLUMN_WIDTH }} />
                </colgroup>
              ) : null}
              <thead>
                <tr>
                  <th className="column-check">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisibleFiles}
                      aria-label="Zaznacz wszystkie widoczne pliki"
                    />
                  </th>
                  {visibleColumns.map((column) => {
                    const isActive = sortConfig.key === column.key;
                    const directionLabel = isActive && sortConfig.direction === "asc" ? "rosnąco" : "malejąco";
                    const canDragColumn = column.key !== "fileName";
                    const dateColumnKey = isDateFilterKey(column.key) ? column.key : null;
                    const dateFilterLabel = dateColumnKey ? getDateFilterLabel(dateFilters[dateColumnKey]) : "";

                    return (
                      <th
                        key={column.key}
                        className={[
                          column.className,
                          canDragColumn ? "draggable-column" : "",
                          dateFilterLabel ? "active-date-filter" : "",
                          draggedColumnKey === column.key ? "dragging-column" : "",
                          dragOverColumnKey === column.key ? "drag-over-column" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onDragOver={(event) => {
                          if (!canDragColumn || !draggedColumnKey) {
                            return;
                          }

                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverColumnKey(column.key);
                        }}
                        onDragLeave={() => {
                          if (dragOverColumnKey === column.key) {
                            setDragOverColumnKey(null);
                          }
                        }}
                        onDrop={(event) => {
                          if (!canDragColumn) {
                            return;
                          }

                          event.preventDefault();
                          suppressNextSortClickRef.current = true;
                          reorderColumn(column.key);
                          finishColumnDrag();
                        }}
                        onContextMenu={(event) => {
                          if (dateColumnKey) {
                            openDateFilterMenu(dateColumnKey, event);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className={`sort-button ${isActive ? "active" : ""}`}
                          draggable={canDragColumn}
                          onDragStart={(event) => {
                            if (!canDragColumn) {
                              return;
                            }

                            suppressNextSortClickRef.current = true;
                            setDraggedColumnKey(column.key);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", column.key);
                          }}
                          onDragEnd={finishColumnDrag}
                          onClick={() => {
                            if (suppressNextSortClickRef.current) {
                              suppressNextSortClickRef.current = false;
                              return;
                            }

                            toggleSort(column.key);
                          }}
                          aria-label={`Sortuj po kolumnie ${column.label} ${directionLabel}`}
                        >
                          <span className="column-header-label">{column.label}</span>
                          {dateFilterLabel ? (
                            <span className="date-filter-dot" aria-label={`Filtr daty: ${dateFilterLabel}`} />
                          ) : null}
                          <span className="sort-indicator" aria-hidden="true">
                            {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  <th className="column-actions">
                    <span className="header-static-label">Akcje</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2}>
                      <div className="empty-inline">
                        {showSelectedOnly
                          ? "Brak wybranych plików pasujących do aktywnych filtrów."
                          : "Brak plików pasujących do wybranych filtrów."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedFiles.map((file) => (
                    <tr
                      key={file.id}
                      className={file.isValid ? "" : "invalid-row"}
                      onClick={(event) => {
                        if (shouldToggleSelectionFromTarget(event.target)) {
                          toggleFileSelection(file.id);
                        }
                      }}
                    >
                      <td className="column-check">
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          aria-label={`Zaznacz plik ${file.fileName}`}
                        />
                      </td>
                      {visibleColumns.map((column) => renderColumnCell(file, column.key, onOpenFolder))}
                      <td className="column-actions">
                        <div className="actions">
                          <button onClick={() => onOpenFile(file.absolutePath)}>Otwórz plik</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
