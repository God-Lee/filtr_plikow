import type { FileRecord, ScanResult, SortConfig, SortKey } from "../../../app/types";
import { FilterSummaryBar } from "./FilterSummaryBar";
import { SORTABLE_COLUMNS, getValidationLabel } from "../domain";

function shouldToggleSelectionFromTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && !target.closest("button, input, select, textarea, a, label");
}

type ResultsTableProps = {
  onClearSelection: () => void;
  onDecodeSelected: () => void;
  onOpenFile: (targetPath: string) => void;
  onOpenFolder: (targetPath: string) => void;
  onRefreshProject: () => void;
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
};

export function ResultsTable({
  onClearSelection,
  onDecodeSelected,
  onOpenFile,
  onOpenFolder,
  onRefreshProject,
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
}: ResultsTableProps) {
  const allVisibleSelected = sortedFiles.length > 0 && sortedFiles.every((file) => selectedFileIds.includes(file.id));

  return (
    <section className="results-panel">
      {scanResult ? (
        <div className="panel-header">
          <div>
            <h2>{scanResult.projectName}</h2>
            <FilterSummaryBar
              className="filter-summary-bar-inline"
              resultsCountLabel={resultsCountLabel}
              scannedAt={new Date(scanResult.scannedAt).toLocaleString("pl-PL")}
              selectedFilesCount={selectedFilesCount}
            />
          </div>
          <div className="results-selection-actions">
            <button type="button" className="ghost-button" onClick={onRefreshProject} disabled={scanning}>
              {scanning ? "Odświeżanie..." : "Odśwież"}
            </button>
            <button
              type="button"
              className={`ghost-button ${showSelectedOnly ? "active" : ""}`}
              onClick={() => onToggleSelectedOnly(!showSelectedOnly)}
              aria-pressed={showSelectedOnly}
              disabled={!showSelectedOnly && selectedFilesCount === 0}
            >
              Tylko wybrane
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
            <table>
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
                  {SORTABLE_COLUMNS.map((column) => {
                    const isActive = sortConfig.key === column.key;
                    const directionLabel = isActive && sortConfig.direction === "asc" ? "rosnąco" : "malejąco";

                    return (
                      <th key={column.key} className={column.className}>
                        <button
                          type="button"
                          className={`sort-button ${isActive ? "active" : ""}`}
                          onClick={() => toggleSort(column.key)}
                          aria-label={`Sortuj po kolumnie ${column.label} ${directionLabel}`}
                        >
                          <span>{column.label}</span>
                          <span className="sort-indicator" aria-hidden="true">
                            {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={11}>
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
                      <td className="column-file">
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
                      <td className="column-status">
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
                      <td>{file.parsedSegments?.phase ?? "-"}</td>
                      <td>{file.parsedSegments?.disciplineCode ?? "-"}</td>
                      <td>{file.parsedSegments?.documentType ?? "-"}</td>
                      <td>{file.parsedSegments?.level ?? "-"}</td>
                      <td>{file.parsedSegments?.drawingNumber ?? "-"}</td>
                      <td>{file.parsedSegments?.revision ?? "-"}</td>
                      <td>{file.parsedSegments?.status ?? "-"}</td>
                      <td>
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
