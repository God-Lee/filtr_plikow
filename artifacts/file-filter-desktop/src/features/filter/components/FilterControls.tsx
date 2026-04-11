import type { MutableRefObject, RefObject } from "react";

type FilterControlsProps = {
  filteredProjects: string[];
  highlightedProjectIndex: number;
  loadingProjects: boolean;
  onFavoriteToggle: () => void;
  onProjectQueryChange: (value: string) => void;
  onProjectSelect: (project: string) => void;
  onSearchQueryChange: (value: string) => void;
  projectOptionRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  projectPickerOpen: boolean;
  projectPickerRef: RefObject<HTMLDivElement | null>;
  projectQuery: string;
  projectsRoot: string;
  searchQuery: string;
  selectedProject: string;
  selectedProjectIsFavorite: boolean;
  setHighlightedProjectIndex: (updater: number | ((current: number) => number)) => void;
  setProjectPickerOpen: (updater: boolean | ((current: boolean) => boolean)) => void;
};

export function FilterControls({
  filteredProjects,
  highlightedProjectIndex,
  loadingProjects,
  onFavoriteToggle,
  onProjectQueryChange,
  onProjectSelect,
  onSearchQueryChange,
  projectOptionRefs,
  projectPickerOpen,
  projectPickerRef,
  projectQuery,
  projectsRoot,
  searchQuery,
  selectedProject,
  selectedProjectIsFavorite,
  setHighlightedProjectIndex,
  setProjectPickerOpen,
}: FilterControlsProps) {
  return (
    <section className="controls-layout">
      <div className="project-bar">
        <div className="field project-picker-field" ref={projectPickerRef}>
          <div className="project-field-header">
            <span>Projekt</span>
            <div className="project-field-actions">
              <button
                type="button"
                className={`favorite-toggle ${selectedProjectIsFavorite ? "active" : ""}`}
                onClick={onFavoriteToggle}
                aria-label={selectedProjectIsFavorite ? "Usuń projekt z ulubionych" : "Dodaj projekt do ulubionych"}
                disabled={!selectedProject}
              >
                {selectedProjectIsFavorite ? "★" : "☆"}
              </button>
            </div>
          </div>
          <div className={`project-picker ${projectPickerOpen ? "open" : ""}`}>
            <input
              value={projectQuery}
              onFocus={() => {
                setProjectPickerOpen(true);
                onProjectQueryChange("");
                setHighlightedProjectIndex(-1);
              }}
              onChange={(event) => {
                onProjectQueryChange(event.target.value);
                setProjectPickerOpen(true);
                setHighlightedProjectIndex(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setProjectPickerOpen(false);
                  onProjectQueryChange(selectedProject);
                  setHighlightedProjectIndex(-1);
                  return;
                }

                if (event.key === "ArrowDown") {
                  if (!projectPickerOpen) {
                    setProjectPickerOpen(true);
                  }

                  if (filteredProjects.length === 0) {
                    return;
                  }

                  event.preventDefault();
                  setHighlightedProjectIndex((current) =>
                    current < 0 ? 0 : Math.min(current + 1, filteredProjects.length - 1),
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  if (!projectPickerOpen || filteredProjects.length === 0) {
                    return;
                  }

                  event.preventDefault();
                  setHighlightedProjectIndex((current) => (current <= 0 ? 0 : current - 1));
                  return;
                }

                if (event.key === "Enter" && filteredProjects.length > 0) {
                  event.preventDefault();
                  const projectToSelect =
                    highlightedProjectIndex >= 0 ? filteredProjects[highlightedProjectIndex] : filteredProjects[0];
                  void onProjectSelect(projectToSelect);
                }
              }}
              placeholder="Wybierz lub wyszukaj projekt"
              disabled={!projectsRoot || loadingProjects}
            />
            <button
              type="button"
              className="project-picker-toggle"
              onClick={() => {
                if (!projectsRoot || loadingProjects) {
                  return;
                }

                setProjectPickerOpen((current) => {
                  const next = !current;
                  if (next) {
                    onProjectQueryChange("");
                    setHighlightedProjectIndex(-1);
                  }
                  return next;
                });
              }}
              aria-label={projectPickerOpen ? "Zwiń listę projektów" : "Rozwiń listę projektów"}
              disabled={!projectsRoot || loadingProjects}
            >
              ▾
            </button>

            {projectPickerOpen ? (
              <div className="project-picker-menu">
                {filteredProjects.length === 0 ? (
                  <div className="project-picker-empty">Brak pasujących projektów.</div>
                ) : (
                  filteredProjects.map((project, index) => (
                    <button
                      key={project}
                      type="button"
                      className={`project-option ${
                        index === highlightedProjectIndex ||
                        (highlightedProjectIndex === -1 && project === selectedProject)
                          ? "active"
                          : ""
                      }`}
                      ref={(element) => {
                        projectOptionRefs.current[project] = element;
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void onProjectSelect(project)}
                      onMouseEnter={() => setHighlightedProjectIndex(index)}
                    >
                      {project}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="control-bar search-control-bar search-control-bar-compact">
        <label className="field search-field">
          <span>Szukaj</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Nazwa pliku, kod, opis, ścieżka..."
          />
        </label>
      </div>
    </section>
  );
}
