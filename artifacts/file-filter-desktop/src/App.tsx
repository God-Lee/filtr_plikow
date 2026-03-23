import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    fileFilterApi: {
      getSettings: () => Promise<{ projectsRoot: string }>;
      chooseProjectsRoot: () => Promise<{ projectsRoot: string }>;
      listProjects: () => Promise<string[]>;
      scanProject: (projectName: string) => Promise<ScanResult>;
      openFile: (targetPath: string) => Promise<void>;
      openFolder: (targetPath: string) => Promise<void>;
    };
  }
}

type FileRecord = {
  id: string;
  fileName: string;
  absolutePath: string;
  folderPath: string;
  projectName: string;
  projectNumber: string;
  sourceKey: "EDT" | "PDF";
  sourceLabel: string;
  disciplineFolder: string;
  extension: string;
  extensionLabel: string;
  baseName: string;
  isValid: boolean;
  invalidReason: string | null;
  rawSegments: string[];
  parsedSegments: ParsedSegments | null;
};

type ParsedSegments = {
  projectNumber: string;
  phase: string;
  disciplineCode: string;
  documentType: string;
  level: string;
  drawingNumber: string;
  revision: string;
  status: string;
};

type ScanResult = {
  projectName: string;
  projectPath: string;
  scannedAt: string;
  totalFiles: number;
  validCount: number;
  invalidCount: number;
  missingFolders: string[];
  files: FileRecord[];
};

type FilterGroup = {
  key: string;
  label: string;
  getValue: (file: FileRecord) => string;
};

const FILTER_GROUPS: FilterGroup[] = [
  { key: "sourceKey", label: "Typ plików", getValue: (file) => file.sourceLabel },
  { key: "extensionLabel", label: "Rozszerzenie", getValue: (file) => file.extensionLabel },
  { key: "phase", label: "Faza", getValue: (file) => file.parsedSegments?.phase ?? "Błędnie nazwane" },
  { key: "disciplineCode", label: "Branża", getValue: (file) => file.parsedSegments?.disciplineCode ?? "Błędnie nazwane" },
  { key: "documentType", label: "Typ", getValue: (file) => file.parsedSegments?.documentType ?? "Błędnie nazwane" },
  { key: "level", label: "Poziom", getValue: (file) => file.parsedSegments?.level ?? "Błędnie nazwane" },
  { key: "drawingNumber", label: "Numer rysunku", getValue: (file) => file.parsedSegments?.drawingNumber ?? "Błędnie nazwane" },
  { key: "revision", label: "Rewizja", getValue: (file) => file.parsedSegments?.revision ?? "Błędnie nazwane" },
  { key: "status", label: "Status", getValue: (file) => file.parsedSegments?.status ?? "Błędnie nazwane" },
];

const INITIAL_FILTERS = Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, [] as string[]]));

function normalize(value: string) {
  return value.toLocaleLowerCase("pl");
}

function extractOptions(files: FileRecord[], group: FilterGroup) {
  const values = new Set<string>();
  files.forEach((file) => values.add(group.getValue(file)));

  const options = Array.from(values);
  if (group.key === "sourceKey") {
    const sourceOrder = ["PDF", "Pozostałe"];
    return options.sort((left, right) => sourceOrder.indexOf(left) - sourceOrder.indexOf(right));
  }

  return options.sort((left, right) => left.localeCompare(right, "pl"));
}

export function App() {
  const [projectsRoot, setProjectsRoot] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>(INITIAL_FILTERS);
  const projectPickerRef = useRef<HTMLDivElement | null>(null);

  async function refreshProjects(preferredProject?: string) {
    setLoadingProjects(true);
    setErrorMessage("");

    try {
      const [settings, projectNames] = await Promise.all([
        window.fileFilterApi.getSettings(),
        window.fileFilterApi.listProjects(),
      ]);

      setProjectsRoot(settings.projectsRoot);
      setProjects(projectNames);

      const nextProject =
        preferredProject && projectNames.includes(preferredProject)
          ? preferredProject
          : "";

      setSelectedProject(nextProject);
      setProjectQuery(nextProject);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się wczytać listy projektów.");
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  const filterOptions = useMemo(() => {
    const files = scanResult?.files ?? [];
    return Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, extractOptions(files, group)]));
  }, [scanResult]);

  const filteredProjects = useMemo(() => {
    const query = normalize(projectQuery.trim());
    const selectedQuery = normalize(selectedProject.trim());

    if (!query || query === selectedQuery) {
      return projects;
    }

    return projects.filter((project) => normalize(project).includes(query));
  }, [projectQuery, projects, selectedProject]);

  const filteredFiles = useMemo(() => {
    const files = scanResult?.files ?? [];
    const query = normalize(searchQuery.trim());

    return files.filter((file) => {
      if (showInvalidOnly && file.isValid) {
        return false;
      }

      if (query) {
        const searchable = [
          file.fileName,
          file.disciplineFolder,
          file.sourceLabel,
          file.absolutePath,
          file.invalidReason ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("pl");

        if (!searchable.includes(query)) {
          return false;
        }
      }

      for (const group of FILTER_GROUPS) {
        const selectedValues = filters[group.key] ?? [];
        if (selectedValues.length === 0) {
          continue;
        }

        const candidate = group.getValue(file);
        if (!selectedValues.includes(candidate)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, scanResult, searchQuery, showInvalidOnly]);

  useEffect(() => {
    if (filteredProjects.length === 0) {
      return;
    }

    if (!filteredProjects.includes(selectedProject)) {
      setSelectedProject("");
    }
  }, [filteredProjects, selectedProject]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!projectPickerRef.current?.contains(event.target as Node)) {
        setProjectPickerOpen(false);
        setProjectQuery(selectedProject);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [selectedProject]);

  async function handleChooseRoot() {
    const settings = await window.fileFilterApi.chooseProjectsRoot();
    setProjectsRoot(settings.projectsRoot);
    setScanResult(null);
    setFilters(INITIAL_FILTERS);
    setProjectQuery("");
    setProjectPickerOpen(false);
    await refreshProjects();
  }

  async function runScan(projectName: string) {
    if (!projectName) {
      return;
    }

    setScanning(true);
    setErrorMessage("");

    try {
      const result = await window.fileFilterApi.scanProject(projectName);
      setScanResult(result);
      setFilters(INITIAL_FILTERS);
      setSearchQuery("");
      setShowInvalidOnly(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się przeskanować projektu.");
    } finally {
      setScanning(false);
    }
  }

  function toggleFilter(filterKey: string, value: string) {
    setFilters((current) => {
      const active = current[filterKey] ?? [];
      const next = active.includes(value)
        ? active.filter((item) => item !== value)
        : [...active, value];

      return {
        ...current,
        [filterKey]: next,
      };
    });
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
    setSearchQuery("");
    setShowInvalidOnly(false);
  }

  async function handleProjectSelect(project: string) {
    setSelectedProject(project);
    setProjectQuery(project);
    setProjectPickerOpen(false);
    await runScan(project);
  }

  async function handleRefreshCurrentProject() {
    if (!selectedProject) {
      return;
    }

    await runScan(selectedProject);
  }

  const activeFilterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0);

  return (
    <div className="app-shell">
      <header className="hero-bar">
        <div>
          <p className="eyebrow">Ekoinbud</p>
          <h1>Filtr plików projektowych</h1>
        </div>
      </header>

      <section className="control-bar">
        <div className="field project-picker-field" ref={projectPickerRef}>
          <span>Projekt</span>
          <div className={`project-picker ${projectPickerOpen ? "open" : ""}`}>
            <input
              value={projectQuery}
              onFocus={() => {
                setProjectPickerOpen(true);
                setProjectQuery("");
              }}
              onChange={(event) => {
                setProjectQuery(event.target.value);
                setProjectPickerOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setProjectPickerOpen(false);
                  setProjectQuery(selectedProject);
                }

                if (event.key === "Enter" && filteredProjects.length > 0) {
                  event.preventDefault();
                  void handleProjectSelect(filteredProjects[0]);
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
                    setProjectQuery("");
                  }
                  return next;
                });
              }}
              aria-label={projectPickerOpen ? "Zwiń listę projektów" : "Rozwiń listę projektów"}
              disabled={!projectsRoot || loadingProjects}
            >
              ▾
            </button>

            {projectPickerOpen && (
              <div className="project-picker-menu">
                {filteredProjects.length === 0 ? (
                  <div className="project-picker-empty">Brak pasujących projektów.</div>
                ) : (
                  filteredProjects.map((project) => (
                    <button
                      key={project}
                      type="button"
                      className={`project-option ${project === selectedProject ? "active" : ""}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void handleProjectSelect(project)}
                    >
                      {project}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <button
          className="ghost-button"
          onClick={() => void handleRefreshCurrentProject()}
          disabled={!selectedProject || scanning || loadingProjects}
        >
          {scanning ? "Odświeżanie..." : "Odśwież"}
        </button>

        <label className="field search-field">
          <span>Szukaj</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nazwa pliku, ścieżka, folder..."
          />
        </label>

        <button className="secondary-button secondary-button-light" onClick={handleChooseRoot}>
          Zmień folder
        </button>
      </section>

      {errorMessage && <div className="banner error">{errorMessage}</div>}
      {!projectsRoot && (
        <div className="banner warning">
          Przy pierwszym uruchomieniu wskaż folder <strong>ESP - Realizacje</strong>. Program zapamięta go na przyszłość.
        </div>
      )}

      <main className="layout">
        <aside className="filters-panel">
          <div className="panel-header">
            <h2 className="filters-title">Filtry</h2>
            <button className="link-button" onClick={clearFilters}>
              Resetuj
            </button>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <span>Wszystkie</span>
              <strong>{scanResult?.totalFiles ?? 0}</strong>
            </article>
            <article className="summary-card">
              <span>Poprawne</span>
              <strong>{scanResult?.validCount ?? 0}</strong>
            </article>
            <article className="summary-card invalid">
              <span>Błędne</span>
              <strong>{scanResult?.invalidCount ?? 0}</strong>
            </article>
            <article className="summary-card">
              <span>Aktywne filtry</span>
              <strong>{activeFilterCount + (showInvalidOnly ? 1 : 0)}</strong>
            </article>
          </div>

          <div className="filter-groups">
            {FILTER_GROUPS.map((group) => {
              const options = filterOptions[group.key] ?? [];
              const selectedValues = filters[group.key] ?? [];

              return (
                <section className="filter-group" key={group.key}>
                  <div className="filter-group-header">
                    <h3>{group.label}</h3>
                    <span>{selectedValues.length}</span>
                  </div>

                  <div className="chip-grid">
                    {options.length === 0 && <p className="empty-copy">Brak danych po skanowaniu.</p>}
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
                </section>
              );
            })}
          </div>

          <label className="toggle-card filter-toggle-card">
            <input
              type="checkbox"
              checked={showInvalidOnly}
              onChange={(event) => setShowInvalidOnly(event.target.checked)}
            />
            <span>Tylko błędnie nazwane</span>
          </label>
        </aside>

        <section className="results-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Wyniki</p>
              <h2>{scanResult ? scanResult.projectName : "Brak skanu"}</h2>
            </div>
            <div className="status-strip">
              <span>{filteredFiles.length} plików po filtrach</span>
              {scanResult && <span>Skan: {new Date(scanResult.scannedAt).toLocaleString("pl-PL")}</span>}
            </div>
          </div>

          {scanResult?.missingFolders?.length ? (
            <div className="banner muted">
              Niektóre oczekiwane foldery nie istniały w projekcie. To nie blokuje działania programu, ale warto to sprawdzić.
            </div>
          ) : null}

          {!scanResult ? (
            <div className="empty-state">
              <h3>Program jest gotowy</h3>
              <p>Wybierz projekt. Skanowanie uruchomi się automatycznie i obejmie tylko foldery EDT i PDF oraz 6 głównych branż bez podfolderów.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plik</th>
                    <th>Poprawność</th>
                    <th>Typ plików</th>
                    <th>Folder</th>
                    <th>Faza</th>
                    <th>Branża</th>
                    <th>Typ</th>
                    <th>Poziom</th>
                    <th>Nr rysunku</th>
                    <th>Rewizja</th>
                    <th>Status</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={12}>
                        <div className="empty-inline">Brak plików pasujących do wybranych filtrów.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file) => (
                      <tr key={file.id} className={file.isValid ? "" : "invalid-row"}>
                        <td>
                          <div className="file-cell">
                            <strong>{file.fileName}</strong>
                            <span title={file.absolutePath}>{file.absolutePath}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${file.isValid ? "valid" : "invalid"}`}>
                            {file.isValid ? "OK" : "Błędna nazwa"}
                          </span>
                          {!file.isValid && file.invalidReason ? (
                            <span className="muted-line">{file.invalidReason}</span>
                          ) : null}
                        </td>
                        <td>{file.sourceLabel}</td>
                        <td>{file.disciplineFolder}</td>
                        <td>{file.parsedSegments?.phase ?? "-"}</td>
                        <td>{file.parsedSegments?.disciplineCode ?? "-"}</td>
                        <td>{file.parsedSegments?.documentType ?? "-"}</td>
                        <td>{file.parsedSegments?.level ?? "-"}</td>
                        <td>{file.parsedSegments?.drawingNumber ?? "-"}</td>
                        <td>{file.parsedSegments?.revision ?? "-"}</td>
                        <td>{file.parsedSegments?.status ?? "-"}</td>
                        <td>
                          <div className="actions">
                            <button onClick={() => void window.fileFilterApi.openFile(file.absolutePath)}>
                              Otwórz plik
                            </button>
                            <button onClick={() => void window.fileFilterApi.openFolder(file.folderPath)}>
                              Otwórz folder
                            </button>
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
      </main>
    </div>
  );
}
