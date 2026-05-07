type FilterSummaryBarProps = {
  className?: string;
  onToggleSelectedOnly: (checked: boolean) => void;
  resultsCountLabel: string;
  scannedAt: string;
  selectedFilesCount: number;
  showSelectedOnly: boolean;
};

export function FilterSummaryBar({
  className = "",
  onToggleSelectedOnly,
  resultsCountLabel,
  scannedAt,
  selectedFilesCount,
  showSelectedOnly,
}: FilterSummaryBarProps) {
  return (
    <section className={`filter-summary-bar ${className}`.trim()} aria-label="Podsumowanie filtrów">
      <div className="status-strip filter-summary-status">
        <span>{resultsCountLabel}</span>
        <span>Skan: {scannedAt}</span>
        <button
          type="button"
          className={`summary-chip-button ${showSelectedOnly ? "active" : ""}`}
          onClick={() => onToggleSelectedOnly(!showSelectedOnly)}
          disabled={!showSelectedOnly && selectedFilesCount === 0}
          aria-pressed={showSelectedOnly}
        >
          Zaznaczono: {selectedFilesCount}
        </button>
      </div>
    </section>
  );
}
