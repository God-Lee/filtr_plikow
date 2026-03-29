import { useEffect, useMemo, useRef, useState } from "react";
import { NamingView } from "./NamingView";
import namingStandards from "../shared/naming-standards.json";

declare global {
  interface Window {
    fileFilterApi: {
      getSettings: () => Promise<AppSettings>;
      chooseProjectsRoot: () => Promise<AppSettings>;
      updateFavoriteProjects: (favoriteProjects: string[]) => Promise<AppSettings>;
      updateNamingViewDraft: (namingViewDraft: NamingViewDraft) => Promise<AppSettings>;
      listProjects: () => Promise<string[]>;
      scanProject: (projectName: string) => Promise<ScanResult>;
      exportInvalidFilesReport: (
        files: Array<{ fileName: string; disciplineFolder: string }>,
      ) => Promise<{ saved: boolean; reportPath: string | null }>;
      chooseDirectory: (title: string) => Promise<string | null>;
      listNamingFiles: (folderPath: string) => Promise<{
        files: Array<{
          id: string;
          fileName: string;
          absolutePath: string;
          folderPath: string;
          relativePath: string;
          extension: string;
          baseName: string;
        }>;
        ignoredCount: number;
        totalCount: number;
      }>;
      copyNamingFiles: (
        items: Array<{ sourcePath: string; targetPath: string; overwriteExisting?: boolean }>,
      ) => Promise<{ copiedCount: number }>;
      openFile: (targetPath: string) => Promise<void>;
      openFolder: (targetPath: string) => Promise<void>;
    };
  }
}

type AppSettings = {
  projectsRoot: string;
  favoriteProjects: string[];
  namingViewDraft: NamingViewDraft;
};

type NamingViewDraft = {
  projectNumber: string;
  phaseInput: string;
  disciplineInput: string;
  defaultRevision: string;
  defaultRevisionInput: string;
  defaultStatus: string;
  workingFolder: string;
  targetFolder: string;
  ignoredSourcePathsByFolder: Record<string, string[]>;
};

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
  projectNumber: string | null;
  phase: string | null;
  disciplineCode: string | null;
  documentType: string | null;
  level: string | null;
  drawingNumber: string | null;
  revision: string | null;
  status: string | null;
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

type SortDirection = "asc" | "desc";

type SortKey =
  | "fileName"
  | "isValid"
  | "phase"
  | "disciplineCode"
  | "documentType"
  | "level"
  | "drawingNumber"
  | "revision"
  | "status";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

type FavoriteProjectCard = {
  projectName: string;
  number: string;
  label: string;
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

const PHASE_LABELS: Record<string, string> = namingStandards.phases;
const DISCIPLINE_LABELS: Record<string, string> = namingStandards.disciplines;
const DOCUMENT_TYPE_LABELS: Record<string, string> = namingStandards.documentTypes;
const LEVEL_LABELS: Record<string, string> = namingStandards.levels;
const REVISION_LABELS: Record<string, string> = buildRevisionLabels();
const STATUS_LABELS: Record<string, string> = namingStandards.statuses;

function buildRevisionLabels() {
  const labels: Record<string, string> = {
    R00: 'R00 - rewizja "zerowa" (domyślna)',
    W01: "W01 - pierwsza wersja koncepcji (domyślna)",
  };

  for (let index = 0; index <= 99; index += 1) {
    const code = `R${String(index).padStart(2, "0")}`;
    labels[code] ??= code;
  }

  for (let index = 1; index <= 99; index += 1) {
    const code = `W${String(index).padStart(2, "0")}`;
    labels[code] ??= code;
  }

  return labels;
}

function getMappedFilterLabel(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) {
    return "Błędnie nazwane";
  }

  return labels[value] ?? "Błędnie nazwane";
}

function isRevisionCodeValid(revision: string | undefined) {
  return /^R\d{2}$/.test(revision ?? "") || (/^W\d{2}$/.test(revision ?? "") && revision !== "W00");
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
  const revision = file.parsedSegments?.revision;
  if (!revision) {
    return "Błędnie nazwane";
  }

  return REVISION_LABELS[revision] ?? (isRevisionCodeValid(revision) ? revision : "Błędnie nazwane");
}

function getStatusFilterLabel(file: FileRecord) {
  return getMappedFilterLabel(file.parsedSegments?.status, STATUS_LABELS);
}

function getValidationLabel(file: FileRecord) {
  if (file.isValid) {
    return "OK";
  }

  return file.invalidReason === "Błędna lokalizacja" ? "Błędna lokalizacja" : "Błędna nazwa";
}

function getSortValue(file: FileRecord, sortKey: SortKey) {
  switch (sortKey) {
    case "fileName":
      return file.fileName;
    case "isValid":
      return getValidationLabel(file);
    case "phase":
      return file.parsedSegments?.phase ?? "";
    case "disciplineCode":
      return file.parsedSegments?.disciplineCode ?? "";
    case "documentType":
      return file.parsedSegments?.documentType ?? "";
    case "level":
      return file.parsedSegments?.level ?? "";
    case "drawingNumber":
      return file.parsedSegments?.drawingNumber ?? "";
    case "revision":
      return file.parsedSegments?.revision ?? "";
    case "status":
      return file.parsedSegments?.status ?? "";
    default:
      return "";
  }
}

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: "fileName", label: "Plik", className: "column-file" },
  { key: "isValid", label: "Poprawność", className: "column-status" },
  { key: "phase", label: "Faza" },
  { key: "disciplineCode", label: "Branża" },
  { key: "documentType", label: "Typ" },
  { key: "level", label: "Poziom" },
  { key: "drawingNumber", label: "Nr rysunku" },
  { key: "revision", label: "Rewizja" },
  { key: "status", label: "Status" },
];

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
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl");
}

function tokenizeSearchText(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function matchesSearchToken(queryToken: string, searchableToken: string) {
  if (searchableToken.includes(queryToken)) {
    return true;
  }

  if (
    queryToken.length >= 4 &&
    searchableToken.length >= 4 &&
    queryToken.startsWith(searchableToken) &&
    queryToken.length - searchableToken.length <= 2
  ) {
    return true;
  }

  if (searchableToken.length >= 4 && searchableToken.startsWith(queryToken)) {
    return true;
  }

  return false;
}

function getParsedSegmentLabels(file: FileRecord) {
  return [
    file.parsedSegments?.phase ? PHASE_LABELS[file.parsedSegments.phase] ?? file.parsedSegments.phase : "",
    file.parsedSegments?.disciplineCode
      ? DISCIPLINE_LABELS[file.parsedSegments.disciplineCode] ?? file.parsedSegments.disciplineCode
      : "",
    file.parsedSegments?.documentType
      ? DOCUMENT_TYPE_LABELS[file.parsedSegments.documentType] ?? file.parsedSegments.documentType
      : "",
    file.parsedSegments?.level ? LEVEL_LABELS[file.parsedSegments.level] ?? file.parsedSegments.level : "",
    file.parsedSegments?.revision
      ? REVISION_LABELS[file.parsedSegments.revision] ?? file.parsedSegments.revision
      : "",
    file.parsedSegments?.status ? STATUS_LABELS[file.parsedSegments.status] ?? file.parsedSegments.status : "",
  ];
}

function buildFileSearchTokens(file: FileRecord) {
  return [
    file.fileName,
    file.baseName,
    file.projectName,
    file.projectNumber,
    file.disciplineFolder,
    file.sourceKey,
    file.sourceLabel,
    file.extension,
    file.extensionLabel,
    file.absolutePath,
    file.folderPath,
    file.invalidReason ?? "",
    file.rawSegments.join(" "),
    file.parsedSegments?.phase ?? "",
    file.parsedSegments?.disciplineCode ?? "",
    file.parsedSegments?.documentType ?? "",
    file.parsedSegments?.level ?? "",
    file.parsedSegments?.drawingNumber ?? "",
    file.parsedSegments?.revision ?? "",
    file.parsedSegments?.status ?? "",
    ...getParsedSegmentLabels(file),
  ].flatMap((value) => tokenizeSearchText(value));
}

function getPolishFileCountLabel(count: number) {
  const units = count % 10;
  const tens = count % 100;

  if (count === 1) {
    return `${count} plik po filtrach`;
  }

  if (units >= 2 && units <= 4 && (tens < 12 || tens > 14)) {
    return `${count} pliki po filtrach`;
  }

  return `${count} plików po filtrach`;
}

function getFavoriteProjectCard(projectName: string): FavoriteProjectCard {
  const [number = projectName, label = projectName] = projectName.split("_");

  return {
    projectName,
    number,
    label,
  };
}

function getDisciplineFolderLabel(folderName: string) {
  return folderName.replace(/^\d+\.\s*/, "");
}

function getPolishGenericFileCountLabel(count: number) {
  if (count === 1) {
    return "1 plik";
  }

  const units = count % 10;
  const tens = count % 100;
  if (units >= 2 && units <= 4 && (tens < 12 || tens > 14)) {
    return `${count} pliki`;
  }

  return `${count} plików`;
}

function buildDisciplineFolderTooltip(files: FileRecord[], isValid: boolean) {
  const counts = new Map<string, number>();

  files.forEach((file) => {
    if (file.isValid !== isValid) {
      return;
    }

    const label = getDisciplineFolderLabel(file.disciplineFolder);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => left[0].localeCompare(right[0], "pl"))
    .map(([folder, count]) => `${folder}: ${getPolishGenericFileCountLabel(count)}`)
    .join("\n");
}

function matchesBaseCriteria(file: FileRecord, query: string, showInvalidOnly: boolean, showValidOnly: boolean) {
  if (showInvalidOnly && file.isValid) {
    return false;
  }

  if (showValidOnly && !file.isValid) {
    return false;
  }

  if (!query) {
    return true;
  }

  const searchableTokens = buildFileSearchTokens(file);
  const queryTokens = tokenizeSearchText(query);

  return queryTokens.every((queryToken) =>
    searchableTokens.some((searchableToken) => matchesSearchToken(queryToken, searchableToken)),
  );
}

function matchesSelectedFilters(
  file: FileRecord,
  filters: Record<string, string[]>,
  groups: FilterGroup[],
  excludedGroupKey?: string,
) {
  for (const group of groups) {
    if (group.key === excludedGroupKey) {
      continue;
    }

    const selectedValues = filters[group.key] ?? [];
    if (selectedValues.length === 0) {
      continue;
    }

    if (!selectedValues.includes(group.getValue(file))) {
      return false;
    }
  }

  return true;
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
      ...Array.from({ length: 100 }, (_unused, index) => REVISION_LABELS[`R${String(index).padStart(2, "0")}`]),
      ...Array.from({ length: 99 }, (_unused, index) => REVISION_LABELS[`W${String(index + 1).padStart(2, "0")}`]),
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
  const [activeView, setActiveView] = useState<"filter" | "naming">("filter");
  const [projectsRoot, setProjectsRoot] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [favoriteProjects, setFavoriteProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [highlightedProjectIndex, setHighlightedProjectIndex] = useState(-1);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportMessageType, setReportMessageType] = useState<"success" | "error">("success");
  const [exportingInvalidReport, setExportingInvalidReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [showValidOnly, setShowValidOnly] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>(INITIAL_FILTERS);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(INITIAL_EXPANDED_GROUPS);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "fileName", direction: "asc" });
  const projectPickerRef = useRef<HTMLDivElement | null>(null);
  const projectOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  async function refreshProjects(preferredProject?: string) {
    setLoadingProjects(true);
    setErrorMessage("");
    setReportMessage("");

    try {
      const [settings, projectNames] = await Promise.all([
        window.fileFilterApi.getSettings(),
        window.fileFilterApi.listProjects(),
      ]);

      setProjectsRoot(settings.projectsRoot);
      setFavoriteProjects(settings.favoriteProjects);
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
  const normalizedSearchQuery = useMemo(() => normalize(searchQuery.trim()), [searchQuery]);

  const baseMatchingFiles = useMemo(() => {
    const files = scanResult?.files ?? [];
    return files.filter((file) => matchesBaseCriteria(file, normalizedSearchQuery, showInvalidOnly, showValidOnly));
  }, [normalizedSearchQuery, scanResult, showInvalidOnly, showValidOnly]);

  const filterOptions = useMemo(() => {
    const nextOptions = Object.fromEntries(
      FILTER_GROUPS.map((group) => {
        const candidateFiles = baseMatchingFiles.filter((file) =>
          matchesSelectedFilters(file, filters, FILTER_GROUPS, group.key),
        );

        return [group.key, extractOptions(candidateFiles, group)];
      }),
    );

    if (shouldRemovePdfExtensionOption) {
      nextOptions.extensionLabel = (nextOptions.extensionLabel ?? []).filter((option) => option !== "PDF");
    }

    return nextOptions;
  }, [baseMatchingFiles, filters, shouldRemovePdfExtensionOption]);

  const visibleFilterGroups = useMemo(
    () =>
      FILTER_GROUPS.filter((group) => {
        if (group.key === "extensionLabel" && shouldHideExtensionFilter) {
          return false;
        }

        return (filterOptions[group.key] ?? []).length > 0;
      }),
    [filterOptions, shouldHideExtensionFilter],
  );

  const filteredProjects = useMemo(() => {
    const query = normalize(projectQuery.trim());
    const selectedQuery = normalize(selectedProject.trim());

    if (!query || query === selectedQuery) {
      return projects;
    }

    return projects.filter((project) => normalize(project).includes(query));
  }, [projectQuery, projects, selectedProject]);

  const visibleFavoriteProjects = useMemo(
    () =>
      favoriteProjects
        .filter((project) => projects.includes(project))
        .slice(0, 5)
        .map((projectName) => getFavoriteProjectCard(projectName)),
    [favoriteProjects, projects],
  );

  const selectedProjectIsFavorite = selectedProject ? favoriteProjects.includes(selectedProject) : false;

  const filteredFiles = useMemo(() => {
    return baseMatchingFiles.filter((file) => matchesSelectedFilters(file, filters, FILTER_GROUPS));
  }, [baseMatchingFiles, filters]);

  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((left, right) => {
      if (left.isValid !== right.isValid) {
        return left.isValid ? -1 : 1;
      }

      const leftValue = getSortValue(left, sortConfig.key);
      const rightValue = getSortValue(right, sortConfig.key);
      const directionFactor = sortConfig.direction === "asc" ? 1 : -1;

      const comparison = leftValue.localeCompare(rightValue, "pl", { numeric: true, sensitivity: "base" });
      if (comparison !== 0) {
        return comparison * directionFactor;
      }

      return left.fileName.localeCompare(right.fileName, "pl", { numeric: true, sensitivity: "base" });
    });
  }, [filteredFiles, sortConfig]);

  useEffect(() => {
    setFavoriteProjects((current) => current.filter((project) => projects.includes(project)));
  }, [projects]);

  useEffect(() => {
    if (filteredProjects.length === 0) {
      if (highlightedProjectIndex !== -1) {
        setHighlightedProjectIndex(-1);
      }
      return;
    }

    if (!filteredProjects.includes(selectedProject)) {
      setSelectedProject("");
    }

    if (highlightedProjectIndex >= filteredProjects.length) {
      setHighlightedProjectIndex(filteredProjects.length - 1);
    }
  }, [filteredProjects, highlightedProjectIndex, selectedProject]);

  useEffect(() => {
    if (!projectPickerOpen) {
      if (highlightedProjectIndex !== -1) {
        setHighlightedProjectIndex(-1);
      }
      return;
    }

    if (highlightedProjectIndex < 0) {
      return;
    }

    const highlightedProject = filteredProjects[highlightedProjectIndex];
    if (!highlightedProject) {
      return;
    }

    projectOptionRefs.current[highlightedProject]?.scrollIntoView({
      block: "nearest",
    });
  }, [filteredProjects, highlightedProjectIndex, projectPickerOpen]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!projectPickerRef.current?.contains(event.target as Node)) {
        setProjectPickerOpen(false);
        setProjectQuery(selectedProject);
        setHighlightedProjectIndex(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [selectedProject]);

  useEffect(() => {
    setFilters((current) => {
      let hasChanges = false;
      const nextFilters = { ...current };

      for (const group of FILTER_GROUPS) {
        const selectedValues = current[group.key] ?? [];
        const nextValues =
          group.key === "extensionLabel" && shouldHideExtensionFilter
            ? []
            : selectedValues.filter((value) => (filterOptions[group.key] ?? []).includes(value));

        if (
          nextValues.length !== selectedValues.length ||
          nextValues.some((value, index) => value !== selectedValues[index])
        ) {
          nextFilters[group.key] = nextValues;
          hasChanges = true;
        }
      }

      return hasChanges ? nextFilters : current;
    });
  }, [filterOptions, shouldHideExtensionFilter]);

  async function handleChooseRoot() {
    const settings = await window.fileFilterApi.chooseProjectsRoot();
    setProjectsRoot(settings.projectsRoot);
    setFavoriteProjects(settings.favoriteProjects);
    setScanResult(null);
    setFilters(INITIAL_FILTERS);
    setExpandedGroups(INITIAL_EXPANDED_GROUPS);
    setProjectQuery("");
    setProjectPickerOpen(false);
    setHighlightedProjectIndex(-1);
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
      setShowValidOnly(false);
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
    setShowValidOnly(false);
  }

  async function handleProjectSelect(project: string) {
    setHighlightedProjectIndex(-1);
    setSelectedProject(project);
    setProjectQuery(project);
    setProjectPickerOpen(false);
    await runScan(project);
  }

  async function persistFavoriteProjects(nextFavoriteProjects: string[]) {
    const settings = await window.fileFilterApi.updateFavoriteProjects(nextFavoriteProjects);
    setFavoriteProjects(settings.favoriteProjects);
    return settings.favoriteProjects;
  }

  async function handleFavoriteToggle() {
    if (!selectedProject) {
      return;
    }

    try {
      const isFavorite = favoriteProjects.includes(selectedProject);
      const nextFavoriteProjects = isFavorite
        ? favoriteProjects.filter((project) => project !== selectedProject)
        : [...favoriteProjects, selectedProject];

      await persistFavoriteProjects(nextFavoriteProjects);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się zapisać ulubionych projektów.");
    }
  }

  async function handleRefreshCurrentProject() {
    if (!selectedProject) {
      return;
    }

    await runScan(selectedProject);
  }

  async function handleExportInvalidFilesReport() {
    const invalidFiles = (scanResult?.files ?? [])
      .filter((file) => !file.isValid)
      .map((file) => ({
        fileName: file.fileName,
        disciplineFolder: file.disciplineFolder,
      }));

    if (invalidFiles.length === 0) {
      setReportMessageType("error");
      setReportMessage("Brak błędnych plików do wyeksportowania.");
      return;
    }

    setExportingInvalidReport(true);
    setErrorMessage("");

    try {
      const result = await window.fileFilterApi.exportInvalidFilesReport(invalidFiles);
      if (!result.saved) {
        return;
      }

      setReportMessageType("success");
      setReportMessage(`Raport zapisano: ${result.reportPath}`);
    } catch (error) {
      setReportMessageType("error");
      setReportMessage(error instanceof Error ? error.message : "Nie udało się wyeksportować raportu.");
    } finally {
      setExportingInvalidReport(false);
    }
  }

  function toggleInvalidOnly(checked: boolean) {
    setShowInvalidOnly(checked);
    if (checked) {
      setShowValidOnly(false);
    }
  }

  function toggleValidOnly(checked: boolean) {
    setShowValidOnly(checked);
    if (checked) {
      setShowInvalidOnly(false);
    }
  }

  function toggleSort(sortKey: SortKey) {
    setSortConfig((current) => {
      if (current.key === sortKey) {
        return {
          key: sortKey,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key: sortKey,
        direction: "asc",
      };
    });
  }

  const activeFilterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0);
  const validCountTooltip = useMemo(
    () => buildDisciplineFolderTooltip(scanResult?.files ?? [], true),
    [scanResult?.files],
  );
  const invalidCountTooltip = useMemo(
    () => buildDisciplineFolderTooltip(scanResult?.files ?? [], false),
    [scanResult?.files],
  );

  return (
    <div className="app-shell">
      <header className="hero-bar">
        <div>
          <p className="eyebrow">Ekoinbud</p>
          <h1>Filtr plików projektowych</h1>
        </div>

        {activeView === "filter" ? (
          <div className="hero-favorites" aria-label="Ulubione projekty">
            {visibleFavoriteProjects.map((favoriteProject) => (
              <button
                key={favoriteProject.projectName}
                type="button"
                className={`favorite-project-card ${
                  favoriteProject.projectName === selectedProject ? "active" : ""
                }`}
                onClick={() => void handleProjectSelect(favoriteProject.projectName)}
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
          <>
      <section className="controls-layout">
        <div className="project-bar">
          <div className="field project-picker-field" ref={projectPickerRef}>
            <div className="project-field-header">
              <span>Projekt</span>
              <div className="project-field-actions">
                <button
                  type="button"
                  className="project-folder-toggle"
                  onClick={() => void handleChooseRoot()}
                  aria-label="Zmień folder projektów"
                >
                  📁
                </button>
                <button
                  type="button"
                  className={`favorite-toggle ${selectedProjectIsFavorite ? "active" : ""}`}
                  onClick={() => void handleFavoriteToggle()}
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
                  setProjectQuery("");
                  setHighlightedProjectIndex(-1);
                }}
                onChange={(event) => {
                  setProjectQuery(event.target.value);
                  setProjectPickerOpen(true);
                  setHighlightedProjectIndex(-1);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setProjectPickerOpen(false);
                    setProjectQuery(selectedProject);
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
                    void handleProjectSelect(projectToSelect);
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

              {projectPickerOpen && (
                <div className="project-picker-menu">
                  {filteredProjects.length === 0 ? (
                    <div className="project-picker-empty">Brak pasujących projektów.</div>
                  ) : (
                    filteredProjects.map((project, index) => (
                      <button
                        key={project}
                        type="button"
                        className={`project-option ${
                          index === highlightedProjectIndex || (highlightedProjectIndex === -1 && project === selectedProject)
                            ? "active"
                            : ""
                        }`}
                        ref={(element) => {
                          projectOptionRefs.current[project] = element;
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void handleProjectSelect(project)}
                        onMouseEnter={() => setHighlightedProjectIndex(index)}
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
              placeholder="Nazwa pliku, kod, opis, ścieżka..."
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
      {reportMessage && <div className={`banner ${reportMessageType}`}>{reportMessage}</div>}
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

          <div className="filters-panel-scroll">
            <div className="summary-grid">
              <article className="summary-card">
                <span>Wszystkie</span>
                <strong>{scanResult?.totalFiles ?? 0}</strong>
              </article>
              <article className="summary-card">
                <span>Poprawne</span>
                <strong
                  className={validCountTooltip ? "summary-card-value with-tooltip" : "summary-card-value"}
                  data-tooltip={validCountTooltip || undefined}
                >
                  {scanResult?.validCount ?? 0}
                </strong>
              </article>
              <article className="summary-card invalid">
                <span>Błędne</span>
                <strong
                  className={invalidCountTooltip ? "summary-card-value with-tooltip" : "summary-card-value"}
                  data-tooltip={invalidCountTooltip || undefined}
                >
                  {scanResult?.invalidCount ?? 0}
                </strong>
              </article>
              <article className="summary-card">
                <span>Aktywne filtry</span>
                <strong>{activeFilterCount + (showInvalidOnly || showValidOnly ? 1 : 0)}</strong>
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

            <button
              type="button"
              className="primary-button filter-export-button"
              onClick={() => void handleExportInvalidFilesReport()}
              disabled={!scanResult || exportingInvalidReport || (scanResult.invalidCount ?? 0) === 0}
            >
              {exportingInvalidReport ? "Eksportowanie..." : "Eksportuj raport błędnych plików"}
            </button>
          </div>
        </aside>

        <section className="results-panel">
          {scanResult ? (
            <div className="panel-header">
              <div>
                <p className="eyebrow">Wyniki</p>
                <h2>{scanResult.projectName}</h2>
              </div>
              <div className="status-strip">
                <span>{getPolishFileCountLabel(sortedFiles.length)}</span>
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
                    {SORTABLE_COLUMNS.map((column) => {
                      const isActive = sortConfig.key === column.key;
                      const directionLabel = isActive && sortConfig.direction === "asc" ? "rosnąco" : "malejąco";

                      return (
                        <th key={column.key} className={column.className}>
                          <button
                            type="button"
                            className={`sort-button ${isActive ? "active" : ""}`}
                            onClick={() => toggleSort(column.key)}
                            aria-label={`Sortuj po kolumnie ${column.label} ${directionLabel}`}
                          >
                            <span>{column.label}</span>
                            <span className="sort-indicator" aria-hidden="true">
                              {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="empty-inline">Brak plików pasujących do wybranych filtrów.</div>
                      </td>
                    </tr>
                  ) : (
                    sortedFiles.map((file) => (
                      <tr key={file.id} className={file.isValid ? "" : "invalid-row"}>
                        <td className="column-file">
                          <div className="file-cell">
                            <button
                              type="button"
                              className="file-name-button"
                              onClick={() => void window.fileFilterApi.openFolder(file.folderPath)}
                              aria-label={`Otwórz folder dla pliku ${file.fileName}`}
                              data-tooltip="Kliknij aby otworzyć folder"
                            >
                              {file.fileName}
                            </button>
                          </div>
                        </td>
                        <td className="column-status">
                          <span
                            className={`status-pill ${file.isValid ? "valid" : "invalid"} ${
                              !file.isValid && file.invalidReason && file.invalidReason !== "Błędna lokalizacja"
                                ? "with-tooltip"
                                : ""
                            }`}
                            data-tooltip={
                              !file.isValid && file.invalidReason !== "Błędna lokalizacja"
                                ? (file.invalidReason ?? "")
                                : undefined
                            }
                          >
                            {getValidationLabel(file)}
                          </span>
                        </td>
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
          </>
        ) : (
          <NamingView selectedProjectName={selectedProject} />
        )}
      </div>
    </div>
  );
}
