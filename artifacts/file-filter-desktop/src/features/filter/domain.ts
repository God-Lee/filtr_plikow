import type {
  FavoriteProjectCard,
  DateFilterKey,
  DateFilterValue,
  FileRecord,
  FilterColumnKey,
  FilterGroup,
  NamingStandardVersion,
  SortConfig,
  SortKey,
} from "../../app/types";
import { getNamingStandardSnapshot, subscribeNamingStandard } from "../../app/standard-config";
import { getFilteredFileCountLabel, getGenericFileCountLabel } from "../../app/utils/polish";
import { matchesSearchToken, normalizeText, tokenizeText } from "../../app/utils/text";

type FilterOptionMap = Record<string, string[]>;
export type DateFilterMap = Record<DateFilterKey, DateFilterValue | null>;

export const MAX_FAVORITE_PROJECTS = 10;

const EXTENSION_GROUP_LABELS: Record<string, string> = {
  ".doc": "Word",
  ".docm": "Word",
  ".docx": "Word",
  ".dwg": "CAD",
  ".jpg": "Obraz",
  ".jpeg": "Obraz",
  ".pdf": "PDF",
  ".png": "Obraz",
  ".xls": "Excel",
  ".xlsx": "Excel",
};

let namingStandards = getNamingStandardSnapshot();

let PHASE_LABELS: Record<string, string> = namingStandards.phases;
let DISCIPLINE_LABELS: Record<string, string> = namingStandards.disciplines;
let DOCUMENT_TYPE_LABELS: Record<string, string> = namingStandards.documentTypes;
let LEVEL_LABELS: Record<string, string> = namingStandards.levels;
let REVISION_LABELS: Record<string, string> = buildRevisionLabels();
let STATUS_LABELS: Record<string, string> = namingStandards.statuses;

export const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: "fileName", label: "Plik", className: "column-file" },
  { key: "isValid", label: "Poprawność", className: "column-status" },
  { key: "createdAt", label: "Utworzono", className: "column-date" },
  { key: "modifiedAt", label: "Zmodyfikowano", className: "column-date" },
  { key: "phase", label: "Faza" },
  { key: "disciplineCode", label: "Branża" },
  { key: "documentType", label: "Typ" },
  { key: "buildingDesignation", label: "Budynek" },
  { key: "level", label: "Poziom" },
  { key: "drawingNumber", label: "Nr rysunku" },
  { key: "revision", label: "Rewizja" },
  { key: "status", label: "Status" },
];

export function getDefaultVisibleColumnKeys(
  namingStandardVersion: NamingStandardVersion = 4,
): FilterColumnKey[] {
  const defaultKeys = SORTABLE_COLUMNS.map((column) => column.key);
  return namingStandardVersion === 3
    ? defaultKeys.filter((columnKey) => columnKey !== "buildingDesignation")
    : defaultKeys;
}

export const FILTER_GROUPS: FilterGroup<FileRecord>[] = [
  { key: "extensionLabel", label: "Typ plików", getValue: (file) => getExtensionFilterLabel(file) },
  { key: "phase", label: "Faza", getValue: (file) => getPhaseFilterLabel(file) },
  { key: "disciplineCode", label: "Branża", getValue: (file) => getDisciplineFilterLabel(file) },
  { key: "documentType", label: "Typ", getValue: (file) => getDocumentTypeFilterLabel(file) },
  { key: "buildingDesignation", label: "Budynek", getValue: (file) => getBuildingFilterLabel(file) },
  { key: "level", label: "Poziom", getValue: (file) => getLevelFilterLabel(file) },
  { key: "revision", label: "Rewizja", getValue: (file) => getRevisionFilterLabel(file) },
  { key: "status", label: "Status", getValue: (file) => getStatusFilterLabel(file) },
];

export const INITIAL_FILTERS = Object.fromEntries(
  FILTER_GROUPS.map((group) => [group.key, [] as string[]]),
) as FilterOptionMap;

export const INITIAL_EXPANDED_GROUPS = Object.fromEntries(
  FILTER_GROUPS.map((group) => [group.key, true]),
) as Record<string, boolean>;

export function buildFavoriteProjectCard(projectName: string): FavoriteProjectCard {
  const [number = projectName, label = projectName] = projectName.split("_");

  return {
    projectName,
    number,
    label,
  };
}

export function getValidationLabel(file: FileRecord) {
  if (file.isValid) {
    return "OK";
  }

  return file.invalidReason === "Błędna lokalizacja" ? "Błędna lokalizacja" : "Błędna nazwa";
}

export function sanitizeVisibleColumnKeys(
  columnKeys: unknown,
  namingStandardVersion: NamingStandardVersion = 4,
): FilterColumnKey[] {
  const defaultVisibleColumnKeys = getDefaultVisibleColumnKeys(namingStandardVersion);

  if (!Array.isArray(columnKeys)) {
    return defaultVisibleColumnKeys;
  }

  const allowedColumnKeys = new Set<SortKey>(SORTABLE_COLUMNS.map((column) => column.key));
  const visibleColumnKeys = columnKeys.filter(
    (columnKey): columnKey is FilterColumnKey =>
      typeof columnKey === "string" && allowedColumnKeys.has(columnKey as SortKey),
  );

  return visibleColumnKeys.length > 0 ? Array.from(new Set(visibleColumnKeys)) : defaultVisibleColumnKeys;
}

export function getSortValue(file: FileRecord, sortKey: SortKey) {
  switch (sortKey) {
    case "fileName":
      return file.fileName;
    case "isValid":
      return getValidationLabel(file);
    case "createdAt":
      return file.createdAt ?? "";
    case "modifiedAt":
      return file.modifiedAt ?? "";
    case "phase":
      return file.parsedSegments?.phase ?? "";
    case "disciplineCode":
      return file.parsedSegments?.disciplineCode ?? "";
    case "documentType":
      return file.parsedSegments?.documentType ?? "";
    case "buildingDesignation":
      return file.parsedSegments?.buildingDesignation ?? "";
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

export function getActiveFilterCount(
  filters: FilterOptionMap,
  showInvalidOnly: boolean,
  showValidOnly: boolean,
  showSelectedOnly: boolean,
  dateFilters: DateFilterMap,
) {
  return (
    Object.values(filters).reduce((sum, values) => sum + values.length, 0) +
    (showInvalidOnly || showValidOnly ? 1 : 0) +
    (showSelectedOnly ? 1 : 0) +
    Object.values(dateFilters).filter(Boolean).length
  );
}

export function getFilteredProjects(projects: string[], projectQuery: string, selectedProject: string) {
  const query = normalizeText(projectQuery.trim());
  const selectedQuery = normalizeText(selectedProject.trim());

  if (!query || query === selectedQuery) {
    return projects;
  }

  return projects.filter((project) => normalizeText(project).includes(query));
}

export function getVisibleFavoriteProjects(projects: string[], favoriteProjects: string[]) {
  return favoriteProjects
    .filter((project) => projects.includes(project))
    .slice(0, MAX_FAVORITE_PROJECTS)
    .map((projectName) => buildFavoriteProjectCard(projectName));
}

export function filterFilesBySearch(files: FileRecord[], query: string) {
  return files.filter((file) => matchesSearchCriteria(file, query));
}

export function getFilterOptions(
  files: FileRecord[],
  filters: FilterOptionMap,
  shouldRemovePdfExtensionOption: boolean,
) {
  const nextOptions = Object.fromEntries(
    FILTER_GROUPS.map((group) => {
      const candidateFiles = files.filter((file) =>
        matchesSelectedFilters(file, filters, FILTER_GROUPS, group.key),
      );

      return [group.key, extractOptions(candidateFiles, group)];
    }),
  ) as FilterOptionMap;

  if (shouldRemovePdfExtensionOption) {
    nextOptions.extensionLabel = (nextOptions.extensionLabel ?? []).filter((option) => option !== "PDF");
  }

  return nextOptions;
}

export function getVisibleFilterGroups(
  filterOptions: FilterOptionMap,
  shouldHideExtensionFilter: boolean,
) {
  return FILTER_GROUPS.filter((group) => {
    if (group.key === "extensionLabel" && shouldHideExtensionFilter) {
      return false;
    }

    return (filterOptions[group.key] ?? []).length > 0;
  });
}

export function sanitizeSelectedFilters(
  filters: FilterOptionMap,
  filterOptions: FilterOptionMap,
  shouldHideExtensionFilter: boolean,
) {
  let hasChanges = false;
  const nextFilters: FilterOptionMap = { ...filters };

  for (const group of FILTER_GROUPS) {
    const selectedValues = filters[group.key] ?? [];
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

  return hasChanges ? nextFilters : filters;
}

export function getFilteredFiles(
  files: FileRecord[],
  filters: FilterOptionMap,
  showInvalidOnly: boolean,
  showValidOnly: boolean,
  dateFilters: DateFilterMap,
) {
  return files.filter(
    (file) =>
      matchesSelectedFilters(file, filters, FILTER_GROUPS) &&
      matchesValidityCriteria(file, showInvalidOnly, showValidOnly) &&
      matchesDateFilters(file, dateFilters),
  );
}

export function getSortedFiles(files: FileRecord[], sortConfig: SortConfig) {
  return [...files].sort((left, right) => {
    if (left.isValid !== right.isValid) {
      return left.isValid ? -1 : 1;
    }

    const leftValue = getSortValue(left, sortConfig.key);
    const rightValue = getSortValue(right, sortConfig.key);
    const directionFactor = sortConfig.direction === "asc" ? 1 : -1;

    const comparison = leftValue.localeCompare(rightValue, "pl", {
      numeric: true,
      sensitivity: "base",
    });
    if (comparison !== 0) {
      return comparison * directionFactor;
    }

    return left.fileName.localeCompare(right.fileName, "pl", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export function buildDisciplineFolderTooltip(files: FileRecord[], isValid: boolean) {
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
    .map(([folder, count]) => `${folder}: ${getGenericFileCountLabel(count)}`)
    .join("\n");
}

export function getFilteredFileSummaryLabel(count: number) {
  return getFilteredFileCountLabel(count);
}

function buildRevisionLabels() {
  const labels: Record<string, string> = { ...namingStandards.revisions };

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

function refreshNamingStandardLabels() {
  namingStandards = getNamingStandardSnapshot();
  PHASE_LABELS = namingStandards.phases;
  DISCIPLINE_LABELS = namingStandards.disciplines;
  DOCUMENT_TYPE_LABELS = namingStandards.documentTypes;
  LEVEL_LABELS = namingStandards.levels;
  REVISION_LABELS = buildRevisionLabels();
  STATUS_LABELS = namingStandards.statuses;
}

subscribeNamingStandard(() => {
  refreshNamingStandardLabels();
});

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

function getBuildingFilterLabel(file: FileRecord) {
  if (file.namingStandardVersion === 3) {
    return "";
  }

  return file.parsedSegments?.buildingDesignation ?? "Błędnie nazwane";
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

function getParsedSegmentLabels(file: FileRecord) {
  return [
    file.parsedSegments?.phase ? PHASE_LABELS[file.parsedSegments.phase] ?? file.parsedSegments.phase : "",
    file.parsedSegments?.disciplineCode
      ? DISCIPLINE_LABELS[file.parsedSegments.disciplineCode] ?? file.parsedSegments.disciplineCode
      : "",
    file.parsedSegments?.documentType
      ? DOCUMENT_TYPE_LABELS[file.parsedSegments.documentType] ?? file.parsedSegments.documentType
      : "",
    file.parsedSegments?.buildingDesignation ?? "",
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
    file.parsedSegments?.buildingDesignation ?? "",
    file.parsedSegments?.level ?? "",
    file.parsedSegments?.drawingNumber ?? "",
    file.parsedSegments?.revision ?? "",
    file.parsedSegments?.status ?? "",
    ...getParsedSegmentLabels(file),
  ].flatMap((value) => tokenizeText(value));
}

function getDisciplineFolderLabel(folderName: string) {
  return folderName.replace(/^\d+\.\s*/, "");
}

function matchesValidityCriteria(file: FileRecord, showInvalidOnly: boolean, showValidOnly: boolean) {
  if (showInvalidOnly && file.isValid) {
    return false;
  }

  if (showValidOnly && !file.isValid) {
    return false;
  }

  return true;
}

function getDateOnlyStart(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateOnlyEnd(dateValue: string) {
  const date = getDateOnlyStart(dateValue);
  if (!date) {
    return null;
  }

  date.setDate(date.getDate() + 1);
  return date;
}

function matchesDateFilters(file: FileRecord, dateFilters: DateFilterMap) {
  for (const [dateKey, filter] of Object.entries(dateFilters) as Array<[DateFilterKey, DateFilterValue | null]>) {
    if (!filter) {
      continue;
    }

    const fileDate = new Date(file[dateKey] ?? "");
    const fromDate = getDateOnlyStart(filter.from);
    const toDate = getDateOnlyEnd(filter.to);

    if (Number.isNaN(fileDate.getTime()) || !fromDate || !toDate) {
      return false;
    }

    if (fileDate < fromDate || fileDate >= toDate) {
      return false;
    }
  }

  return true;
}

function matchesSearchCriteria(file: FileRecord, query: string) {
  if (!query) {
    return true;
  }

  const searchableTokens = buildFileSearchTokens(file);
  const queryTokens = tokenizeText(normalizeText(query));

  return queryTokens.every((queryToken) =>
    searchableTokens.some((searchableToken) => matchesSearchToken(queryToken, searchableToken)),
  );
}

function matchesSelectedFilters(
  file: FileRecord,
  filters: FilterOptionMap,
  groups: FilterGroup<FileRecord>[],
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

function extractOptions(files: FileRecord[], group: FilterGroup<FileRecord>) {
  const values = new Set<string>();
  files.forEach((file) => {
    const value = group.getValue(file);
    if (value) {
      values.add(value);
    }
  });

  const options = Array.from(values);
  if (group.key === "extensionLabel") {
    return sortWithInvalidLast(options, ["PDF", "Word", "Excel", "CAD", "Obraz"]);
  }

  if (group.key === "phase") {
    return sortWithInvalidLast(options, [
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
    ]);
  }

  if (group.key === "disciplineCode") {
    return sortWithInvalidLast(options, [
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
    ]);
  }

  if (group.key === "documentType") {
    return sortWithInvalidLast(options, [
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
    ]);
  }

  if (group.key === "level") {
    return sortWithInvalidLast(options, [
      "P0 - Parter",
      "P1 - Piętro 1",
      "P2 - Piętro 2",
      "P3 - Piętro 3",
      "D0 - Dach",
      "B1 - Pierwsza kondygnacja podziemna",
      "B2 - Druga kondygnacja podziemna",
      "M0 - Półpiętro nad parterem",
      "M1 - Półpiętro nad 1 piętrem",
      "XX - Nie dotyczy/wiele poziomów",
    ]);
  }

  if (group.key === "buildingDesignation") {
    return sortWithInvalidLast(options, ["A", "B", "C", "D", "E", "F", "G", "H", "I", "X"]);
  }

  if (group.key === "revision") {
    const revisionOrder = [
      ...Array.from({ length: 100 }, (_unused, index) => REVISION_LABELS[`R${String(index).padStart(2, "0")}`]),
      ...Array.from({ length: 99 }, (_unused, index) => REVISION_LABELS[`W${String(index + 1).padStart(2, "0")}`]),
    ];

    return sortWithInvalidLast(options, revisionOrder);
  }

  if (group.key === "status") {
    return sortWithInvalidLast(options, [
      "S0 - plik roboczy",
      "S1 - wersja robocza, tylko do koordynacji międzybranżowej",
      "S2 - wersja robocza, wydana do zatwierdzenia",
      "A1 - wersja zatwierdzona, na potrzeby budowy",
    ]);
  }

  return sortWithInvalidLast(options);
}
