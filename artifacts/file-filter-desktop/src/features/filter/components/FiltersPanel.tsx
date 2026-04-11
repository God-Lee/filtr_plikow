import type { FileRecord, FilterGroup } from "../../../app/types";

type FiltersPanelProps = {
  activeFilterCount: number;
  clearFilters: () => void;
  expandedGroups: Record<string, boolean>;
  filterOptions: Record<string, string[]>;
  filters: Record<string, string[]>;
  invalidCount: number;
  invalidCountTooltip: string;
  setExpandedGroups: (updater: Record<string, boolean> | ((current: Record<string, boolean>) => Record<string, boolean>)) => void;
  showInvalidOnly: boolean;
  totalFiles: number;
  validCount: number;
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
  filterOptions,
  filters,
  invalidCount,
  invalidCountTooltip,
  setExpandedGroups,
  showInvalidOnly,
  totalFiles,
  validCount,
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
        <div className="filters-title-wrap">
          <h2 className="filters-title">Filtry</h2>
          <div className="filters-insight">
            <button
              type="button"
              className="filters-insight-trigger"
              aria-label="Pokaż podsumowanie filtrów"
            >
              <span aria-hidden="true">💡</span>
            </button>
            <div className="filters-insight-popover" role="tooltip">
              <article className="filters-insight-item">
                <span>Wszystkie</span>
                <strong>{totalFiles}</strong>
              </article>
              <article className="filters-insight-item">
                <span>Poprawne</span>
                <strong
                  className={validCountTooltip ? "summary-card-value with-tooltip" : "summary-card-value"}
                  data-tooltip={validCountTooltip || undefined}
                >
                  {validCount}
                </strong>
              </article>
              <article className="filters-insight-item invalid">
                <span>Błędne</span>
                <strong
                  className={invalidCountTooltip ? "summary-card-value with-tooltip" : "summary-card-value"}
                  data-tooltip={invalidCountTooltip || undefined}
                >
                  {invalidCount}
                </strong>
              </article>
              <article className="filters-insight-item">
                <span>Aktywne filtry</span>
                <strong>{activeFilterCount}</strong>
              </article>
            </div>
          </div>
        </div>
        <button className="link-button" onClick={clearFilters}>
          Resetuj
        </button>
      </div>

      <div className="filters-panel-scroll">
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
                    className={`chip-grid ${group.key !== "extensionLabel" ? "stacked-chip-grid" : ""}`}
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
      </div>
    </aside>
  );
}
