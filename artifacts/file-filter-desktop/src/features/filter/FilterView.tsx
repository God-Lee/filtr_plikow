import { fileFilterApi } from "../../app/api";
import { FilterControls } from "./components/FilterControls";
import { FiltersPanel } from "./components/FiltersPanel";
import { ResultsTable } from "./components/ResultsTable";
import { useFilterWorkspace } from "./useFilterWorkspace";

type FilterViewProps = {
  onDecodeSelected: () => void;
  workspace: ReturnType<typeof useFilterWorkspace>;
};

export function FilterView({ onDecodeSelected, workspace }: FilterViewProps) {
  return (
    <>
      {workspace.errorMessage ? <div className="banner error">{workspace.errorMessage}</div> : null}
      {workspace.reportMessage ? (
        <div className={`banner ${workspace.reportMessageType}`}>{workspace.reportMessage}</div>
      ) : null}
      {!workspace.projectsRoot ? (
        <div className="banner warning">
          Przy pierwszym uruchomieniu wskaż folder <strong>ESP - Realizacje</strong>. Program zapamięta go na przyszłość.
        </div>
      ) : null}

      <main className="layout filter-workspace-layout">
        <div className="filter-sidebar-stack">
          <FilterControls
            filteredProjects={workspace.filteredProjects}
            highlightedProjectIndex={workspace.highlightedProjectIndex}
            loadingProjects={workspace.loadingProjects}
            onFavoriteToggle={() => void workspace.handleFavoriteToggle()}
            onProjectQueryChange={workspace.setProjectQuery}
            onProjectSelect={(project) => void workspace.handleProjectSelect(project)}
            projectOptionRefs={workspace.projectOptionRefs}
            projectPickerOpen={workspace.projectPickerOpen}
            projectPickerRef={workspace.projectPickerRef}
            projectQuery={workspace.projectQuery}
            projectsRoot={workspace.projectsRoot}
            selectedProject={workspace.selectedProject}
            selectedProjectIsFavorite={workspace.selectedProjectIsFavorite}
            setHighlightedProjectIndex={workspace.setHighlightedProjectIndex}
            setProjectPickerOpen={workspace.setProjectPickerOpen}
          />

          <FiltersPanel
            activeFilterCount={workspace.activeFilterCount}
            clearFilters={workspace.clearFilters}
            expandedGroups={workspace.expandedGroups}
            filterOptions={workspace.filterOptions}
            filters={workspace.filters}
            invalidCount={workspace.filteredInvalidCount}
            invalidCountTooltip={workspace.invalidCountTooltip}
            onSearchQueryChange={workspace.setSearchQuery}
            searchQuery={workspace.searchQuery}
            setExpandedGroups={workspace.setExpandedGroups}
            showInvalidOnly={workspace.showInvalidOnly}
            totalFiles={workspace.sortedFiles.length}
            validCount={workspace.filteredValidCount}
            showValidOnly={workspace.showValidOnly}
            toggleFilter={workspace.toggleFilter}
            toggleInvalidOnly={workspace.toggleInvalidOnly}
            toggleValidOnly={workspace.toggleValidOnly}
            validCountTooltip={workspace.validCountTooltip}
            visibleFilterGroups={workspace.visibleFilterGroups}
          />
        </div>

        <ResultsTable
          dateFilters={workspace.dateFilters}
          onClearSelection={workspace.clearSelectedFiles}
          onDecodeSelected={onDecodeSelected}
          onOpenFile={(targetPath) => void fileFilterApi.openFile(targetPath)}
          onOpenFolder={(targetPath) => void fileFilterApi.openFolder(targetPath)}
          onRefreshProject={() => void workspace.handleRefreshCurrentProject()}
          onSetDateFilter={workspace.setDateFilter}
          onToggleColumnVisibility={workspace.toggleColumnVisibility}
          onToggleSelectedOnly={workspace.toggleSelectedOnly}
          resultsCountLabel={workspace.resultsCountLabel}
          scanResult={workspace.scanResult}
          scanning={workspace.scanning}
          selectedFileIds={workspace.selectedFileIds}
          selectedFilesCount={workspace.selectedFilesCount}
          showSelectedOnly={workspace.showSelectedOnly}
          sortedFiles={workspace.sortedFiles}
          sortConfig={workspace.sortConfig}
          toggleAllVisibleFiles={workspace.toggleAllVisibleFiles}
          toggleFileSelection={workspace.toggleFileSelection}
          toggleSort={workspace.toggleSort}
          visibleColumnKeys={workspace.visibleColumnKeys}
        />
      </main>
    </>
  );
}
