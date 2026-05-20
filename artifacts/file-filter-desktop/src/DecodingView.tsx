import { useEffect, useMemo, useState, type DragEvent } from "react";
import type {
  DecodeSourceFile,
  DecodingDictionary,
  DecodingTemplate,
  DecodingTemplateField,
  DecodingTemplateSystemFieldKey,
  ParsedStandardName,
} from "./app/types";
import { useNamingStandardVersion } from "./app/standard-config";
import { useTransientBanner } from "./app/useTransientBanner";
import { fileFilterApi } from "./app/api";
import {
  ALL_DISCIPLINE_OPTIONS,
  ALL_DOCUMENT_TYPE_OPTIONS,
  ALL_LEVEL_OPTIONS,
  ALL_PHASE_OPTIONS,
  ALL_STATUS_OPTIONS,
  findOptionByCode,
  parseStandardizedFileName,
} from "./features/naming/domain";

function shouldToggleSelectionFromTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && !target.closest("button, input, select, textarea, a, label");
}

type DecodingViewProps = {
  initialFiles: DecodeSourceFile[];
  launchToken: number;
  dictionaryRefreshToken: number;
  onDictionaryPathChange: (path: string) => void;
  manageTemplatesRequestToken: number;
};

type SessionRow = {
  id: string;
  source: DecodeSourceFile;
  parsed: ParsedStandardName | null;
};

type DecodingFilterKey =
  | "projectNumber"
  | "phase"
  | "disciplineCode"
  | "documentType"
  | "buildingDesignation"
  | "level"
  | "revision"
  | "status";

type DecodingFilterMap = Record<DecodingFilterKey, string[]>;

type DecodingFilterGroup = {
  key: DecodingFilterKey;
  label: string;
};

type DecodingFilterOption = {
  value: string;
  label: string;
};

type TemplateDraft = DecodingTemplate;

type DraggedTemplateField =
  | {
      source: "available";
      fieldKey: DecodingTemplateSystemFieldKey;
    }
  | {
      source: "current";
      field: DecodingTemplateField;
      index: number;
    };

type CustomFieldDraft = {
  id: string;
  label: string;
  value: string;
};

const EMPTY_DICTIONARY: DecodingDictionary = {
  path: "",
  values: {
    projects: {},
    phases: {},
    disciplines: {},
    documentTypes: {},
    levels: {},
    statuses: {},
  },
};

type ElectronFile = File & {
  path?: string;
};

function createTemplateFieldId() {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSystemTemplateField(key: DecodingTemplateSystemFieldKey): DecodingTemplateField {
  return {
    id: createTemplateFieldId(),
    kind: "system",
    key,
  };
}

function createCustomTemplateField(label: string, value: string, id = ""): DecodingTemplateField {
  return {
    id: id || createTemplateFieldId(),
    kind: "custom",
    label: label.trim(),
    value,
  };
}

const BUILT_IN_TEMPLATES: DecodingTemplate[] = [];

const SUPPORTED_IMPORT_EXTENSIONS = new Set([".pdf", ".dwg", ".doc", ".docx", ".xls", ".xlsx"]);

const DECODING_FILTER_GROUPS: DecodingFilterGroup[] = [
  { key: "projectNumber", label: "Projekt" },
  { key: "phase", label: "Faza" },
  { key: "disciplineCode", label: "Branża" },
  { key: "documentType", label: "Typ" },
  { key: "buildingDesignation", label: "Budynek" },
  { key: "level", label: "Poziom" },
  { key: "revision", label: "Rewizja" },
  { key: "status", label: "Status" },
];

const INITIAL_DECODING_FILTERS: DecodingFilterMap = {
  projectNumber: [],
  phase: [],
  disciplineCode: [],
  documentType: [],
  buildingDesignation: [],
  level: [],
  revision: [],
  status: [],
};

const DECODING_TEMPLATE_FIELD_OPTIONS: Array<{ key: DecodingTemplateSystemFieldKey; label: string }> = [
  { key: "projectNumber", label: "Numer projektu" },
  { key: "phase", label: "Faza" },
  { key: "discipline", label: "Branża" },
  { key: "type", label: "Typ" },
  { key: "building", label: "Budynek" },
  { key: "level", label: "Poziom" },
  { key: "number", label: "Numer rysunku" },
  { key: "revision", label: "Rewizja" },
  { key: "status", label: "Status" },
];

const TEMPLATE_SYSTEM_FIELD_LABELS: Record<DecodingTemplateSystemFieldKey, string> = {
  project: "Projekt",
  projectNumber: "Numer projektu",
  phase: "Faza",
  discipline: "Branża",
  type: "Typ",
  building: "Budynek",
  level: "Poziom",
  number: "Numer rysunku",
  revision: "Rewizja",
  status: "Status",
};

const EMPTY_TEMPLATE_DRAFT: TemplateDraft = {
  id: "",
  name: "",
  prefix: "",
  suffix: "",
  separator: " ",
  fields: [createSystemTemplateField("projectNumber"), createSystemTemplateField("type"), createSystemTemplateField("level")],
};

const TEMPLATE_SYSTEM_FIELD_PREVIEW_VALUES: Record<DecodingTemplateSystemFieldKey, string> = {
  project: "Puck realizacja szkoła",
  projectNumber: "25145",
  phase: "projekt techniczny",
  discipline: "architektura",
  type: "przekrój",
  building: "budynek A",
  level: "parteru",
  number: "A05",
  revision: "R00",
  status: "plik roboczy",
};

const LEVEL_NAME_PARTS: Record<string, string> = {
  P0: "parteru",
  P1: "1 piętra",
  P2: "2 piętra",
  M0: "półpiętra nad parterem",
  M1: "półpiętra nad 1 piętrem",
  D0: "dachu",
  B1: "poziomu -1",
  B2: "poziomu -2",
};

const TYPE_NAME_PARTS: Record<string, string> = {
  CSE: "przekrój",
  DET: "detal",
  ELE: "elewacja",
  MAP: "mapa",
  OPP: "opis projektu",
  OPZ: "opis PZT",
  PZT: "PZT",
  RFU: "rzut fundamentów",
  ROG: "rzut",
  RPO: "rzut posadzek",
  RSU: "rzut sufitów",
  SCH: "schemat",
  VIS: "wizualizacja",
  ZSD: "zestawienie drzwi",
  ZSO: "zestawienie okien",
  ZST: "zestawienie",
  ZSW: "zestawienie witryn",
};

function stripCodePrefix(label: string) {
  return label.replace(/^[A-Z0-9]+\s*-\s*/, "").trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toSentenceCase(value: string) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sanitizeFileNamePart(value: string) {
  return value.replace(/[<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").trim();
}

function buildProjectLabel(source: DecodeSourceFile, parsed: ParsedStandardName | null) {
  if (source.projectName) {
    const match = source.projectName.match(/^\d{5}[_\-\s]*(.+)$/);
    if (match?.[1]) {
      return normalizeWhitespace(match[1].replace(/_/g, " "));
    }

    return normalizeWhitespace(source.projectName.replace(/_/g, " "));
  }

  if (source.projectNumber) {
    return source.projectNumber;
  }

  return parsed?.projectNumber ?? "";
}

function getDictionaryValue(
  dictionary: DecodingDictionary,
  section: keyof DecodingDictionary["values"],
  code: string | undefined,
) {
  if (!code) {
    return "";
  }

  return dictionary.values[section][code] ?? "";
}

function getTypePhrase(documentType: string | undefined, dictionary: DecodingDictionary) {
  if (!documentType) {
    return "";
  }

  const configured = getDictionaryValue(dictionary, "documentTypes", documentType);
  if (configured) {
    return configured;
  }

  const direct = TYPE_NAME_PARTS[documentType];
  if (direct) {
    return direct;
  }

  const option = findOptionByCode(ALL_DOCUMENT_TYPE_OPTIONS, documentType);
  return option ? stripCodePrefix(option.label).toLocaleLowerCase("pl") : documentType;
}

function getLevelPhrase(level: string | undefined, dictionary: DecodingDictionary) {
  if (!level) {
    return "";
  }

  if (Object.prototype.hasOwnProperty.call(dictionary.values.levels, level)) {
    return getDictionaryValue(dictionary, "levels", level);
  }

  if (level === "XX") {
    return "";
  }

  const direct = LEVEL_NAME_PARTS[level];
  if (direct) {
    return direct;
  }

  const option = findOptionByCode(ALL_LEVEL_OPTIONS, level);
  return option ? stripCodePrefix(option.label).toLocaleLowerCase("pl") : level;
}

function getDisciplinePhrase(code: string | undefined, dictionary: DecodingDictionary) {
  if (!code) {
    return "";
  }

  const configured = getDictionaryValue(dictionary, "disciplines", code);
  if (configured) {
    return configured;
  }

  const option = findOptionByCode(ALL_DISCIPLINE_OPTIONS, code);
  return option ? stripCodePrefix(option.label).toLocaleLowerCase("pl") : code;
}

function getRecognitionLabel(parsed: ParsedStandardName | null) {
  if (!parsed) {
    return "Nierozpoznane";
  }

  const found = [
    parsed.projectNumber,
    parsed.documentType,
    parsed.buildingDesignation,
    parsed.level,
    parsed.drawingNumber,
  ].filter(Boolean).length;
  if (found >= 4) {
    return "Gotowe";
  }

  if (found >= 2) {
    return "Częściowe";
  }

  return "Nierozpoznane";
}

function buildRecognitionSummary(parsed: ParsedStandardName | null, dictionary: DecodingDictionary) {
  if (!parsed) {
    return "Nie udało się rozpoznać standardowej nazwy.";
  }

  const fragments = [
    parsed.projectNumber ? `Projekt ${parsed.projectNumber}` : "",
    parsed.phase
        ? getDictionaryValue(dictionary, "phases", parsed.phase) ||
        stripCodePrefix(findOptionByCode(ALL_PHASE_OPTIONS, parsed.phase)?.label ?? parsed.phase)
      : "",
    parsed.documentType
        ? getDictionaryValue(dictionary, "documentTypes", parsed.documentType) ||
        stripCodePrefix(findOptionByCode(ALL_DOCUMENT_TYPE_OPTIONS, parsed.documentType)?.label ?? parsed.documentType)
      : "",
    parsed.buildingDesignation ? `Budynek ${parsed.buildingDesignation}` : "",
    parsed.level
        ? getDictionaryValue(dictionary, "levels", parsed.level) ||
        stripCodePrefix(findOptionByCode(ALL_LEVEL_OPTIONS, parsed.level)?.label ?? parsed.level)
      : "",
    parsed.drawingNumber ? `nr ${parsed.drawingNumber}` : "",
    parsed.revision ? parsed.revision : "",
    parsed.status
        ? getDictionaryValue(dictionary, "statuses", parsed.status) ||
        stripCodePrefix(findOptionByCode(ALL_STATUS_OPTIONS, parsed.status)?.label ?? parsed.status)
      : "",
  ].filter(Boolean);

  return fragments.join(" • ");
}

function buildBaseSuggestedName(
  source: DecodeSourceFile,
  parsed: ParsedStandardName | null,
  template: DecodingTemplate,
  dictionary: DecodingDictionary,
) {
  const projectCode = source.projectNumber || parsed?.projectNumber;
  const dictionaryProjectLabel = getDictionaryValue(dictionary, "projects", projectCode);
  const projectLabel = dictionaryProjectLabel || buildProjectLabel(source, parsed);
  const typePhrase = getTypePhrase(parsed?.documentType, dictionary);
  const buildingPhrase = parsed?.buildingDesignation ? `budynek ${parsed.buildingDesignation}` : "";
  const levelPhrase = getLevelPhrase(parsed?.level, dictionary);
  const phasePhrase = parsed?.phase
    ? getDictionaryValue(dictionary, "phases", parsed.phase) ||
      stripCodePrefix(findOptionByCode(ALL_PHASE_OPTIONS, parsed.phase)?.label ?? parsed.phase)
    : "";
  const disciplinePhrase = getDisciplinePhrase(parsed?.disciplineCode, dictionary);
  const revisionPhrase = parsed?.revision || "";
  const statusPhrase = parsed?.status
    ? getDictionaryValue(dictionary, "statuses", parsed.status) ||
      stripCodePrefix(findOptionByCode(ALL_STATUS_OPTIONS, parsed.status)?.label ?? parsed.status)
    : "";

  const partsByField: Record<DecodingTemplateSystemFieldKey, string> = {
    project: projectLabel,
    projectNumber: projectCode ?? "",
    phase: phasePhrase,
    discipline: disciplinePhrase,
    type: typePhrase,
    building: buildingPhrase,
    level: levelPhrase,
    number: parsed?.drawingNumber ?? "",
    revision: revisionPhrase,
    status: statusPhrase,
  };

  const orderedParts = template.fields
    .map((field) => {
      if (field.kind === "custom") {
        return field.value.trim();
      }

      return partsByField[field.key];
    })
    .filter(Boolean);

  if (orderedParts.length === 0 && source.baseName) {
    orderedParts.push(source.baseName);
  }

  const separator = template.separator ?? "";
  const nameParts = [template.prefix.trim(), ...orderedParts, template.suffix.trim()].filter(Boolean);
  return toSentenceCase(normalizeWhitespace(nameParts.join(separator)));
}

function makeUniqueNames(
  rows: SessionRow[],
  manualNames: Record<string, string>,
  template: DecodingTemplate | null,
  dictionary: DecodingDictionary,
) {
  if (!template) {
    return rows.map(() => "");
  }

  const counts = new Map<string, number>();

  return rows.map((row) => {
    const manualName = manualNames[row.id]?.trim();
    const baseName = sanitizeFileNamePart(
      manualName || buildBaseSuggestedName(row.source, row.parsed, template, dictionary),
    );

    if (!baseName) {
      return "";
    }

    const normalizedKey = `${baseName.toLocaleLowerCase("pl")}|${row.source.extension}`;
    const count = counts.get(normalizedKey) ?? 0;
    counts.set(normalizedKey, count + 1);

    if (count === 0) {
      return baseName;
    }

    const suffixParts = [
      row.parsed?.drawingNumber,
      row.parsed?.revision,
      getDisciplinePhrase(row.parsed?.disciplineCode, dictionary),
    ]
      .filter(Boolean)
      .map((part) => sanitizeFileNamePart(part ?? ""));
    const suffix = suffixParts[count - 1] || String(count + 1);

    return sanitizeFileNamePart(`${baseName} (${suffix})`);
  });
}

function buildRows(files: DecodeSourceFile[]) {
  return files.map((source) => ({
    id: source.id,
    source,
    parsed: parseStandardizedFileName(source.fileName),
  }));
}

function getDecodingFilterValue(row: SessionRow, key: DecodingFilterKey) {
  switch (key) {
    case "projectNumber":
      return row.parsed?.projectNumber || row.source.projectNumber || "";
    case "phase":
      return row.parsed?.phase || "";
    case "disciplineCode":
      return row.parsed?.disciplineCode || "";
    case "documentType":
      return row.parsed?.documentType || "";
    case "buildingDesignation":
      return row.parsed?.buildingDesignation || "";
    case "level":
      return row.parsed?.level || "";
    case "revision":
      return row.parsed?.revision || "";
    case "status":
      return row.parsed?.status || "";
    default:
      return "";
  }
}

function getDecodingFilterLabel(key: DecodingFilterKey, value: string) {
  if (!value) {
    return "";
  }

  if (key === "projectNumber") {
    return value;
  }

  if (key === "phase") {
    return stripCodePrefix(findOptionByCode(ALL_PHASE_OPTIONS, value)?.label ?? value);
  }

  if (key === "disciplineCode") {
    return stripCodePrefix(findOptionByCode(ALL_DISCIPLINE_OPTIONS, value)?.label ?? value);
  }

  if (key === "documentType") {
    return stripCodePrefix(findOptionByCode(ALL_DOCUMENT_TYPE_OPTIONS, value)?.label ?? value);
  }

  if (key === "buildingDesignation") {
    return value === "X" ? "X - wiele budynków" : `Budynek ${value}`;
  }

  if (key === "level") {
    return stripCodePrefix(findOptionByCode(ALL_LEVEL_OPTIONS, value)?.label ?? value);
  }

  if (key === "status") {
    return stripCodePrefix(findOptionByCode(ALL_STATUS_OPTIONS, value)?.label ?? value);
  }

  return value;
}

function compareDecodingFilterOptions(left: DecodingFilterOption, right: DecodingFilterOption) {
  return left.label.localeCompare(right.label, "pl", {
    numeric: true,
    sensitivity: "base",
  });
}

function createTemplateId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTemplateFieldLabel(field: DecodingTemplateField) {
  if (field.kind === "custom") {
    return field.label.trim() || "Własne pole";
  }

  return TEMPLATE_SYSTEM_FIELD_LABELS[field.key] ?? field.key;
}

function getTemplatePreviewValue(field: DecodingTemplateField) {
  if (field.kind === "custom") {
    return field.value.trim();
  }

  return TEMPLATE_SYSTEM_FIELD_PREVIEW_VALUES[field.key];
}

function buildTemplatePreviewName(template: Pick<TemplateDraft, "prefix" | "suffix" | "separator" | "fields">) {
  return toSentenceCase(
    normalizeWhitespace(
      [template.prefix.trim(), ...template.fields.map((field) => getTemplatePreviewValue(field)), template.suffix.trim()]
        .filter(Boolean)
        .join(template.separator ?? ""),
    ),
  );
}

function getTemplateSummary(template: Pick<DecodingTemplate, "prefix" | "suffix" | "separator" | "fields">) {
  const parts = template.fields.map((field) => getTemplateFieldLabel(field));
  const prefix = template.prefix.trim();
  const suffix = template.suffix.trim();
  const separator = template.separator === "" ? "(bez separatora)" : `"${template.separator}"`;

  return [prefix ? `Prefiks: ${prefix}` : "", parts.length > 0 ? parts.join(" + ") : "", suffix ? `Sufiks: ${suffix}` : "", separator]
    .filter(Boolean)
    .join(" • ");
}

function matchesDecodingFilters(
  row: SessionRow,
  filters: DecodingFilterMap,
  excludedKey?: DecodingFilterKey,
) {
  return DECODING_FILTER_GROUPS.every((group) => {
    if (group.key === excludedKey) {
      return true;
    }

    const selectedValues = filters[group.key];
    if (selectedValues.length === 0) {
      return true;
    }

    return selectedValues.includes(getDecodingFilterValue(row, group.key));
  });
}

function getFolderPath(absolutePath: string) {
  return absolutePath.replace(/[\\/][^\\/]+$/, "");
}

function buildSourceFileFromBrowserFile(file: File & { path?: string }, index: number): DecodeSourceFile | null {
  const absolutePath =
    (typeof file.path === "string" && file.path) ||
    fileFilterApi.getPathForDroppedFile(file) ||
    "";
  const extensionMatch = /\.[^.]+$/.exec(file.name);
  const extension = extensionMatch?.[0]?.toLowerCase() ?? "";
  const baseName = extension ? file.name.slice(0, -extension.length) : file.name;

  if (!absolutePath) {
    return {
      id: `browser-file-${Date.now()}-${index}-${file.name}`,
      fileName: file.name,
      absolutePath: "",
      folderPath: "",
      extension,
      baseName,
    };
  }

  return {
    id: absolutePath,
    fileName: file.name,
    absolutePath,
    folderPath: getFolderPath(absolutePath),
    extension,
    baseName,
  };
}

function parseImportedFiles(fileList: FileList | null) {
  if (!fileList || fileList.length === 0) {
    return [];
  }

  return Array.from(fileList)
    .map((file, index) => buildSourceFileFromBrowserFile(file as ElectronFile, index))
    .filter((file) => file?.extension ? SUPPORTED_IMPORT_EXTENSIONS.has(file.extension) : true)
    .filter((file): file is DecodeSourceFile => Boolean(file));
}

function mergeFiles(current: DecodeSourceFile[], imported: DecodeSourceFile[]) {
  const knownIds = new Set(current.map((file) => file.id));
  return [...current, ...imported.filter((file) => !knownIds.has(file.id))];
}

export function DecodingView({
  initialFiles,
  launchToken,
  dictionaryRefreshToken,
  onDictionaryPathChange,
  manageTemplatesRequestToken,
}: DecodingViewProps) {
  const namingStandardVersion = useNamingStandardVersion();
  const [sessionFiles, setSessionFiles] = useState<DecodeSourceFile[]>(initialFiles);
  const [dictionary, setDictionary] = useState<DecodingDictionary>(EMPTY_DICTIONARY);
  const [customTemplates, setCustomTemplates] = useState<DecodingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [manualNames, setManualNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"muted" | "success" | "error">("muted");
  const [exporting, setExporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [recognitionFiltersOpen, setRecognitionFiltersOpen] = useState(false);
  const [recognitionFilters, setRecognitionFilters] = useState<DecodingFilterMap>(INITIAL_DECODING_FILTERS);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState(EMPTY_TEMPLATE_DRAFT);
  const [templateSaveError, setTemplateSaveError] = useState("");
  const [customFieldDraft, setCustomFieldDraft] = useState<CustomFieldDraft>({ id: "", label: "", value: "" });
  const [draggedTemplateField, setDraggedTemplateField] = useState<DraggedTemplateField | null>(null);
  const [templateDropHandled, setTemplateDropHandled] = useState(false);

  useTransientBanner(message, () => setMessage(""));
  useTransientBanner(templateSaveError, () => setTemplateSaveError(""));

  const availableTemplates = useMemo(
    () => [...BUILT_IN_TEMPLATES, ...customTemplates],
    [customTemplates],
  );

  const selectedTemplate =
    availableTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  const templatePreviewName = useMemo(() => buildTemplatePreviewName(templateDraft), [templateDraft]);

  useEffect(() => {
    if (initialFiles.length === 0) {
      return;
    }

    setSessionFiles((current) => {
      const mergedFiles = mergeFiles(current, initialFiles);
      const addedCount = mergedFiles.length - current.length;

      if (addedCount > 0) {
        setMessage(
          current.length === 0
            ? `Przeniesiono ${addedCount} plików do odkodowania.`
            : `Dodano ${addedCount} plików z filtra do odkodowania.`,
        );
        setMessageTone("success");
      } else {
        setMessage("Wybrane pliki z filtra są już w sesji odkodowania.");
        setMessageTone("muted");
      }

      return mergedFiles;
    });
  }, [initialFiles, launchToken]);

  useEffect(() => {
    void refreshDictionary();
  }, [dictionaryRefreshToken]);

  useEffect(() => {
    void loadTemplateSettings();
  }, []);

  useEffect(() => {
    const templateExists = availableTemplates.some((template) => template.id === selectedTemplateId);
    if (!templateExists) {
      setSelectedTemplateId(availableTemplates[0]?.id ?? "");
    }
  }, [availableTemplates, selectedTemplateId]);

  useEffect(() => {
    onDictionaryPathChange(dictionary.path);
    return () => onDictionaryPathChange("");
  }, [dictionary.path, onDictionaryPathChange]);

  const rows = useMemo(() => buildRows(sessionFiles), [namingStandardVersion, sessionFiles]);
  const rowsWithParsedData = useMemo(() => rows.filter((row) => row.parsed), [rows]);
  const suggestedNames = useMemo(
    () => makeUniqueNames(rows, manualNames, selectedTemplate, dictionary),
    [dictionary, manualNames, namingStandardVersion, rows, selectedTemplate],
  );

  const recognitionFilterOptions = useMemo(
    () =>
      Object.fromEntries(
        DECODING_FILTER_GROUPS.map((group) => {
          const options = rowsWithParsedData
            .filter((row) => matchesDecodingFilters(row, recognitionFilters, group.key))
            .map((row) => {
              const value = getDecodingFilterValue(row, group.key);
              return {
                value,
                label: getDecodingFilterLabel(group.key, value),
              };
            })
            .filter((option) => option.value && option.label);

          const deduped = Array.from(new Map(options.map((option) => [option.value, option])).values())
            .sort(compareDecodingFilterOptions);

          return [group.key, deduped];
        }),
      ) as Record<DecodingFilterKey, DecodingFilterOption[]>,
    [namingStandardVersion, recognitionFilters, rowsWithParsedData],
  );

  const evaluatedRows = useMemo(
    () =>
      rows.map((row, index) => {
        const suggestedName = suggestedNames[index] ?? "";
        const recognitionLabel = getRecognitionLabel(row.parsed);
        const finalFileName = suggestedName ? `${suggestedName}${row.source.extension}` : "";

        return {
          ...row,
          recognitionLabel,
          recognitionSummary: buildRecognitionSummary(row.parsed, dictionary),
          suggestedName,
          finalFileName,
          canExport: Boolean(row.source.absolutePath && finalFileName),
        };
      }),
    [dictionary, namingStandardVersion, rows, suggestedNames],
  );

  const visibleRows = useMemo(
    () => evaluatedRows.filter((row) => matchesDecodingFilters(row, recognitionFilters)),
    [evaluatedRows, recognitionFilters],
  );
  const selectedRowIdSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);
  const visibleRowIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const allVisibleRowsSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((rowId) => selectedRowIdSet.has(rowId));

  const activeRecognitionFilterCount = useMemo(
    () => Object.values(recognitionFilters).reduce((sum, values) => sum + values.length, 0),
    [recognitionFilters],
  );

  useEffect(() => {
    setRecognitionFilters((current) => {
      let changed = false;
      const next = { ...current };

      for (const group of DECODING_FILTER_GROUPS) {
        const availableValues = new Set(recognitionFilterOptions[group.key].map((option) => option.value));
        const sanitized = current[group.key].filter((value) => availableValues.has(value));
        if (sanitized.length !== current[group.key].length) {
          next[group.key] = sanitized;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [recognitionFilterOptions]);

  const exportableRows = visibleRows.filter((row) => row.canExport);
  const unresolvedRows = visibleRows.filter((row) => !row.suggestedName);

  async function refreshDictionary() {
    try {
      const nextDictionary = await fileFilterApi.getDecodingDictionary();
      setDictionary(nextDictionary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wczytać słownika tłumaczeń.");
      setMessageTone("error");
    }
  }

  async function loadTemplateSettings() {
    try {
      const settings = await fileFilterApi.getSettings();
      setCustomTemplates(settings.decodingTemplates);
      setSelectedTemplateId((current) =>
        [...BUILT_IN_TEMPLATES, ...settings.decodingTemplates].some((template) => template.id === current)
          ? current
          : settings.decodingTemplates[0]?.id ?? "",
      );
    } catch {
      // ignore settings load errors in decoding view
    }
  }

  function handleFilesImported(importedFiles: DecodeSourceFile[]) {
    if (importedFiles.length === 0) {
      setMessage("Nie wybrano żadnych obsługiwanych plików.");
      setMessageTone("error");
      return;
    }

    setSessionFiles((current) => mergeFiles(current, importedFiles));
    setMessage(`Dodano ${importedFiles.length} plików do sesji.`);
    setMessageTone("success");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    handleFilesImported(parseImportedFiles(event.dataTransfer.files));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!dragActive) {
      setDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setDragActive(false);
  }

  function handleRemoveRow(rowId: string) {
    setSessionFiles((current) => current.filter((file) => file.id !== rowId));
    setSelectedRowIds((current) => current.filter((selectedId) => selectedId !== rowId));
    setManualNames((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }

  function toggleRowSelection(rowId: string) {
    setSelectedRowIds((current) =>
      current.includes(rowId) ? current.filter((selectedId) => selectedId !== rowId) : [...current, rowId],
    );
  }

  function toggleAllVisibleRows() {
    if (visibleRowIds.length === 0) {
      return;
    }

    const areAllSelected = visibleRowIds.every((rowId) => selectedRowIdSet.has(rowId));
    setSelectedRowIds((current) =>
      areAllSelected
        ? current.filter((rowId) => !visibleRowIds.includes(rowId))
        : [...new Set([...current, ...visibleRowIds])],
    );
  }

  function toggleRecognitionFilter(filterKey: DecodingFilterKey, value: string) {
    setRecognitionFilters((current) => {
      const activeValues = current[filterKey];
      const nextValues = activeValues.includes(value)
        ? activeValues.filter((item) => item !== value)
        : [...activeValues, value];

      return {
        ...current,
        [filterKey]: nextValues,
      };
    });
  }

  function clearRecognitionFilters() {
    setRecognitionFilters(INITIAL_DECODING_FILTERS);
  }

  function openNewTemplateModal() {
    setTemplateManagerOpen(false);
    setTemplateDraft({
      ...EMPTY_TEMPLATE_DRAFT,
      id: "",
      fields: [...EMPTY_TEMPLATE_DRAFT.fields],
    });
    setCustomFieldDraft({ id: "", label: "", value: "" });
    setTemplateSaveError("");
    setTemplateModalOpen(true);
  }

  function removeTemplateField(index: number) {
    setTemplateDraft((current) => ({
      ...current,
      fields: current.fields.filter((_field, fieldIndex) => fieldIndex !== index),
    }));
  }

  function insertTemplateField(field: DecodingTemplateField, targetIndex?: number) {
    setTemplateDraft((current) => ({
      ...current,
      fields: (() => {
        const nextFields = [...current.fields];
        const insertionIndex =
          typeof targetIndex === "number" && targetIndex >= 0 && targetIndex <= nextFields.length
            ? targetIndex
            : nextFields.length;
        nextFields.splice(insertionIndex, 0, field);
        return nextFields;
      })(),
    }));
  }

  function resetCustomFieldDraft() {
    setCustomFieldDraft({ id: "", label: "", value: "" });
  }

  function startEditingCustomField(field: Extract<DecodingTemplateField, { kind: "custom" }>) {
    setCustomFieldDraft({
      id: field.id,
      label: field.label,
      value: field.value,
    });
  }

  function saveCustomFieldDraft() {
    const trimmedLabel = customFieldDraft.label.trim();
    const trimmedValue = customFieldDraft.value.trim();

    if (!trimmedLabel) {
      setTemplateSaveError("Podaj nazwę własnego pola.");
      return;
    }

    if (!trimmedValue) {
      setTemplateSaveError("Podaj wartość tekstową własnego pola.");
      return;
    }

    const nextField = createCustomTemplateField(trimmedLabel, trimmedValue, customFieldDraft.id);

    setTemplateDraft((current) => {
      if (customFieldDraft.id) {
        return {
          ...current,
          fields: current.fields.map((field) => (field.id === customFieldDraft.id ? nextField : field)),
        };
      }

      return {
        ...current,
        fields: [...current.fields, nextField],
      };
    });

    setTemplateSaveError("");
    resetCustomFieldDraft();
  }

  function handleTemplateFieldDrop(targetIndex?: number) {
    if (!draggedTemplateField) {
      return;
    }

    setTemplateDraft((current) => {
      const nextFields = [...current.fields];

      if (draggedTemplateField.source === "current") {
        if (draggedTemplateField.index < 0 || draggedTemplateField.index >= nextFields.length) {
          return current;
        }

        const [movedField] = nextFields.splice(draggedTemplateField.index, 1);
        const insertionIndex =
          typeof targetIndex === "number"
            ? Math.max(
                0,
                Math.min(
                  targetIndex > draggedTemplateField.index ? targetIndex - 1 : targetIndex,
                  nextFields.length,
                ),
              )
            : nextFields.length;
        nextFields.splice(insertionIndex, 0, movedField);
      } else {
        const insertionIndex =
          typeof targetIndex === "number" ? Math.max(0, Math.min(targetIndex, nextFields.length)) : nextFields.length;
        nextFields.splice(insertionIndex, 0, createSystemTemplateField(draggedTemplateField.fieldKey));
      }

      return {
        ...current,
        fields: nextFields,
      };
    });

    setTemplateDropHandled(true);
    setDraggedTemplateField(null);
  }

  async function saveTemplateDraft() {
    const trimmedName = templateDraft.name.trim();
    if (!trimmedName) {
      setTemplateSaveError("Podaj nazwę szablonu.");
      return;
    }

    if (templateDraft.fields.length === 0) {
      setTemplateSaveError("Dodaj przynajmniej jedno pole do szablonu.");
      return;
    }

    const nextTemplate: DecodingTemplate = {
      id: templateDraft.id || createTemplateId(),
      name: trimmedName,
      prefix: templateDraft.prefix.trim(),
      suffix: templateDraft.suffix.trim(),
      separator: templateDraft.separator.slice(0, 1),
      fields: templateDraft.fields,
    };

    const nextTemplates = templateDraft.id
      ? customTemplates.map((template) => (template.id === templateDraft.id ? nextTemplate : template))
      : [...customTemplates, nextTemplate];

    try {
      const settings = await fileFilterApi.updateDecodingTemplates(nextTemplates);
      setCustomTemplates(settings.decodingTemplates);
      const savedTemplate =
        settings.decodingTemplates.find((template) => template.id === nextTemplate.id) ??
        settings.decodingTemplates.find((template) => template.name === nextTemplate.name);
      setSelectedTemplateId(savedTemplate?.id ?? nextTemplate.id);
      setTemplateModalOpen(false);
      setTemplateManagerOpen(true);
      setTemplateSaveError("");
      setMessage(`Zapisano szablon "${nextTemplate.name}".`);
      setMessageTone("success");
    } catch (error) {
      setTemplateSaveError(error instanceof Error ? error.message : "Nie udało się zapisać szablonu.");
    }
  }

  async function deleteTemplate(templateId: string) {
    const templateToDelete = customTemplates.find((template) => template.id === templateId);
    if (!templateToDelete) {
      return;
    }

    const nextTemplates = customTemplates.filter((template) => template.id !== templateId);

    try {
      const settings = await fileFilterApi.updateDecodingTemplates(nextTemplates);
      setCustomTemplates(settings.decodingTemplates);
      setSelectedTemplateId((current) => {
        if (current !== templateId) {
          return current;
        }

        return settings.decodingTemplates[0]?.id ?? "";
      });
      setMessage(`Usunięto szablon "${templateToDelete.name}".`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć szablonu.");
      setMessageTone("error");
    }
  }

  function editSelectedTemplate() {
    const editableTemplate = customTemplates.find((template) => template.id === selectedTemplateId);
    if (!editableTemplate) {
      openNewTemplateModal();
      return;
    }

    setTemplateDraft({
      id: editableTemplate.id,
      name: editableTemplate.name,
      prefix: editableTemplate.prefix,
      suffix: editableTemplate.suffix,
      separator: editableTemplate.separator ?? "",
      fields: editableTemplate.fields.map((field) =>
        field.kind === "custom"
          ? createCustomTemplateField(field.label, field.value, field.id)
          : { ...field },
      ),
    });
    resetCustomFieldDraft();
    setTemplateSaveError("");
    setTemplateManagerOpen(false);
    setTemplateModalOpen(true);
  }

  useEffect(() => {
    if (manageTemplatesRequestToken === 0) {
      return;
    }

    setTemplateManagerOpen(true);
  }, [manageTemplatesRequestToken]);

  async function handleExportCopies() {
    if (!selectedTemplate) {
      setMessage("Najpierw utwórz i wybierz własny szablon.");
      setMessageTone("error");
      return;
    }

    if (exportableRows.length === 0) {
      setMessage("Brak plików gotowych do eksportu.");
      setMessageTone("error");
      return;
    }

    const targetFolder = await fileFilterApi.chooseDirectory("Wybierz folder dla odkodowanych kopii");
    if (!targetFolder) {
      return;
    }

    setExporting(true);
    setMessage("");

    try {
      await fileFilterApi.copyNamingFiles(
        exportableRows.map((row) => ({
          sourcePath: row.source.absolutePath,
          targetPath: `${targetFolder.replace(/[\\/]+$/, "")}\\${row.finalFileName}`,
        })),
      );
      setMessage(`Wyeksportowano ${exportableRows.length} plików.`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wyeksportować plików.");
      setMessageTone("error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="decoding-layout">
      <div className="naming-card decoding-intro-card">
        <div className="panel-header">
          <div>
            <h2>Szablon</h2>
          </div>
          <div className="status-strip">
            <span>{visibleRows.length} plików w sesji</span>
            <span>{exportableRows.length} gotowych do eksportu</span>
            <span>{unresolvedRows.length} wymagających uzupełnienia</span>
            <span>Zaznaczono {selectedRowIds.length}</span>
          </div>
        </div>

        <div className="decoding-input-grid">
          <label className="field decoding-template-select-field">
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              disabled={availableTemplates.length === 0}
            >
              {availableTemplates.length === 0 ? (
                <option value="">Najpierw utwórz szablon</option>
              ) : null}
              {availableTemplates.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <div className="decoding-actions-stack">
            <button type="button" className="ghost-button" onClick={() => setTemplateManagerOpen(true)}>
              Menedżer szablonów
            </button>
          </div>
        </div>

        {message ? <div className={`banner ${messageTone}`}>{message}</div> : null}
      </div>

      <div
        className={`naming-card decoding-table-card decoding-session-surface ${dragActive ? "active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="panel-header">
          <div>
            <h2>Odkodowanie</h2>
          </div>
          <div className="decoding-export-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setSessionFiles([]);
                setManualNames({});
                setMessage("");
              }}
              disabled={evaluatedRows.length === 0}
            >
              Wyczyść sesję
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleExportCopies()}
              disabled={exporting || exportableRows.length === 0 || !selectedTemplate}
            >
              {exporting ? "Eksportowanie..." : "Eksportuj kopie"}
            </button>
          </div>
        </div>

        {evaluatedRows.length === 0 ? (
          <div className="empty-state empty-state-compact decoding-empty-drop-state">
            <h3>Przeciągnij tutaj pliki PDF, DWG, DOC itd.</h3>
          </div>
        ) : (
          <div className="table-wrap decoding-table-wrap">
            <div className="decoding-inline-drop-hint">
              Upuść kolejne pliki tutaj, aby dodać je do bieżącej sesji.
            </div>
            <div className="decoding-table-scroll">
              <table className="decoding-table">
                <thead>
                  <tr>
                    <th className="column-check">
                      <input
                        type="checkbox"
                        checked={allVisibleRowsSelected}
                        onChange={toggleAllVisibleRows}
                        aria-label="Zaznacz wszystkie widoczne pliki do odkodowania"
                      />
                    </th>
                    <th className="decoding-column-original">Oryginalna nazwa</th>
                    <th className="decoding-column-recognition">
                      <button
                        type="button"
                        className={`sort-button decoding-filter-trigger ${activeRecognitionFilterCount > 0 ? "active" : ""}`}
                        onClick={() => setRecognitionFiltersOpen(true)}
                        aria-label="Otwórz dodatkowe filtry rozpoznanych danych"
                      >
                        <span>Rozpoznano</span>
                        <span className="decoding-filter-trigger-icon" aria-hidden="true">▼</span>
                        {activeRecognitionFilterCount > 0 ? (
                          <span className="decoding-filter-count">{activeRecognitionFilterCount}</span>
                        ) : null}
                      </button>
                    </th>
                    <th className="decoding-column-suggested">Proponowana nazwa</th>
                    <th className="decoding-column-status">Status</th>
                    <th className="decoding-column-actions">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={(event) => {
                        if (shouldToggleSelectionFromTarget(event.target)) {
                          toggleRowSelection(row.id);
                        }
                      }}
                    >
                      <td className="column-check">
                        <input
                          type="checkbox"
                          checked={selectedRowIdSet.has(row.id)}
                          onChange={() => toggleRowSelection(row.id)}
                          aria-label={`Zaznacz plik ${row.source.fileName} do odkodowania`}
                        />
                      </td>
                      <td className="column-file decoding-column-original">
                        <div className="file-cell">
                          <div className="file-cell-copy">
                            {row.source.absolutePath ? (
                              <button
                                type="button"
                                className="decoding-original-name decoding-original-name-button"
                                onClick={() => void fileFilterApi.openFolder(row.source.folderPath)}
                              >
                                {row.source.fileName}
                              </button>
                            ) : (
                              <span className="decoding-original-name">{row.source.fileName}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="decoding-column-recognition">
                        <div className="decoding-summary">
                          {row.recognitionLabel !== "Gotowe" ? <strong>{row.recognitionLabel}</strong> : null}
                          <span>{row.recognitionSummary}</span>
                          {!row.source.absolutePath ? (
                            <span className="decoding-warning-text">
                              Tylko odczyt nazwy. Aby wyeksportować kopię, dodaj plik z lokalnego dysku.
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="decoding-column-suggested">
                        <div className="decoding-name-editor">
                          <input
                            value={manualNames[row.id] ?? row.suggestedName}
                            onChange={(event) =>
                              setManualNames((current) => ({
                                ...current,
                                [row.id]: event.target.value,
                              }))
                            }
                            placeholder="Uzupełnij prostą nazwę"
                          />
                        </div>
                      </td>
                      <td className="decoding-column-status">
                        <span
                          className={`status-pill ${
                            row.recognitionLabel === "Gotowe"
                              ? "valid"
                              : row.recognitionLabel === "Częściowe"
                                ? "warning"
                                : "invalid"
                          }`}
                        >
                          {row.recognitionLabel}
                        </span>
                      </td>
                      <td className="decoding-column-actions">
                        <div className="actions decoding-row-actions">
                          {row.source.absolutePath ? (
                            <button type="button" onClick={() => void fileFilterApi.openFile(row.source.absolutePath)}>
                              Otwórz plik
                            </button>
                          ) : null}
                          <button type="button" onClick={() => handleRemoveRow(row.id)}>
                            Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {recognitionFiltersOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setRecognitionFiltersOpen(false)}
        >
          <div
            className="modal-card modal-card-wide decoding-filters-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decoding-filters-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">Rozpoznano</p>
                <h3 id="decoding-filters-title">Filtry odkodowania</h3>
              </div>
              <button type="button" className="link-button" onClick={clearRecognitionFilters}>
                Resetuj
              </button>
            </div>

            <div className="decoding-filters-summary">
              <span>{visibleRows.length} pasujących plików</span>
              <span>{activeRecognitionFilterCount} aktywnych filtrów</span>
            </div>

            <div className="decoding-filters-groups">
              {DECODING_FILTER_GROUPS.map((group) => {
                const options = recognitionFilterOptions[group.key];
                if (options.length === 0) {
                  return null;
                }

                return (
                  <section key={group.key} className="filter-group decoding-filter-group">
                    <div className="filter-group-header">
                      <h3>{group.label}</h3>
                      <span>{recognitionFilters[group.key].length}</span>
                    </div>
                    <div className="chip-grid">
                      {options.map((option) => {
                        const active = recognitionFilters[group.key].includes(option.value);
                        return (
                          <button
                            key={`${group.key}-${option.value}`}
                            type="button"
                            className={`chip ${active ? "active" : ""}`}
                            onClick={() => toggleRecognitionFilter(group.key, option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setRecognitionFiltersOpen(false)}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {templateManagerOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setTemplateManagerOpen(false)}
        >
          <div
            className="modal-card modal-card-wide decoding-template-manager-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decoding-template-manager-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">Szablony</p>
                <h3 id="decoding-template-manager-title">Menedżer szablonów</h3>
              </div>
              <button type="button" className="ghost-button" onClick={openNewTemplateModal}>
                Dodaj szablon
              </button>
            </div>

            <div className="decoding-template-manager-list">
              {customTemplates.length === 0 ? (
                <div className="empty-state empty-state-compact">
                  <h3>Brak własnych szablonów</h3>
                </div>
              ) : (
                customTemplates.map((template) => (
                  <div key={template.id} className="decoding-template-manager-row">
                    <div className="decoding-template-manager-copy">
                      <strong>{template.name}</strong>
                      <span>{getTemplateSummary(template)}</span>
                    </div>
                    <div className="decoding-template-manager-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setTemplateManagerOpen(false);
                        }}
                      >
                        Wybierz
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          editSelectedTemplate();
                        }}
                      >
                        Edytuj
                      </button>
                      <button type="button" className="ghost-button" onClick={() => void deleteTemplate(template.id)}>
                        Usuń
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setTemplateManagerOpen(false)}>
                Zamknij
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {templateModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setTemplateModalOpen(false)}
        >
          <div
            className="modal-card modal-card-wide decoding-template-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decoding-template-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h3 id="decoding-template-title">{templateDraft.id ? "Edytuj szablon" : "Nowy szablon"}</h3>
            </div>

            <div className="decoding-template-layout-grid">
              <div className="decoding-template-form-column">
                <label className="field">
                  <span>Nazwa szablonu</span>
                  <input
                    value={templateDraft.name}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="np. Projekt + typ + rewizja"
                  />
                </label>
              </div>

              <div className="decoding-template-form-column">
                <label className="field">
                  <span>Prefiks</span>
                  <input
                    value={templateDraft.prefix}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        prefix: event.target.value,
                      }))
                    }
                    placeholder="np. Oferta"
                  />
                </label>

                <label className="field">
                  <span>Sufiks</span>
                  <input
                    value={templateDraft.suffix}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        suffix: event.target.value,
                      }))
                    }
                    placeholder="np. do wysyłki"
                  />
                </label>
              </div>

              <div className="decoding-template-form-column decoding-template-form-column-compact">
                <label className="field">
                  <span>Separator</span>
                  <input
                    value={templateDraft.separator}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        separator: event.target.value.slice(0, 1),
                      }))
                    }
                    placeholder="np. spacja"
                    maxLength={1}
                  />
                </label>
              </div>
            </div>

            <div className="decoding-template-preview">
              <span>Podgląd nazwy</span>
              <strong>{templatePreviewName || "Brak podglądu"}</strong>
            </div>

            <div className="decoding-template-builder">
              <div className="decoding-template-current decoding-template-section-full">
                <div className="panel-header">
                  <div>
                    <h3>Pola szablonu</h3>
                  </div>
                </div>

                <div className="decoding-template-field-list">
                  {templateDraft.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className={`decoding-template-field-row ${
                        draggedTemplateField?.source === "current" && draggedTemplateField.index === index ? "dragging" : ""
                      }`}
                      draggable
                      onDragStart={(event) => {
                        setDraggedTemplateField({
                          source: "current",
                          field,
                          index,
                        });
                        setTemplateDropHandled(false);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", `${field}:${index}`);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleTemplateFieldDrop(index);
                      }}
                      onDragEnd={() => {
                        if (draggedTemplateField?.source === "current" && !templateDropHandled) {
                          removeTemplateField(index);
                        }
                        setDraggedTemplateField(null);
                        setTemplateDropHandled(false);
                      }}
                    >
                      <strong>{getTemplateFieldLabel(field)}</strong>
                      {field.kind === "custom" ? <span>{field.value}</span> : null}
                      {field.kind === "custom" ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditingCustomField(field);
                          }}
                        >
                          Edytuj
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <div
                    className="decoding-template-drop-tail"
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleTemplateFieldDrop();
                    }}
                  >
                    Upuść tutaj
                  </div>
                </div>
              </div>

              <div className="decoding-template-available decoding-template-section-full">
                <div className="panel-header">
                  <h3>Dostępne pola</h3>
                </div>

                <div className="chip-grid">
                  {DECODING_TEMPLATE_FIELD_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className="chip"
                      draggable
                      onDragStart={(event) => {
                        setDraggedTemplateField({
                          source: "available",
                          fieldKey: option.key,
                        });
                        setTemplateDropHandled(false);
                        event.dataTransfer.effectAllowed = "copyMove";
                        event.dataTransfer.setData("text/plain", option.key);
                      }}
                      onDragEnd={() => {
                        setDraggedTemplateField(null);
                        setTemplateDropHandled(false);
                      }}
                      onClick={() => insertTemplateField(createSystemTemplateField(option.key))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="decoding-template-custom-field-builder">
                  <div className="panel-header">
                    <h4>Własne pole</h4>
                  </div>

                  <div className="decoding-template-custom-field-grid">
                    <label className="field">
                      <span>Nazwa pola</span>
                      <input
                        value={customFieldDraft.label}
                        onChange={(event) =>
                          setCustomFieldDraft((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                        placeholder="np. Inwestor"
                      />
                    </label>

                    <label className="field">
                      <span>Wartość tekstowa</span>
                      <input
                        value={customFieldDraft.value}
                        onChange={(event) =>
                          setCustomFieldDraft((current) => ({
                            ...current,
                            value: event.target.value,
                          }))
                        }
                        placeholder="np. Ekoinbud"
                      />
                    </label>
                  </div>

                  <div className="decoding-template-custom-field-actions">
                    {customFieldDraft.id ? (
                      <button type="button" className="ghost-button" onClick={resetCustomFieldDraft}>
                        Anuluj edycję
                      </button>
                    ) : null}
                    <button type="button" className="ghost-button" onClick={saveCustomFieldDraft}>
                      {customFieldDraft.id ? "Zapisz pole" : "Dodaj pole"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {templateSaveError ? <div className="banner error">{templateSaveError}</div> : null}

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setTemplateModalOpen(false)}>
                Anuluj
              </button>
              <button type="button" className="primary-button" onClick={() => void saveTemplateDraft()}>
                Zapisz szablon
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
