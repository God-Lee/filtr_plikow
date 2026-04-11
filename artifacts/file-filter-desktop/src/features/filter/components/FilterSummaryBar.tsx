type FilterSummaryBarProps = {
  className?: string;
  resultsCountLabel: string;
  scannedAt: string;
  selectedFilesCount: number;
};

export function FilterSummaryBar({
  className = "",
  resultsCountLabel,
  scannedAt,
  selectedFilesCount,
}: FilterSummaryBarProps) {
  return (
    <section className={`filter-summary-bar ${className}`.trim()} aria-label="Podsumowanie filtrów">
      <div className="status-strip filter-summary-status">
        <span>{resultsCountLabel}</span>
        <span>Skan: {scannedAt}</span>
        <span>Zaznaczono: {selectedFilesCount}</span>
      </div>
    </section>
  );
}
