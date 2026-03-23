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

const EXTENSION_GROUP_LABELS: Record<string, string> = {
  ".doc": "Word",
  ".docx": "Word",
  ".xls": "Excel",
  ".xlsx": "Excel",
  ".dwg": "CAD",
  ".jpg": "Obraz",
  ".jpeg": "Obraz",
  ".png": "Obraz",
};

const PHASE_LABELS: Record<string, string> = {
  CR: "CR - Koordynacja",
  DP: "DP - Dokumentacja Powykonawcza",
  IN: "IN - Inwentaryzacja",
  PB: "PB - Projekt Arch-Bud, PZT",
  PF: "PF - Program Funkcjonalno-Użytkowy",
  PK: "PK - Projekt Koncepcyjny",
  PT: "PT - Projekt Techniczny",
  PW: "PW - Projekt Wykonawczy",
  PZ: "PZ - Projekt zamienny",
  RO: "RO - Projekt rozbiórek",
  WD: "WD - Wdrożenie",
  ZL: "ZL - Dokumenty formalne, załączniki",
};

const DISCIPLINE_LABELS: Record<string, string> = {
  AK: "AK - Architektura krajobrazu",
  AR: "AR - Architektura",
  AW: "AW - Projekt wnętrz",
  CR: "CR - Koordynacja",
  DR: "DR - Drogowa",
  EL: "EL - Instalacje elektryczne",
  ET: "ET - instalacje teletechniczne",
  GE: "GE - Geodezja",
  GT: "GT - Geotechnika / geologia",
  KF: "KF - Konstrukcja fundamentów",
  KO: "KO - Konstrukcja",
  KP: "KP - Konstrukcja pali",
  KW: "KW - Konstrukcja wiązarów",
  PO: "PO - pożarowe ogólne",
  PS: "PS - SSP, Dso",
  SA: "SA - Instalacje Sanitarne",
  SD: "SD - Instalacje wodociągowe",
  SG: "SG - Instalacja gazowa",
  SK: "SK - Instalacja kanalizacyjna",
  SO: "SO - instalacje ogrzewania",
  SW: "SW - Wentylacja i Klimatyzacja",
  TK: "TK - Technologia kuchni",
  XX: "XX - Nie dotyczy/wiele branż",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  AOP: "AOP - Analiza optymalizacyjno-porównawcza",
  BIO: "BIO - BIOZ",
  BWD: "BWD - Bilans wód deszczowych",
  CHE: "CHE - Charakterystyka energetyczna",
  CSE: "CSE - Przekrój",
  DET: "DET - Detal",
  ELE: "ELE - Elewacje",
  IFC: "IFC - Plik IFC",
  INN: "INN - Inne",
  KST: "KST - Kosztorys",
  MAP: "MAP - Mapa",
  MOD: "MOD - Model",
  OBR: "OBR - Obrazek, logo",
  OPP: "OPP - Opis projektu",
  OPZ: "OPZ - Opis PZT",
  ORR: "ORR - Organizacja ruchu (SOR/TOR)",
  PDW: "PDW - Przygotowanie do wdrożenia",
  PRD: "PRD - Przedmiar",
  PRF: "PRF - Profil",
  PRO: "PRO - Projekt",
  PZT: "PZT - PZT, model PZT",
  RFU: "RFU - Rzut fundamentów",
  ROG: "ROG - Rzut ogólny",
  RPO: "RPO - Rzut posadzek",
  RSU: "RSU - Rzut sufitów",
  SCH: "SCH - Rozwinięcia/schemat",
  STT: "STT - Strona tytułowa",
  STW: "STW - Stwiorb",
  VIS: "VIS - Wizualizacja",
  ZJA: "ZJA - Projekt zjazdu",
  ZSA: "ZSA - Spis arkuszy",
  ZSD: "ZSD - Zestawienie stolarki drzwiowej",
  ZSO: "ZSO - Zestawienie stolarki okiennej",
  ZST: "ZST - Zestawienie",
  ZSW: "ZSW - Zestawienie witryn",
};

const LEVEL_LABELS: Record<string, string> = {
  P0: "P0 - Parter",
  P1: "P1 - Piętro 1",
  P2: "P2 - Piętro 2",
  M0: "M0 - Półpiętro nad parterem",
  M1: "M1 - Półpiętro nad 1 piętrem",
  D0: "D0 - Dach",
  B1: "B1 - Pierwsza kondygnacja podziemna",
  B2: "B2 - Druga kondygnacja podziemna",
  XX: "XX - Nie dotyczy/wiele poziomów",
};

const REVISION_LABELS: Record<string, string> = {
  R00: "R00 - Rewizja zerowa",
  R01: "R01 - pierwsza rewizja",
  W01: "W01 - pierwsza wersja koncepcji (domyślna)",
  W0X: "W0X - kolejne wersje koncepcji",
};

const STATUS_LABELS: Record<string, string> = {
  S0: "S0 - plik roboczy",
  S1: "S1 - wersja robocza, tylko do koordynacji międzybranżowej",
  S2: "S2 - wersja robocza, wydana do zatwierdzenia",
  A1: "A1 - wersja zatwierdzona, na potrzeby budowy",
};

function getMappedFilterLabel(value: string | undefined, labels: Record<string, string>) {
  if (!value) {
    return "Błędnie nazwane";
  }

  return labels[value] ?? "Błędnie nazwane";
}

function getExtensionFilterLabel(file: FileRecord) {
  return EXTENSION_GROUP_LABELS[file.extension] ?? file.extensionLabel.replace(/^\./, "").toUpperCase();
}

function getPhaseFilterLabel(file: FileRecord) {
  return getMappedFilterLabel(file.parsedSegments?.phase, PHASE_LABELS);
}

function getDisciplineFilterLabel(file: FileRecord) {
  return getMappedFilterLabel(file.parsedSegments?.disciplineCode, DISCIPLINE_LABELS);
}

function getDocumentTypeFilterLabel(file: FileRecord) {
  return getMappedFilterLabel(file.parsedSegments?.documentType, DOCUMENT_TYPE_LABELS);
}

function getLevelFilterLabel(file: FileRecord) {
  return getMappedFilterLabel(file.parsedSegments?.level, LEVEL_LABELS);
}

function getRevisionFilterLabel(file: FileRecord) {
  return getMappedFilterLabel(file.parsedSegments?.revision, REVISION_LABELS);
}

function getStatusFilterLabel(file: FileRecord) {
  return getMappedFilterLabel(file.parsedSegments?.status, STATUS_LABELS);
}

const FILTER_GROUPS: FilterGroup[] = [
  { key: "sourceKey", label: "Typ plików", getValue: (file) => file.sourceLabel },
  { key: "extensionLabel", label: "Rozszerzenie", getValue: (file) => getExtensionFilterLabel(file) },
  { key: "phase", label: "Faza", getValue: (file) => getPhaseFilterLabel(file) },
  { key: "disciplineCode", label: "Branża", getValue: (file) => getDisciplineFilterLabel(file) },
  { key: "documentType", label: "Typ", getValue: (file) => getDocumentTypeFilterLabel(file) },
  { key: "level", label: "Poziom", getValue: (file) => getLevelFilterLabel(file) },
  { key: "revision", label: "Rewizja", getValue: (file) => getRevisionFilterLabel(file) },
  { key: "status", label: "Status", getValue: (file) => getStatusFilterLabel(file) },
];

const INITIAL_FILTERS = Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, [] as string[]]));
const INITIAL_EXPANDED_GROUPS = Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, true]));

function normalize(value: string) {
  return value.toLocaleLowerCase("pl");
}

function sortWithInvalidLast(options: string[], preferredOrder?: string[]) {
  return [...options].sort((left, right) => {
    if (left === "Błędnie nazwane") {
      return right === "Błędnie nazwane" ? 0 : 1;
    }

    if (right === "Błędnie nazwane") {
      return -1;
    }

    if (preferredOrder) {
      const leftIndex = preferredOrder.indexOf(left);
      const rightIndex = preferredOrder.indexOf(right);

      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) {
          return 1;
        }

        if (rightIndex === -1) {
          return -1;
        }

        return leftIndex - rightIndex;
      }
    }

    return left.localeCompare(right, "pl");
  });
}

function extractOptions(files: FileRecord[], group: FilterGroup) {
  const values = new Set<string>();
  files.forEach((file) => values.add(group.getValue(file)));

  const options = Array.from(values);
  if (group.key === "sourceKey") {
    const sourceOrder = ["PDF", "Pozostałe"];
    return options.sort((left, right) => sourceOrder.indexOf(left) - sourceOrder.indexOf(right));
  }

  if (group.key === "extensionLabel") {
    const extensionOrder = ["Word", "Excel", "CAD", "Obraz"];
    return sortWithInvalidLast(options, extensionOrder);
  }

  if (group.key === "phase") {
    const phaseOrder = [
      "CR - Koordynacja",
      "DP - Dokumentacja Powykonawcza",
      "IN - Inwentaryzacja",
      "PB - Projekt Arch-Bud, PZT",
      "PF - Program Funkcjonalno-Użytkowy",
      "PK - Projekt Koncepcyjny",
      "PT - Projekt Techniczny",
      "PW - Projekt Wykonawczy",
      "PZ - Projekt zamienny",
      "RO - Projekt rozbiórek",
      "WD - Wdrożenie",
      "ZL - Dokumenty formalne, załączniki",
    ];

    return sortWithInvalidLast(options, phaseOrder);
  }

  if (group.key === "disciplineCode") {
    const disciplineOrder = [
      "AK - Architektura krajobrazu",
      "AR - Architektura",
      "AW - Projekt wnętrz",
      "CR - Koordynacja",
      "DR - Drogowa",
      "EL - Instalacje elektryczne",
      "ET - instalacje teletechniczne",
      "GE - Geodezja",
      "GT - Geotechnika / geologia",
      "KF - Konstrukcja fundamentów",
      "KO - Konstrukcja",
      "KP - Konstrukcja pali",
      "KW - Konstrukcja wiązarów",
      "PO - pożarowe ogólne",
      "PS - SSP, Dso",
      "SA - Instalacje Sanitarne",
      "SD - Instalacje wodociągowe",
      "SG - Instalacja gazowa",
      "SK - Instalacja kanalizacyjna",
      "SO - instalacje ogrzewania",
      "SW - Wentylacja i Klimatyzacja",
      "TK - Technologia kuchni",
      "XX - Nie dotyczy/wiele branż",
    ];

    return sortWithInvalidLast(options, disciplineOrder);
  }

  if (group.key === "documentType") {
    const documentTypeOrder = [
      "AOP - Analiza optymalizacyjno-porównawcza",
      "BIO - BIOZ",
      "BWD - Bilans wód deszczowych",
      "CHE - Charakterystyka energetyczna",
      "CSE - Przekrój",
      "DET - Detal",
      "ELE - Elewacje",
      "IFC - Plik IFC",
      "INN - Inne",
      "KST - Kosztorys",
      "MAP - Mapa",
      "MOD - Model",
      "OBR - Obrazek, logo",
      "OPP - Opis projektu",
      "OPZ - Opis PZT",
      "ORR - Organizacja ruchu (SOR/TOR)",
      "PDW - Przygotowanie do wdrożenia",
      "PRD - Przedmiar",
      "PRF - Profil",
      "PRO - Projekt",
      "PZT - PZT, model PZT",
      "RFU - Rzut fundamentów",
      "ROG - Rzut ogólny",
      "RPO - Rzut posadzek",
      "RSU - Rzut sufitów",
      "SCH - Rozwinięcia/schemat",
      "STT - Strona tytułowa",
      "STW - Stwiorb",
      "VIS - Wizualizacja",
      "ZJA - Projekt zjazdu",
      "ZSA - Spis arkuszy",
      "ZSD - Zestawienie stolarki drzwiowej",
      "ZSO - Zestawienie stolarki okiennej",
      "ZST - Zestawienie",
      "ZSW - Zestawienie witryn",
    ];

    return sortWithInvalidLast(options, documentTypeOrder);
  }

  if (group.key === "level") {
    const levelOrder = [
      "P0 - Parter",
      "P1 - Piętro 1",
      "P2 - Piętro 2",
      "M0 - Półpiętro nad parterem",
      "M1 - Półpiętro nad 1 piętrem",
      "D0 - Dach",
      "B1 - Pierwsza kondygnacja podziemna",
      "B2 - Druga kondygnacja podziemna",
      "XX - Nie dotyczy/wiele poziomów",
    ];

    return sortWithInvalidLast(options, levelOrder);
  }

  if (group.key === "revision") {
    const revisionOrder = [
      "R00 - Rewizja zerowa",
      "R01 - pierwsza rewizja",
      "W01 - pierwsza wersja koncepcji (domyślna)",
      "W0X - kolejne wersje koncepcji",
    ];

    return sortWithInvalidLast(options, revisionOrder);
  }

  if (group.key === "status") {
    const statusOrder = [
      "S0 - plik roboczy",
      "S1 - wersja robocza, tylko do koordynacji międzybranżowej",
      "S2 - wersja robocza, wydana do zatwierdzenia",
      "A1 - wersja zatwierdzona, na potrzeby budowy",
    ];

    return sortWithInvalidLast(options, statusOrder);
  }

  return sortWithInvalidLast(options);
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(INITIAL_EXPANDED_GROUPS);
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

  const shouldHideExtensionFilter =
    (filters.sourceKey?.length ?? 0) === 1 && filters.sourceKey?.[0] === "PDF";
  const shouldRemovePdfExtensionOption =
    (filters.sourceKey?.length ?? 0) === 1 && filters.sourceKey?.[0] === "Pozostałe";

  const filterOptions = useMemo(() => {
    const files = scanResult?.files ?? [];
    const nextOptions = Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, extractOptions(files, group)]));

    if (shouldRemovePdfExtensionOption) {
      nextOptions.extensionLabel = (nextOptions.extensionLabel ?? []).filter((option) => option !== "PDF");
    }

    return nextOptions;
  }, [scanResult, shouldRemovePdfExtensionOption]);

  const visibleFilterGroups = useMemo(
    () => FILTER_GROUPS.filter((group) => !(group.key === "extensionLabel" && shouldHideExtensionFilter)),
    [shouldHideExtensionFilter],
  );

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

      for (const group of visibleFilterGroups) {
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
  }, [filters, scanResult, searchQuery, showInvalidOnly, visibleFilterGroups]);

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

  useEffect(() => {
    const selectedExtensions = filters.extensionLabel ?? [];
    const availableExtensions = new Set(filterOptions.extensionLabel ?? []);

    if (!shouldHideExtensionFilter && selectedExtensions.every((value) => availableExtensions.has(value))) {
      return;
    }

    setFilters((current) => ({
      ...current,
      extensionLabel: (current.extensionLabel ?? []).filter((value) => availableExtensions.has(value)),
    }));
  }, [filterOptions.extensionLabel, filters.extensionLabel, shouldHideExtensionFilter]);

  async function handleChooseRoot() {
    const settings = await window.fileFilterApi.chooseProjectsRoot();
    setProjectsRoot(settings.projectsRoot);
    setScanResult(null);
    setFilters(INITIAL_FILTERS);
    setExpandedGroups(INITIAL_EXPANDED_GROUPS);
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
      setExpandedGroups(INITIAL_EXPANDED_GROUPS);
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

      setExpandedGroups((currentExpanded) => ({
        ...currentExpanded,
        [filterKey]:
          filterKey === "sourceKey"
            ? next.length === 0
            : currentExpanded[filterKey],
      }));

      return {
        ...current,
        [filterKey]: next,
      };
    });
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
    setExpandedGroups(INITIAL_EXPANDED_GROUPS);
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

        <div className="hero-actions">
          <button className="secondary-button" onClick={handleChooseRoot}>
            Zmień folder
          </button>
        </div>
      </header>

      <section className="controls-layout">
        <div className="project-bar">
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
        </div>

        <div className="control-bar search-control-bar">
          <label className="field search-field">
            <span>Szukaj</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Nazwa pliku, ścieżka, folder..."
            />
          </label>

          <button
            className="ghost-button"
            onClick={() => void handleRefreshCurrentProject()}
            disabled={!selectedProject || scanning || loadingProjects}
          >
            {scanning ? "Odświeżanie..." : "Odśwież"}
          </button>
        </div>
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
                  ) : null}
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
          {scanResult ? (
            <div className="panel-header">
              <div>
                <p className="eyebrow">Wyniki</p>
                <h2>{scanResult.projectName}</h2>
              </div>
              <div className="status-strip">
                <span>{filteredFiles.length} plików po filtrach</span>
                <span>Skan: {new Date(scanResult.scannedAt).toLocaleString("pl-PL")}</span>
              </div>
            </div>
          ) : null}

          {scanResult?.missingFolders?.length ? (
            <div className="banner muted">
              Niektóre oczekiwane foldery nie istniały w projekcie. To nie blokuje działania programu, ale warto to sprawdzić.
            </div>
          ) : null}

          {!scanResult ? (
            <div className="empty-state empty-state-compact">
              <h3>Wybierz projekt</h3>
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
