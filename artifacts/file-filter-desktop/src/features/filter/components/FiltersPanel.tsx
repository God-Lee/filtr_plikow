import type { FileRecord, FilterGroup, ScanResult } from "../../../app/types";

type FiltersPanelProps = {
  activeFilterCount: number;
  clearFilters: () => void;
  expandedGroups: Record<string, boolean>;
  exportingInvalidReport: boolean;
  filterOptions: Record<string, string[]>;
  filters: Record<string, string[]>;
  invalidCountTooltip: string;
  onExportInvalidFilesReport: () => void;
  scanResult: ScanResult | null;
  setExpandedGroups: (updater: Record<string, boolean> | ((current: Record<string, boolean>) => Record<string, boolean>)) => void;
  showInvalidOnly: boolean;
  showValidOnly: boolean;
  toggleFilter: (filterKey: string, value: string) => void;
  toggleInvalidOnly: (checked: boolean) => void;
  toggleValidOnly: (checked: boolean) => void;
  validCountTooltip: string;
  visibleFilterGroups: FilterGroup<FileRecord>[];
};

export function FiltersPanel({
  activeFilterCount,
  clearFilters,
  expandedGroups,
  exportingInvalidReport,
  filterOptions,
  filters,
  invalidCountTooltip,
  onExportInvalidFilesReport,
  scanResult,
  setExpandedGroups,
  showInvalidOnly,
  showValidOnly,
  toggleFilter,
  toggleInvalidOnly,
  toggleValidOnly,
  validCountTooltip,
  visibleFilterGroups,
}: FiltersPanelProps) {
  return (
    <aside className="filters-panel">
      <div className="panel-header">
        <h2 className="filters-title">Filtry</h2>
        <button className="link-button" onClick={clearFilters}>
          Resetuj
        </button>
      </div>

      <div className="filters-panel-scroll">
        <div className="summary-grid">
          <article className="summary-card">
            <span>Wszystkie</span>
            <strong>{scanResult?.totalFiles ?? 0}</strong>
          </article>
          <article className="summary-card">
            <span>Poprawne</span>
            <strong
              className={validCountTooltip ? "summary-card-value with-tooltip" : "summary-card-value"}
              data-tooltip={validCountTooltip || undefined}
            >
              {scanResult?.validCount ?? 0}
            </strong>
          </article>
          <article className="summary-card invalid">
            <span>Błędne</span>
            <strong
              className={invalidCountTooltip ? "summary-card-value with-tooltip" : "summary-card-value"}
              data-tooltip={invalidCountTooltip || undefined}
            >
              {scanResult?.invalidCount ?? 0}
            </strong>
          </article>
          <article className="summary-card">
            <span>Aktywne filtry</span>
            <strong>{activeFilterCount}</strong>
          </article>
        </div>

        <div className="filter-groups">
          {visibleFilterGroups.map((group) => {
            const options = filterOptions[group.key] ?? [];
            const selectedValues = filters[group.key] ?? [];

            return (
              <section className={`filter-group ${expandedGroups[group.key] ? "" : "collapsed"}`} key={group.key}>
                <div className="filter-group-header">
                  <h3>{group.label}</h3>
                  <div className="filter-group-meta">
                    <span>{selectedValues.length}</span>
                    <button
                      type="button"
                      className="filter-group-toggle"
                      aria-label={expandedGroups[group.key] ? `Zwiń filtr ${group.label}` : `Rozwiń filtr ${group.label}`}
                      onClick={() =>
                        setExpandedGroups((current) => ({
                          ...current,
                          [group.key]: !current[group.key],
                        }))
                      }
                    >
                      <span className={`filter-group-toggle-icon ${expandedGroups[group.key] ? "expanded" : ""}`}>
                        &gt;
                      </span>
                    </button>
                  </div>
                </div>

                {expandedGroups[group.key] ? (
                  <div
                    className={`chip-grid ${
                      group.key !== "sourceKey" && group.key !== "extensionLabel" ? "stacked-chip-grid" : ""
                    }`}
                  >
                    {options.length === 0 ? <p className="empty-copy">Brak danych po skanowaniu.</p> : null}
                    {options.map((option) => {
                      const active = selectedValues.includes(option);
                      return (
                        <button
                          key={option}
                          className={`chip ${active ? "active" : ""}`}
                          onClick={() => toggleFilter(group.key, option)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <div className="filter-toggle-row">
          <label className="toggle-card filter-toggle-card">
            <input
              type="checkbox"
              checked={showInvalidOnly}
              onChange={(event) => toggleInvalidOnly(event.target.checked)}
            />
            <span>Tylko błędne</span>
          </label>

          <label className="toggle-card filter-toggle-card">
            <input
              type="checkbox"
              checked={showValidOnly}
              onChange={(event) => toggleValidOnly(event.target.checked)}
            />
            <span>Tylko poprawne</span>
          </label>
        </div>

        <button
          type="button"
          className="primary-button filter-export-button"
          onClick={onExportInvalidFilesReport}
          disabled={!scanResult || exportingInvalidReport || (scanResult.invalidCount ?? 0) === 0}
        >
          {exportingInvalidReport ? "Eksportowanie..." : "Eksportuj raport błędnych plików"}
        </button>
      </div>
    </aside>
  );
}
