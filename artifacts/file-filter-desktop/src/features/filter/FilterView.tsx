import { fileFilterApi } from "../../app/api";
import { FilterControls } from "./components/FilterControls";
import { FiltersPanel } from "./components/FiltersPanel";
import { ResultsTable } from "./components/ResultsTable";
import { useFilterWorkspace } from "./useFilterWorkspace";

type FilterViewProps = {
  workspace: ReturnType<typeof useFilterWorkspace>;
};

export function FilterView({ workspace }: FilterViewProps) {
  return (
    <>
      <FilterControls
        filteredProjects={workspace.filteredProjects}
        highlightedProjectIndex={workspace.highlightedProjectIndex}
        loadingProjects={workspace.loadingProjects}
        onChooseRoot={() => void workspace.handleChooseRoot()}
        onFavoriteToggle={() => void workspace.handleFavoriteToggle()}
        onProjectQueryChange={workspace.setProjectQuery}
        onProjectSelect={(project) => void workspace.handleProjectSelect(project)}
        onRefreshProject={() => void workspace.handleRefreshCurrentProject()}
        onSearchQueryChange={workspace.setSearchQuery}
        projectOptionRefs={workspace.projectOptionRefs}
        projectPickerOpen={workspace.projectPickerOpen}
        projectPickerRef={workspace.projectPickerRef}
        projectQuery={workspace.projectQuery}
        projectsRoot={workspace.projectsRoot}
        scanning={workspace.scanning}
        searchQuery={workspace.searchQuery}
        selectedProject={workspace.selectedProject}
        selectedProjectIsFavorite={workspace.selectedProjectIsFavorite}
        setHighlightedProjectIndex={workspace.setHighlightedProjectIndex}
        setProjectPickerOpen={workspace.setProjectPickerOpen}
      />

      {workspace.errorMessage ? <div className="banner error">{workspace.errorMessage}</div> : null}
      {workspace.reportMessage ? (
        <div className={`banner ${workspace.reportMessageType}`}>{workspace.reportMessage}</div>
      ) : null}
      {!workspace.projectsRoot ? (
        <div className="banner warning">
          Przy pierwszym uruchomieniu wskaż folder <strong>ESP - Realizacje</strong>. Program zapamięta go na przyszłość.
        </div>
      ) : null}

      <main className="layout">
        <FiltersPanel
          activeFilterCount={workspace.activeFilterCount}
          clearFilters={workspace.clearFilters}
          expandedGroups={workspace.expandedGroups}
          exportingInvalidReport={workspace.exportingInvalidReport}
          filterOptions={workspace.filterOptions}
          filters={workspace.filters}
          invalidCountTooltip={workspace.invalidCountTooltip}
          onExportInvalidFilesReport={() => void workspace.handleExportInvalidFilesReport()}
          scanResult={workspace.scanResult}
          setExpandedGroups={workspace.setExpandedGroups}
          showInvalidOnly={workspace.showInvalidOnly}
          showValidOnly={workspace.showValidOnly}
          toggleFilter={workspace.toggleFilter}
          toggleInvalidOnly={workspace.toggleInvalidOnly}
          toggleValidOnly={workspace.toggleValidOnly}
          validCountTooltip={workspace.validCountTooltip}
          visibleFilterGroups={workspace.visibleFilterGroups}
        />

        <ResultsTable
          onOpenFile={(targetPath) => void fileFilterApi.openFile(targetPath)}
          onOpenFolder={(targetPath) => void fileFilterApi.openFolder(targetPath)}
          resultsCountLabel={workspace.resultsCountLabel}
          scanResult={workspace.scanResult}
          sortedFiles={workspace.sortedFiles}
          sortConfig={workspace.sortConfig}
          toggleSort={workspace.toggleSort}
        />
      </main>
    </>
  );
}
