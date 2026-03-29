import { Suspense, lazy, useState } from "react";
import type { AppView } from "./app/types";
import { FilterView } from "./features/filter/FilterView";
import { useFilterWorkspace } from "./features/filter/useFilterWorkspace";

const NamingView = lazy(async () => {
  const module = await import("./NamingView");
  return { default: module.NamingView };
});

export function App() {
  const [activeView, setActiveView] = useState<AppView>("filter");
  const workspace = useFilterWorkspace();

  return (
    <div className="app-shell">
      <header className="hero-bar">
        <div>
          <p className="eyebrow">Ekoinbud</p>
          <h1>Filtr plików projektowych</h1>
        </div>

        {activeView === "filter" ? (
          <div className="hero-favorites" aria-label="Ulubione projekty">
            {workspace.visibleFavoriteProjects.map((favoriteProject) => (
              <button
                key={favoriteProject.projectName}
                type="button"
                className={`favorite-project-card ${
                  favoriteProject.projectName === workspace.selectedProject ? "active" : ""
                }`}
                onClick={() => void workspace.handleProjectSelect(favoriteProject.projectName)}
              >
                <strong>{favoriteProject.number}</strong>
                <span>{favoriteProject.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="hero-spacer" aria-hidden="true" />
        )}

        <div className="hero-actions">
          <button
            className={`secondary-button ${activeView === "filter" ? "active" : ""}`}
            onClick={() => setActiveView("filter")}
          >
            Filtr
          </button>
          <button
            className={`secondary-button ${activeView === "naming" ? "active" : ""}`}
            onClick={() => setActiveView("naming")}
          >
            Nazywanie
          </button>
        </div>
      </header>

      <div className={`app-content-scroll ${activeView === "filter" ? "filter-view-scroll" : ""}`}>
        {activeView === "filter" ? (
          <FilterView workspace={workspace} />
        ) : (
          <Suspense
            fallback={
              <div className="empty-state empty-state-compact">
                <h3>Ładowanie widoku nazewnictwa...</h3>
              </div>
            }
          >
            <NamingView selectedProjectName={workspace.selectedProject} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
