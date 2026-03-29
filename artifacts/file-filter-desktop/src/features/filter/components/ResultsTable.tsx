import type { FileRecord, ScanResult, SortConfig, SortKey } from "../../../app/types";
import { SORTABLE_COLUMNS, getValidationLabel } from "../domain";

type ResultsTableProps = {
  onOpenFile: (targetPath: string) => void;
  onOpenFolder: (targetPath: string) => void;
  resultsCountLabel: string;
  scanResult: ScanResult | null;
  sortedFiles: FileRecord[];
  sortConfig: SortConfig;
  toggleSort: (sortKey: SortKey) => void;
};

export function ResultsTable({
  onOpenFile,
  onOpenFolder,
  resultsCountLabel,
  scanResult,
  sortedFiles,
  sortConfig,
  toggleSort,
}: ResultsTableProps) {
  return (
    <section className="results-panel">
      {scanResult ? (
        <div className="panel-header">
          <div>
            <p className="eyebrow">Wyniki</p>
            <h2>{scanResult.projectName}</h2>
          </div>
          <div className="status-strip">
            <span>{resultsCountLabel}</span>
            <span>Skan: {new Date(scanResult.scannedAt).toLocaleString("pl-PL")}</span>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
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
                  <td colSpan={10}>
                    <div className="empty-inline">Brak plików pasujących do wybranych filtrów.</div>
                  </td>
                </tr>
              ) : (
                sortedFiles.map((file) => (
                  <tr key={file.id} className={file.isValid ? "" : "invalid-row"}>
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
      )}
    </section>
  );
}
