import { joinWindowsPath, normalizeFileSystemPath, normalizeFileSystemPathList } from "../../app/utils/path";
import {
  getNamingStandardAllValuesSnapshot,
  getNamingStandardSnapshot,
  subscribeNamingStandard,
} from "../../app/standard-config";
import { matchesSearchToken, normalizeText, tokenizeText } from "../../app/utils/text";
import type {
  ExtensionFilterGroup,
  NamingFileRow,
  NamingFolderFile,
  NamingOption,
  ParsedStandardName,
  ResolvedSession,
} from "../../app/types";
import pdfIcon from "../../assets/extension-icons/pdf.svg";
import wordIcon from "../../assets/extension-icons/word.svg";
import excelIcon from "../../assets/extension-icons/excel.svg";
import dwgIcon from "../../assets/extension-icons/dwg.svg";

const DOCUMENT_TYPE_ALIASES: Record<string, string[]> = {
  SCH: ["schemat", "rozwiniecie", "rozwinięcia", "rozwiniecia"],
  ROG: ["rzut", "rzut ogolny", "rzut ogólny"],
  RFU: ["fundament", "fundamentow", "fundamentów"],
  RPO: ["posadzka", "posadzek"],
  RSU: ["sufit", "sufitow", "sufitów"],
  PRO: ["projekt"],
  OPP: ["opis"],
  OPZ: ["opis pzt"],
  PZT: ["pzt"],
  PRF: ["profil"],
  MAP: ["mapa"],
  MOD: ["model"],
  VIS: ["wizualizacja", "wizual"],
  STT: ["strona tytulowa", "strona tytułowa", "tytulowa", "tytułowa"],
  ZSA: ["spis arkuszy"],
  ZSD: ["zestawienie drzwi", "stolarka drzwiowa", "drzwi"],
  ZSO: ["zestawienie okien", "stolarka okienna", "okna", "okiennej"],
  ZST: ["zestawienie"],
  ZSW: ["witryny", "zestawienie witryn"],
  ZJA: ["zjazd", "projekt zjazdu"],
};

const LEVEL_ALIASES: Record<string, string[]> = {
  P0: ["parter"],
  P1: ["pietro 1", "piętro 1", "1 pietro", "1 piętro", "p1"],
  P2: ["pietro 2", "piętro 2", "2 pietro", "2 piętro", "p2"],
  D0: ["dach", "d0"],
  B1: ["poziom -1", "kondygnacja podziemna 1", "b1", "piwnica 1"],
  B2: ["poziom -2", "kondygnacja podziemna 2", "b2", "piwnica 2"],
  M0: ["polpietro parter", "półpiętro parter", "m0"],
  M1: ["polpietro 1", "półpiętro 1", "m1"],
};

const PHASE_ALIASES: Record<string, string[]> = {
  PB: ["projekt budowlany", "projekt arch-bud", "projekt architektoniczno-budowlany", "pzt"],
  PT: ["projekt techn", "projekt techniczny"],
  PW: ["projekt wykonawczy"],
  PK: ["projekt koncepcyjny", "koncepcja"],
};

let namingStandards = getNamingStandardSnapshot();
let allNamingStandards = getNamingStandardAllValuesSnapshot();

export let PHASE_OPTIONS = buildOptions(namingStandards.phases, PHASE_ALIASES);
export let DISCIPLINE_OPTIONS = buildOptions(namingStandards.disciplines);
export let DOCUMENT_TYPE_OPTIONS = buildOptions(namingStandards.documentTypes, DOCUMENT_TYPE_ALIASES);
export let LEVEL_OPTIONS = buildOptions(namingStandards.levels, LEVEL_ALIASES);
export let REVISION_PRESET_OPTIONS = buildRevisionPresetOptions();
export const REVISION_CUSTOM_OPTION_LABEL = "wpisz numer rewizji";
export const REVISION_INPUT_MESSAGE =
  "Wpisz rewizję w formacie R00-R99 albo W01-W99, np. R21 lub W03. Sam numer, np. 21, zapisze się jako R21.";
export const REVISION_CONCEPT_MESSAGE =
  "Wersję koncepcji wpisz od W01 do W99. Dla rewizji zerowej użyj R00.";
export let REVISION_OPTIONS = buildRevisionOptions();
export let STATUS_OPTIONS = buildOptions(namingStandards.statuses);
export let ALL_PHASE_OPTIONS = buildOptions(allNamingStandards.phases, PHASE_ALIASES);
export let ALL_DISCIPLINE_OPTIONS = buildOptions(allNamingStandards.disciplines);
export let ALL_DOCUMENT_TYPE_OPTIONS = buildOptions(allNamingStandards.documentTypes, DOCUMENT_TYPE_ALIASES);
export let ALL_LEVEL_OPTIONS = buildOptions(allNamingStandards.levels, LEVEL_ALIASES);
export let ALL_STATUS_OPTIONS = buildOptions(allNamingStandards.statuses);

export const BUILDING_DESIGNATION_OPTIONS: NamingOption[] = [
  ...Array.from("ABCDEFGHI", (code) => ({
    code,
    label: code === "A" ? "A - budynek domyślny" : `${code} - budynek ${code}`,
    searchTerms: [code, `budynek ${code}`],
  })),
  {
    code: "X",
    label: "X - wiele budynków",
    searchTerms: ["X", "wiele budynków", "wiele budynkow"],
  },
];

export const EXTENSION_FILTER_ICON_MAP: Record<
  ExtensionFilterGroup,
  { icon: string; label: string; title: string }
> = {
  pdf: {
    label: "PDF",
    icon: pdfIcon,
    title: "Pokaż pliki PDF",
  },
  dwg: {
    label: "DWG",
    icon: dwgIcon,
    title: "Pokaż pliki DWG",
  },
  doc: {
    label: "DOC",
    icon: wordIcon,
    title: "Pokaż pliki DOC i DOCX",
  },
  xls: {
    label: "XLS",
    icon: excelIcon,
    title: "Pokaż pliki XLS i XLSX",
  },
};

export function buildOptions(labels: Record<string, string>, aliases: Record<string, string[]> = {}) {
  return Object.entries(labels).map(([code, label]) => ({
    code,
    label,
    searchTerms: [code, label, ...(aliases[code] ?? [])],
  }));
}

function buildRevisionPresetOptions() {
  return [
    {
      code: "R00",
      label: namingStandards.revisions.R00 ?? 'R00 - rewizja "zerowa" (domyślna)',
    },
    {
      code: "W01",
      label: namingStandards.revisions.W01 ?? "W01 - pierwsza wersja koncepcji (domyślna)",
    },
  ];
}

export function buildRevisionOptions(): NamingOption[] {
  const options: NamingOption[] = [];

  for (let index = 0; index <= 99; index += 1) {
    const code = `R${String(index).padStart(2, "0")}`;
    const preset = REVISION_PRESET_OPTIONS.find((option) => option.code === code);
    const mappedLabel = namingStandards.revisions[code];
    options.push({
      code,
      label: mappedLabel ?? preset?.label ?? code,
      searchTerms: [code, mappedLabel ?? preset?.label ?? code],
    });
  }

  for (let index = 1; index <= 99; index += 1) {
    const code = `W${String(index).padStart(2, "0")}`;
    const preset = REVISION_PRESET_OPTIONS.find((option) => option.code === code);
    const mappedLabel = namingStandards.revisions[code];
    options.push({
      code,
      label: mappedLabel ?? preset?.label ?? code,
      searchTerms: [code, mappedLabel ?? preset?.label ?? code],
    });
  }

  return options;
}

function refreshNamingStandardCaches() {
  namingStandards = getNamingStandardSnapshot();
  allNamingStandards = getNamingStandardAllValuesSnapshot();
  PHASE_OPTIONS = buildOptions(namingStandards.phases, PHASE_ALIASES);
  DISCIPLINE_OPTIONS = buildOptions(namingStandards.disciplines);
  DOCUMENT_TYPE_OPTIONS = buildOptions(namingStandards.documentTypes, DOCUMENT_TYPE_ALIASES);
  LEVEL_OPTIONS = buildOptions(namingStandards.levels, LEVEL_ALIASES);
  REVISION_PRESET_OPTIONS = buildRevisionPresetOptions();
  REVISION_OPTIONS = buildRevisionOptions();
  STATUS_OPTIONS = buildOptions(namingStandards.statuses);
  ALL_PHASE_OPTIONS = buildOptions(allNamingStandards.phases, PHASE_ALIASES);
  ALL_DISCIPLINE_OPTIONS = buildOptions(allNamingStandards.disciplines);
  ALL_DOCUMENT_TYPE_OPTIONS = buildOptions(allNamingStandards.documentTypes, DOCUMENT_TYPE_ALIASES);
  ALL_LEVEL_OPTIONS = buildOptions(allNamingStandards.levels, LEVEL_ALIASES);
  ALL_STATUS_OPTIONS = buildOptions(allNamingStandards.statuses);
}

subscribeNamingStandard(() => {
  refreshNamingStandardCaches();
});

export function findOptionByCode(options: NamingOption[], code: string) {
  return options.find((option) => option.code === code) ?? null;
}

export function formatPolishCount(
  count: number,
  singular: string,
  paucal: string,
  plural: string,
) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (count === 1) {
    return `${count} ${singular}`;
  }

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${count} ${paucal}`;
  }

  return `${count} ${plural}`;
}

export function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export { normalizeFileSystemPath, normalizeFileSystemPathList };

export function dedupeRowsBySourcePath(fileRows: NamingFileRow[]) {
  const seenPaths = new Set<string>();

  return fileRows.filter((row) => {
    const normalizedSourcePath = normalizeFileSystemPath(row.sourcePath);
    if (seenPaths.has(normalizedSourcePath)) {
      return false;
    }

    seenPaths.add(normalizedSourcePath);
    return true;
  });
}

export function getExtensionFilterGroup(extension: string): ExtensionFilterGroup | "" {
  const normalizedExtension = extension.trim().toLowerCase();

  if (normalizedExtension === ".pdf") {
    return "pdf";
  }

  if (normalizedExtension === ".dwg") {
    return "dwg";
  }

  if (normalizedExtension === ".doc" || normalizedExtension === ".docx") {
    return "doc";
  }

  if (normalizedExtension === ".xls" || normalizedExtension === ".xlsx") {
    return "xls";
  }

  return "";
}

export function resolveOption(input: string, options: NamingOption[]) {
  const queryTokens = tokenizeText(input.trim());
  if (queryTokens.length === 0) {
    return null;
  }

  const exactCodeMatch = options.find((option) => normalizeText(option.code) === queryTokens.join(""));
  if (exactCodeMatch) {
    return exactCodeMatch;
  }

  const matches = options.filter((option) =>
    option.searchTerms.some((term) => {
      const termTokens = tokenizeText(term);
      return queryTokens.every((queryToken) =>
        termTokens.some((termToken) => matchesSearchToken(queryToken, termToken)),
      );
    }),
  );

  return matches.length === 1 ? matches[0] : null;
}

export function inferOptionFromText(input: string, options: NamingOption[]) {
  const normalizedInput = normalizeText(input);
  const inputTokens = tokenizeText(input);
  if (normalizedInput.length === 0 || inputTokens.length === 0) {
    return null;
  }

  const candidates = options
    .map((option) => {
      const score = option.searchTerms.reduce((currentScore, term) => {
        const normalizedTerm = normalizeText(term);
        const termTokens = tokenizeText(term);
        const matchesAllTokens =
          termTokens.length > 0 &&
          termTokens.every((termToken) =>
            inputTokens.some(
              (inputToken) =>
                matchesSearchToken(termToken, inputToken) || matchesSearchToken(inputToken, termToken),
            ),
          );

        if (normalizedInput.includes(normalizedTerm) || matchesAllTokens) {
          return Math.max(currentScore, normalizedTerm.length);
        }

        return currentScore;
      }, 0);

      return { option, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    return null;
  }

  return candidates[0].option;
}

export function getSuggestedOptions(input: string, options: NamingOption[]) {
  const queryTokens = tokenizeText(input.trim());

  if (queryTokens.length === 0) {
    return options.slice(0, 8);
  }

  return options
    .map((option) => {
      const score = option.searchTerms.reduce((bestScore, term) => {
        const termTokens = tokenizeText(term);
        const matches =
          termTokens.length > 0 &&
          queryTokens.every((queryToken) =>
            termTokens.some(
              (termToken) =>
                matchesSearchToken(queryToken, termToken) || matchesSearchToken(termToken, queryToken),
            ),
          );

        if (!matches) {
          return bestScore;
        }

        return Math.max(bestScore, normalizeText(term).length);
      }, 0);

      return { option, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.option.label.localeCompare(right.option.label, "pl");
    })
    .slice(0, 8)
    .map((candidate) => candidate.option);
}

export function extractProjectNumber(projectName: string) {
  const match = /^(\d{5})/.exec(projectName);
  return match ? match[1] : "";
}

export function isProjectNumberValid(projectNumber: string) {
  return /^\d{5}$/.test(projectNumber.trim());
}

export function isRevisionCodeValid(revision: string) {
  return /^R\d{2}$/.test(revision) || (/^W\d{2}$/.test(revision) && revision !== "W00");
}

export function normalizeRevisionInput(input: string) {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/\s+/g, "");
  if (/^[RW]\d{2}$/.test(compact) && isRevisionCodeValid(compact)) {
    return compact;
  }

  const numberMatch = /^(R|W)?(\d{1,2})(?:\s*-\s*.*)?$/.exec(trimmed);
  if (!numberMatch) {
    return null;
  }

  const prefix = numberMatch[1] ?? "R";
  const normalized = `${prefix}${numberMatch[2].padStart(2, "0")}`;
  return isRevisionCodeValid(normalized) ? normalized : null;
}

export function getRevisionValidationMessage(input: string) {
  const trimmed = input.trim().toUpperCase();

  if (trimmed.startsWith("W") && /^W0*$/.test(trimmed.replace(/\s+/g, ""))) {
    return REVISION_CONCEPT_MESSAGE;
  }

  return REVISION_INPUT_MESSAGE;
}

export function isRevisionValidationMessage(message: string) {
  return message === REVISION_INPUT_MESSAGE || message === REVISION_CONCEPT_MESSAGE;
}

export function isRevisionPartialInputAllowed(input: string) {
  return /^(?:|[RW]|[RW]?\d{0,2}|[RW]\d{0,2})$/.test(input);
}

export function isDrawingNumberValidForDiscipline(disciplineCode: string, drawingNumber: string) {
  const disciplinePrefix = disciplineCode?.[0];
  const drawingPrefix = drawingNumber?.[0];

  if (!disciplinePrefix || !drawingPrefix) {
    return false;
  }

  return drawingPrefix === "X" || drawingPrefix === disciplinePrefix;
}

export function isBuildingDesignationValid(buildingDesignation: string | null | undefined) {
  return /^(?:[A-I]|X)$/.test(buildingDesignation ?? "");
}

export function parseStandardizedFileName(fileName: string): ParsedStandardName | null {
  const extensionStart = fileName.lastIndexOf(".");
  if (extensionStart === -1) {
    return null;
  }

  const baseName = fileName.slice(0, extensionStart);
  const segments = baseName.split("-").map((segment) => segment.trim().toUpperCase());

  if (segments.length !== 8 && segments.length !== 9) {
    return null;
  }

  const isVersion4 = segments.length === 9;
  const [
    projectNumber,
    phase,
    disciplineCode,
    documentType,
    maybeBuildingDesignation,
    maybeLevel,
    maybeDrawingNumber,
    maybeRevision,
    maybeStatus,
  ] = segments;
  const buildingDesignation = isVersion4 ? maybeBuildingDesignation : null;
  const level = isVersion4 ? maybeLevel : maybeBuildingDesignation;
  const drawingNumber = isVersion4 ? maybeDrawingNumber : maybeLevel;
  const revision = isVersion4 ? maybeRevision : maybeDrawingNumber;
  const status = isVersion4 ? maybeStatus : maybeRevision;

  if (!/^\d{5}$/.test(projectNumber)) {
    return null;
  }

  if (!findOptionByCode(ALL_PHASE_OPTIONS, phase)) {
    return null;
  }

  if (!findOptionByCode(ALL_DISCIPLINE_OPTIONS, disciplineCode)) {
    return null;
  }

  if (!findOptionByCode(ALL_DOCUMENT_TYPE_OPTIONS, documentType)) {
    return null;
  }

  if (isVersion4 && !isBuildingDesignationValid(buildingDesignation)) {
    return null;
  }

  if (!findOptionByCode(ALL_LEVEL_OPTIONS, level)) {
    return null;
  }

  if (!/^[A-Z]\d{2}$/.test(drawingNumber)) {
    return null;
  }

  if (!isRevisionCodeValid(revision) || !findOptionByCode(ALL_STATUS_OPTIONS, status)) {
    return null;
  }

  return {
    namingStandardVersion: isVersion4 ? 4 : 3,
    projectNumber,
    phase,
    disciplineCode,
    documentType,
    buildingDesignation,
    level,
    drawingNumber,
    revision,
    status,
  };
}

export function extractBaseName(fileName: string) {
  const extensionStart = fileName.lastIndexOf(".");
  return extensionStart === -1 ? fileName : fileName.slice(0, extensionStart);
}

export function inferDrawingNumber(baseName: string, disciplineCode?: string) {
  const matches = Array.from(baseName.toUpperCase().matchAll(/(^|[^A-Z0-9])([A-Z]\d{2})(?=[^A-Z0-9]|$)/g));
  if (matches.length === 0) {
    return "";
  }

  if (!disciplineCode) {
    return matches[0]?.[2] ?? "";
  }

  const disciplinePrefix = disciplineCode[0];
  const matchingToken = matches.find((match) => {
    const drawingNumber = match[2] ?? "";
    return drawingNumber.startsWith("X") || drawingNumber.startsWith(disciplinePrefix);
  });

  return matchingToken?.[2] ?? "";
}

export function inferRevision(baseName: string) {
  const matches = Array.from(baseName.toUpperCase().matchAll(/(^|[^A-Z0-9])([RW]\d{2})(?=[^A-Z0-9]|$)/g));
  const validMatch = matches.map((match) => match[2] ?? "").filter((match) => isRevisionCodeValid(match)).at(-1);
  return validMatch ?? "";
}

export function inferOptionCode(baseName: string, options: NamingOption[]) {
  const matches = Array.from(
    baseName.toUpperCase().matchAll(/(^|[^A-Z0-9])([A-Z][A-Z0-9]{1,3})(?=[^A-Z0-9]|$)/g),
  );

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const code = matches[index]?.[2] ?? "";
    if (findOptionByCode(options, code)) {
      return code;
    }
  }

  return inferOptionFromText(baseName, options)?.code ?? "";
}

export function getRevisionFromFileName(fileName: string) {
  const parsed = parseStandardizedFileName(fileName);
  if (parsed?.revision) {
    return parsed.revision;
  }

  return inferRevision(extractBaseName(fileName));
}

export function getStatusFromFileName(fileName: string) {
  const parsed = parseStandardizedFileName(fileName);
  if (parsed?.status) {
    return parsed.status;
  }

  return inferOptionCode(extractBaseName(fileName), STATUS_OPTIONS);
}

export function buildInitialRow(file: NamingFolderFile, defaultRevision: string, defaultStatus: string): NamingFileRow {
  const parsed = parseStandardizedFileName(file.fileName);
  const inferredRevision = getRevisionFromFileName(file.fileName);
  const inferredStatus = getStatusFromFileName(file.fileName);

  return {
    id: file.id,
    sourcePath: file.absolutePath,
    fileName: file.fileName,
    relativePath: file.relativePath,
    extension: file.extension,
    documentType: parsed?.documentType ?? inferOptionFromText(file.baseName, DOCUMENT_TYPE_OPTIONS)?.code ?? "",
    buildingDesignation: parsed?.buildingDesignation ?? "A",
    level: parsed?.level ?? inferOptionFromText(file.baseName, LEVEL_OPTIONS)?.code ?? "",
    drawingNumber: parsed?.drawingNumber ?? inferDrawingNumber(file.baseName),
    drawingNumberLocked: false,
    revision: defaultRevision || inferredRevision,
    status: defaultStatus || inferredStatus,
  };
}

export function mergeRowWithLatestFile(existingRow: NamingFileRow, file: NamingFolderFile): NamingFileRow {
  return {
    ...existingRow,
    sourcePath: file.absolutePath,
    fileName: file.fileName,
    relativePath: file.relativePath,
    extension: file.extension,
  };
}

export function buildTargetFileName(row: NamingFileRow, session: ResolvedSession | null, namingStandardVersion = 4) {
  if (
    !session ||
    !row.documentType ||
    (namingStandardVersion === 4 && !row.buildingDesignation) ||
    !row.level ||
    !row.drawingNumber ||
    !row.revision ||
    !row.status
  ) {
    return "";
  }

  const segments = [
    session.projectNumber,
    session.phaseCode,
    session.disciplineCode,
    row.documentType,
  ];

  if (namingStandardVersion === 4) {
    segments.push(row.buildingDesignation);
  }

  segments.push(row.level, row.drawingNumber, row.revision, row.status);

  return segments.join("-") + row.extension;
}

export { joinWindowsPath };

export function buildDrawingConflictKey(
  session: ResolvedSession,
  row: Pick<NamingFileRow, "buildingDesignation" | "drawingNumber" | "revision" | "status">,
  namingStandardVersion = 4,
) {
  return [
    session.projectNumber,
    session.phaseCode,
    session.disciplineCode,
    namingStandardVersion === 4 ? row.buildingDesignation : "",
    row.drawingNumber,
    row.revision,
    row.status,
  ].join("|");
}

export function buildTargetIdentityKey(
  session: ResolvedSession,
  row: Pick<
    NamingFileRow,
    "documentType" | "buildingDesignation" | "level" | "drawingNumber" | "revision" | "status" | "extension"
  >,
  namingStandardVersion = 4,
) {
  const segments = [
    session.projectNumber,
    session.phaseCode,
    session.disciplineCode,
    row.documentType,
  ];

  if (namingStandardVersion === 4) {
    segments.push(row.buildingDesignation);
  }

  segments.push(row.level, row.drawingNumber, row.revision, row.status, row.extension.toLowerCase());

  return segments.join("|");
}

export function buildDrawingContextKey(
  session: ResolvedSession,
  row: Pick<NamingFileRow, "buildingDesignation" | "revision" | "status">,
  namingStandardVersion = 4,
) {
  return [
    session.projectNumber,
    session.phaseCode,
    session.disciplineCode,
    namingStandardVersion === 4 ? row.buildingDesignation : "",
    row.revision,
    row.status,
  ].join("|");
}

export function getNextDrawingNumber(prefix: string, usedNumbers: Set<string>) {
  for (let index = 1; index <= 99; index += 1) {
    const candidate = formatDrawingNumber(prefix, index);
    if (!usedNumbers.has(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function formatDrawingNumber(prefix: string, index: number) {
  if (index < 1 || index > 99) {
    return "";
  }

  return `${prefix}${String(index).padStart(2, "0")}`;
}

export function extractFileNameFromInput(input: string) {
  return input.trim().replace(/\.[^.]+$/, "");
}
