import { useEffect, useMemo, useState } from "react";

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
  { key: "sourceKey", label: "Zrodlo", getValue: (file) => file.sourceKey },
  { key: "disciplineFolder", label: "Folder branzowy", getValue: (file) => file.disciplineFolder },
  { key: "extensionLabel", label: "Rozszerzenie", getValue: (file) => file.extensionLabel },
  { key: "phase", label: "Faza", getValue: (file) => file.parsedSegments?.phase ?? "Blednie nazwane" },
  { key: "disciplineCode", label: "Branza", getValue: (file) => file.parsedSegments?.disciplineCode ?? "Blednie nazwane" },
  { key: "documentType", label: "Typ", getValue: (file) => file.parsedSegments?.documentType ?? "Blednie nazwane" },
  { key: "level", label: "Poziom", getValue: (file) => file.parsedSegments?.level ?? "Blednie nazwane" },
  { key: "drawingNumber", label: "Numer rysunku", getValue: (file) => file.parsedSegments?.drawingNumber ?? "Blednie nazwane" },
  { key: "revision", label: "Rewizja", getValue: (file) => file.parsedSegments?.revision ?? "Blednie nazwane" },
  { key: "status", label: "Status", getValue: (file) => file.parsedSegments?.status ?? "Blednie nazwane" },
];

const INITIAL_FILTERS = Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, [] as string[]]));

function normalize(value: string) {
  return value.toLocaleLowerCase("pl");
}

function extractOptions(files: FileRecord[], group: FilterGroup) {
  const values = new Set<string>();
  files.forEach((file) => values.add(group.getValue(file)));
  return Array.from(values).sort((left, right) => left.localeCompare(right, "pl"));
}

export function App() {
  const [projectsRoot, setProjectsRoot] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>(INITIAL_FILTERS);

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
          : projectNames[0] ?? "";

      setSelectedProject(nextProject);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udalo sie wczytac listy projektow.");
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
          file.sourceKey,
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

  async function handleChooseRoot() {
    const settings = await window.fileFilterApi.chooseProjectsRoot();
    setProjectsRoot(settings.projectsRoot);
    setScanResult(null);
    setFilters(INITIAL_FILTERS);
    await refreshProjects();
  }

  async function handleScan() {
    if (!selectedProject) {
      return;
    }

    setScanning(true);
    setErrorMessage("");

    try {
      const result = await window.fileFilterApi.scanProject(selectedProject);
      setScanResult(result);
      setFilters(INITIAL_FILTERS);
      setSearchQuery("");
      setShowInvalidOnly(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udalo sie przeskanowac projektu.");
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

  const activeFilterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0);

  return (
    <div className="app-shell">
      <header className="hero-bar">
        <div>
          <p className="eyebrow">Ekoinbud</p>
          <h1>Filtr plikow projektowych</h1>
          <p className="hero-copy">
            Wybierz projekt, przeskanuj tylko foldery EDT i PDF, a potem filtruj pliki jak w slicerach Excela.
          </p>
        </div>

        <div className="hero-actions">
          <div className="meta-card">
            <span className="meta-label">Folder projektow</span>
            <strong title={projectsRoot || "Nie wybrano"}>{projectsRoot || "Nie wybrano folderu"}</strong>
          </div>
          <button className="secondary-button" onClick={handleChooseRoot}>
            Zmien folder
          </button>
        </div>
      </header>

      <section className="control-bar">
        <label className="field">
          <span>Projekt</span>
          <select
            value={selectedProject}
            onChange={(event) => setSelectedProject(event.target.value)}
            disabled={!projectsRoot || loadingProjects}
          >
            {projects.length === 0 && <option value="">Brak projektow</option>}
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>

        <button
          className="primary-button"
          onClick={handleScan}
          disabled={!selectedProject || scanning || loadingProjects}
        >
          {scanning ? "Skanowanie..." : "Skanuj projekt"}
        </button>

        <button className="ghost-button" onClick={() => void refreshProjects(selectedProject)}>
          Odswiez liste
        </button>

        <label className="field search-field">
          <span>Szukaj</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nazwa pliku, sciezka, folder..."
          />
        </label>

        <label className="toggle-card">
          <input
            type="checkbox"
            checked={showInvalidOnly}
            onChange={(event) => setShowInvalidOnly(event.target.checked)}
          />
          <span>Tylko blednie nazwane</span>
        </label>
      </section>

      {errorMessage && <div className="banner error">{errorMessage}</div>}
      {!projectsRoot && (
        <div className="banner warning">
          Przy pierwszym uruchomieniu wskaz folder <strong>ESP - Realizacje</strong>. Program zapamieta go na przyszlosc.
        </div>
      )}

      <main className="layout">
        <aside className="filters-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filtry</p>
              <h2>Slicery</h2>
            </div>
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
              <span>Bledne</span>
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
        </aside>

        <section className="results-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Wyniki</p>
              <h2>{scanResult ? scanResult.projectName : "Brak skanu"}</h2>
            </div>
            <div className="status-strip">
              <span>{filteredFiles.length} plikow po filtrach</span>
              {scanResult && <span>Skan: {new Date(scanResult.scannedAt).toLocaleString("pl-PL")}</span>}
            </div>
          </div>

          {scanResult?.missingFolders?.length ? (
            <div className="banner muted">
              Niektore oczekiwane foldery nie istnialy w projekcie. To nie blokuje dzialania programu, ale warto to sprawdzic.
            </div>
          ) : null}

          {!scanResult ? (
            <div className="empty-state">
              <h3>Program jest gotowy</h3>
              <p>Wybierz projekt i uruchom skanowanie. Zeskanujemy tylko foldery EDT/PDF oraz 6 glownych branz bez podfolderow.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plik</th>
                    <th>Poprawnosc</th>
                    <th>Zrodlo</th>
                    <th>Folder</th>
                    <th>Faza</th>
                    <th>Branza</th>
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
                        <div className="empty-inline">Brak plikow pasujacych do wybranych filtrow.</div>
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
                            {file.isValid ? "OK" : "Bledna nazwa"}
                          </span>
                          {!file.isValid && file.invalidReason ? (
                            <span className="muted-line">{file.invalidReason}</span>
                          ) : null}
                        </td>
                        <td>{file.sourceKey}</td>
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
                              Otworz plik
                            </button>
                            <button onClick={() => void window.fileFilterApi.openFolder(file.folderPath)}>
                              Otworz folder
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
