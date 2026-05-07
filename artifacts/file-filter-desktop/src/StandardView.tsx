import { Fragment, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fileFilterApi } from "./app/api";
import {
  getNamingStandardConfigSnapshot,
  saveRuntimeNamingStandard,
  useNamingStandardVersion,
} from "./app/standard-config";
import type { NamingOption, NamingStandardEntry, NamingStandardsData, NoticeTone } from "./app/types";
import { matchesSearchToken, tokenizeText } from "./app/utils/text";
import {
  buildRevisionOptions,
  DISCIPLINE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  findOptionByCode,
  formatPolishCount,
  LEVEL_OPTIONS,
  PHASE_OPTIONS,
  STATUS_OPTIONS,
} from "./features/naming/domain";

type CodeSectionKey =
  | "phases"
  | "disciplines"
  | "documentTypes"
  | "levels"
  | "revisions"
  | "statuses";

type InstructionKey =
  | "projectNumber"
  | "phase"
  | "discipline"
  | "documentType"
  | "level"
  | "drawingNumber"
  | "revision"
  | "status";

type ExampleSelectionMap = Record<CodeSectionKey, string>;

type StandardSectionMeta = {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
  segmentNumber: number;
};

type SegmentGuideItem = {
  key: InstructionKey;
  title: string;
  value: string;
  description: string;
  sectionKey?: CodeSectionKey;
};

type EditableCodeSectionKey = Exclude<CodeSectionKey, "revisions">;

type StandardEditorRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

type StandardEditorDraft = Record<EditableCodeSectionKey, StandardEditorRow[]>;

type StandardEditorFieldError = {
  code?: string;
  name?: string;
};

type StandardEditorValidation = {
  summary: string[];
  rowErrors: Record<EditableCodeSectionKey, Record<string, StandardEditorFieldError>>;
};

type StandardAdminNotice = {
  tone: NoticeTone;
  text: string;
};

type StandardAdminFilter = "active" | "inactive" | "all";

type PendingStatusChange = {
  sectionKey: EditableCodeSectionKey;
  rowId: string;
  nextActive: boolean;
};

const SECTION_META: Record<CodeSectionKey, StandardSectionMeta> = {
  phases: {
    label: "Faza",
    eyebrow: "Segment 2",
    title: "Faza dokumentacji",
    description:
      "Faza określa etap dokumentacji, np. projekt budowlany, techniczny, wykonawczy albo koncepcję.",
    helper: "Kliknięcie kodu od razu podmienia przykład nazwy u góry.",
    segmentNumber: 2,
  },
  disciplines: {
    label: "Branża",
    eyebrow: "Segment 3",
    title: "Branża",
    description:
      "Branża mówi, której części projektu dotyczy plik, np. architektury, sanitarnej albo elektrycznej.",
    helper: "Kod branży wpływa też na literę numeru arkusza.",
    segmentNumber: 3,
  },
  documentTypes: {
    label: "Typ",
    eyebrow: "Segment 4",
    title: "Typ dokumentu",
    description:
      "Typ mówi, czym jest dany plik: rzutem, przekrojem, detalem, zestawieniem albo opisem.",
    helper: "To zwykle najczęściej przeglądany słownik w standardzie.",
    segmentNumber: 4,
  },
  levels: {
    label: "Poziom",
    eyebrow: "Segment 5",
    title: "Poziom",
    description:
      "Poziom wskazuje kondygnację, dach albo wariant wielopoziomowy, dzięki czemu łatwiej filtrować rysunki.",
    helper: "Jeśli poziom nie ma znaczenia, standard przewiduje też kod ogólny.",
    segmentNumber: 5,
  },
  revisions: {
    label: "Rewizja",
    eyebrow: "Segment 7",
    title: "Rewizja i wersja koncepcji",
    description:
      "Aplikacja rozpoznaje rewizje R00-R99 oraz wersje koncepcyjne W01-W99.",
    helper: "Na tym etapie moduł tylko objaśnia standard, bez edycji kodów.",
    segmentNumber: 7,
  },
  statuses: {
    label: "Status",
    eyebrow: "Segment 8",
    title: "Status pliku",
    description:
      "Status określa, czy plik jest roboczy, wydany do zatwierdzenia czy zatwierdzony do dalszego użycia.",
    helper: "To ostatni segment pełnej nazwy pliku.",
    segmentNumber: 8,
  },
};

const SECTION_ORDER: CodeSectionKey[] = [
  "phases",
  "disciplines",
  "documentTypes",
  "levels",
  "revisions",
  "statuses",
];

const EDITABLE_SECTION_ORDER: EditableCodeSectionKey[] = [
  "phases",
  "disciplines",
  "documentTypes",
  "levels",
  "statuses",
];

const SECTION_TO_GUIDE_KEY: Record<CodeSectionKey, InstructionKey> = {
  phases: "phase",
  disciplines: "discipline",
  documentTypes: "documentType",
  levels: "level",
  revisions: "revision",
  statuses: "status",
};

const GUIDE_ACCENTS: Record<InstructionKey, { color: string; soft: string; line: string }> = {
  projectNumber: {
    color: "#dd1848",
    soft: "rgba(221, 24, 72, 0.1)",
    line: "rgba(221, 24, 72, 0.34)",
  },
  phase: {
    color: "#ff8600",
    soft: "rgba(255, 134, 0, 0.11)",
    line: "rgba(255, 134, 0, 0.34)",
  },
  discipline: {
    color: "#f1c100",
    soft: "rgba(241, 193, 0, 0.12)",
    line: "rgba(241, 193, 0, 0.34)",
  },
  documentType: {
    color: "#228a2d",
    soft: "rgba(34, 138, 45, 0.11)",
    line: "rgba(34, 138, 45, 0.34)",
  },
  level: {
    color: "#2d84f1",
    soft: "rgba(45, 132, 241, 0.1)",
    line: "rgba(45, 132, 241, 0.34)",
  },
  drawingNumber: {
    color: "#7e35d8",
    soft: "rgba(126, 53, 216, 0.1)",
    line: "rgba(126, 53, 216, 0.34)",
  },
  revision: {
    color: "#ef6fb6",
    soft: "rgba(239, 111, 182, 0.11)",
    line: "rgba(239, 111, 182, 0.34)",
  },
  status: {
    color: "#15b7c6",
    soft: "rgba(21, 183, 198, 0.11)",
    line: "rgba(21, 183, 198, 0.34)",
  },
};

function getPreferredCode(options: NamingOption[], preferredCode: string) {
  return findOptionByCode(options, preferredCode)?.code ?? options[0]?.code ?? "";
}

function buildSectionOptions(): Record<CodeSectionKey, NamingOption[]> {
  const revisionGuideOptions = buildRevisionOptions();

  return {
    phases: PHASE_OPTIONS,
    disciplines: DISCIPLINE_OPTIONS,
    documentTypes: DOCUMENT_TYPE_OPTIONS,
    levels: LEVEL_OPTIONS,
    revisions: revisionGuideOptions,
    statuses: STATUS_OPTIONS,
  };
}

function buildDefaultSelections(
  sectionOptions: Record<CodeSectionKey, NamingOption[]>,
): ExampleSelectionMap {
  return {
    phases: getPreferredCode(sectionOptions.phases, "PB"),
    disciplines: getPreferredCode(sectionOptions.disciplines, "AR"),
    documentTypes: getPreferredCode(sectionOptions.documentTypes, "PZT"),
    levels: getPreferredCode(sectionOptions.levels, "P1"),
    revisions: getPreferredCode(sectionOptions.revisions, "R02"),
    statuses: getPreferredCode(sectionOptions.statuses, "A1"),
  };
}

function stripCodePrefix(label: string) {
  return label.replace(/^[A-Z0-9]+\s*-\s*/, "").trim();
}

function matchOption(option: NamingOption, queryTokens: string[]) {
  if (queryTokens.length === 0) {
    return true;
  }

  return queryTokens.every((queryToken) =>
    option.searchTerms.some((term) => {
      const tokens = tokenizeText(term);
      return tokens.some((token) => matchesSearchToken(queryToken, token));
    }),
  );
}

function getSearchAliases(option: NamingOption) {
  const labelWithoutCode = stripCodePrefix(option.label);
  const seen = new Set<string>();

  return option.searchTerms.filter((term) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return false;
    }

    const normalized = trimmed.toLocaleLowerCase("pl");
    if (
      normalized === option.code.toLocaleLowerCase("pl") ||
      normalized === option.label.toLocaleLowerCase("pl") ||
      normalized === labelWithoutCode.toLocaleLowerCase("pl")
    ) {
      return false;
    }

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function getAccentStyle(key: InstructionKey): CSSProperties {
  const accent = GUIDE_ACCENTS[key];

  return {
    ["--standard-accent" as string]: accent.color,
    ["--standard-accent-soft" as string]: accent.soft,
    ["--standard-accent-line" as string]: accent.line,
  };
}

function buildGuideSegments(selection: ExampleSelectionMap): SegmentGuideItem[] {
  return [
    {
      key: "projectNumber",
      title: "Numer projektu",
      value: "24091",
      description: "Pięciocyfrowy numer nadawany projektowi.",
    },
    {
      key: "phase",
      title: "Faza",
      value: selection.phases,
      description: "Projekt budowlany, techniczny albo koncepcja.",
      sectionKey: "phases",
    },
    {
      key: "discipline",
      title: "Branża",
      value: selection.disciplines,
      description: "Branża, która jest odpowiedzialna lub stworzyła dany dokument. Architektura, konstrukcja, instalacje elektryczne itd.",
      sectionKey: "disciplines",
    },
    {
      key: "documentType",
      title: "Typ",
      value: selection.documentTypes,
      description: "Detal, rzut, mapa, przekrój, zestawienie itd.",
      sectionKey: "documentTypes",
    },
    {
      key: "level",
      title: "Poziom",
      value: selection.levels,
      description: "Parter, dach, kondygnacja podziemna itd.",
      sectionKey: "levels",
    },
    {
      key: "drawingNumber",
      title: "Numer arkusza",
      value: "A01",
      description: "A05, E02, X01 itd.",
    },
    {
      key: "revision",
      title: "Rewizja / Koncepcja",
      value: selection.revisions,
      description: "Numer rewizji, np. R04 lub wersja koncepcji, np. W03.",
      sectionKey: "revisions",
    },
    {
      key: "status",
      title: "Status pliku",
      value: selection.statuses,
      description: "Roboczy, do zatwierdzenia, zatwierdzony itd.",
      sectionKey: "statuses",
    },
  ];
}

function buildExampleFileName(segments: SegmentGuideItem[]) {
  return `${segments.map((segment) => segment.value).join("-")}.pdf`;
}

type StandardViewProps = {
  isAdminMode: boolean;
};

function createStandardEditorRowId() {
  return `standard-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isEditableSectionKey(sectionKey: CodeSectionKey): sectionKey is EditableCodeSectionKey {
  return sectionKey !== "revisions";
}

function normalizeEditorCode(code: string) {
  return code.replace(/\s+/g, "").trim().toUpperCase();
}

function normalizeEditorName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function getEditorCodePattern(sectionKey: EditableCodeSectionKey) {
  if (sectionKey === "documentTypes") {
    return /^[A-Z0-9]{2,4}$/;
  }

  return /^[A-Z0-9]{2,4}$/;
}

function getEditorCodeHint(sectionKey: EditableCodeSectionKey) {
  return sectionKey === "documentTypes" ? "Zalecane 3 znaki." : "2-4 znaki, litery i cyfry.";
}

function buildEditorDraft(values: NamingStandardsData): StandardEditorDraft {
  return {
    phases: Object.entries(values.phases).map(([code, entry]) => ({
      id: createStandardEditorRowId(),
      code,
      name: stripCodePrefix(entry.label),
      active: entry.active,
    })),
    disciplines: Object.entries(values.disciplines).map(([code, entry]) => ({
      id: createStandardEditorRowId(),
      code,
      name: stripCodePrefix(entry.label),
      active: entry.active,
    })),
    documentTypes: Object.entries(values.documentTypes).map(([code, entry]) => ({
      id: createStandardEditorRowId(),
      code,
      name: stripCodePrefix(entry.label),
      active: entry.active,
    })),
    levels: Object.entries(values.levels).map(([code, entry]) => ({
      id: createStandardEditorRowId(),
      code,
      name: stripCodePrefix(entry.label),
      active: entry.active,
    })),
    statuses: Object.entries(values.statuses).map(([code, entry]) => ({
      id: createStandardEditorRowId(),
      code,
      name: stripCodePrefix(entry.label),
      active: entry.active,
    })),
  };
}

function buildSectionRecord(rows: StandardEditorRow[]) {
  return Object.fromEntries(
    rows.map((row) => {
      const code = normalizeEditorCode(row.code);
      const name = normalizeEditorName(row.name);
      return [
        code,
        {
          label: `${code} - ${name}`,
          active: row.active,
        } satisfies NamingStandardEntry,
      ];
    }),
  );
}

function buildDraftValues(
  draft: StandardEditorDraft,
  currentValues: NamingStandardsData,
): NamingStandardsData {
  return {
    ...currentValues,
    phases: buildSectionRecord(draft.phases),
    disciplines: buildSectionRecord(draft.disciplines),
    documentTypes: buildSectionRecord(draft.documentTypes),
    levels: buildSectionRecord(draft.levels),
    statuses: buildSectionRecord(draft.statuses),
  };
}

function validateEditorDraft(draft: StandardEditorDraft): StandardEditorValidation {
  const rowErrors: Record<EditableCodeSectionKey, Record<string, StandardEditorFieldError>> = {
    phases: {},
    disciplines: {},
    documentTypes: {},
    levels: {},
    statuses: {},
  };
  const summary: string[] = [];

  for (const sectionKey of EDITABLE_SECTION_ORDER) {
    const rows = draft[sectionKey];
    const seenCodes = new Map<string, string>();
    const activeCount = rows.filter((row) => row.active).length;

    if (rows.length === 0) {
      summary.push(`${SECTION_META[sectionKey].label}: sekcja nie może być pusta.`);
      continue;
    }

    if (activeCount === 0) {
      summary.push(`${SECTION_META[sectionKey].label}: musi zostać przynajmniej jeden aktywny kod.`);
    }

    for (const row of rows) {
      const code = normalizeEditorCode(row.code);
      const name = normalizeEditorName(row.name);
      const rowError: StandardEditorFieldError = {};

      if (!code) {
        rowError.code = "Wpisz kod.";
      } else if (!getEditorCodePattern(sectionKey).test(code)) {
        rowError.code = "Kod musi mieć 2-4 znaki.";
      } else if (seenCodes.has(code)) {
        rowError.code = "Kod już istnieje w tej sekcji.";
        const previousRowId = seenCodes.get(code);
        if (previousRowId) {
          rowErrors[sectionKey][previousRowId] = {
            ...rowErrors[sectionKey][previousRowId],
            code: "Kod już istnieje w tej sekcji.",
          };
        }
      } else {
        seenCodes.set(code, row.id);
      }

      if (!name) {
        rowError.name = "Wpisz nazwę.";
      }

      if (rowError.code || rowError.name) {
        rowErrors[sectionKey][row.id] = rowError;
      }
    }
  }

  for (const sectionKey of EDITABLE_SECTION_ORDER) {
    const errorCount = Object.keys(rowErrors[sectionKey]).length;
    if (errorCount > 0) {
      summary.push(
        `${SECTION_META[sectionKey].label}: ${formatPolishCount(errorCount, "wiersz wymaga poprawy", "wiersze wymagają poprawy", "wierszy wymaga poprawy")}.`,
      );
    }
  }

  return {
    summary,
    rowErrors,
  };
}

export function StandardView({ isAdminMode }: StandardViewProps) {
  const namingStandardVersion = useNamingStandardVersion();
  const namingStandardConfig = useMemo(() => getNamingStandardConfigSnapshot(), [namingStandardVersion]);
  const sectionOptions = useMemo(() => buildSectionOptions(), [namingStandardVersion]);
  const defaultSelections = useMemo(() => buildDefaultSelections(sectionOptions), [sectionOptions]);
  const [activeSection, setActiveSection] = useState<CodeSectionKey>("documentTypes");
  const [activeGuideKey, setActiveGuideKey] = useState<InstructionKey>("documentType");
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<ExampleSelectionMap>(() => defaultSelections);
  const [isSavingStandard, setIsSavingStandard] = useState(false);
  const [adminNotice, setAdminNotice] = useState<StandardAdminNotice | null>(null);
  const [adminFilter, setAdminFilter] = useState<StandardAdminFilter>("active");
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [adminDraft, setAdminDraft] = useState<StandardEditorDraft>(() =>
    buildEditorDraft(namingStandardConfig.values),
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const queryTokens = tokenizeText(deferredSearchQuery.trim());
  const guideSegments = buildGuideSegments(selection);
  const exampleFileName = buildExampleFileName(guideSegments);
  const pendingStandardValues = useMemo(
    () => buildDraftValues(adminDraft, namingStandardConfig.values),
    [adminDraft, namingStandardConfig.values],
  );
  const hasAdminChanges = useMemo(
    () => JSON.stringify(pendingStandardValues) !== JSON.stringify(namingStandardConfig.values),
    [namingStandardConfig.values, pendingStandardValues],
  );
  const adminValidation = useMemo(() => validateEditorDraft(adminDraft), [adminDraft]);
  const hasAdminValidationErrors = adminValidation.summary.length > 0;
  const editableActiveSection = isEditableSectionKey(activeSection) ? activeSection : null;
  const activeEditorRows = editableActiveSection ? adminDraft[editableActiveSection] : [];
  const activeEditorRowCount = activeEditorRows.filter((row) => row.active).length;
  const visibleEditorRows = useMemo(
    () =>
      activeEditorRows.filter((row) => {
        if (adminFilter === "all") {
          return true;
        }

        return adminFilter === "active" ? row.active : !row.active;
      }),
    [activeEditorRows, adminFilter],
  );
  const activeEditorErrors = editableActiveSection ? adminValidation.rowErrors[editableActiveSection] : {};
  const canSaveStandard = hasAdminChanges && !hasAdminValidationErrors && !isSavingStandard;
  const pendingStatusRow =
    pendingStatusChange && pendingStatusChange.sectionKey === editableActiveSection
      ? activeEditorRows.find((row) => row.id === pendingStatusChange.rowId) ?? null
      : null;

  useEffect(() => {
    setSelection((current) => {
      const nextSelection = { ...current };
      let changed = false;

      for (const sectionKey of SECTION_ORDER) {
        if (!findOptionByCode(sectionOptions[sectionKey], current[sectionKey])) {
          nextSelection[sectionKey] = defaultSelections[sectionKey];
          changed = true;
        }
      }

      return changed ? nextSelection : current;
    });
  }, [defaultSelections, sectionOptions]);

  useEffect(() => {
    setSearchQuery("");
    setAdminNotice(null);
    setPendingStatusChange(null);
  }, [isAdminMode]);

  useEffect(() => {
    if (!hasAdminChanges) {
      setAdminDraft(buildEditorDraft(namingStandardConfig.values));
    }
  }, [hasAdminChanges, namingStandardConfig.values, namingStandardVersion]);

  const matchesBySection = {
    phases: sectionOptions.phases.filter((option) => matchOption(option, queryTokens)),
    disciplines: sectionOptions.disciplines.filter((option) => matchOption(option, queryTokens)),
    documentTypes: sectionOptions.documentTypes.filter((option) => matchOption(option, queryTokens)),
    levels: sectionOptions.levels.filter((option) => matchOption(option, queryTokens)),
    revisions: sectionOptions.revisions.filter((option) => matchOption(option, queryTokens)),
    statuses: sectionOptions.statuses.filter((option) => matchOption(option, queryTokens)),
  } satisfies Record<CodeSectionKey, NamingOption[]>;

  const globalHits = (
    [
      ...matchesBySection.phases.map((option) => ({ sectionKey: "phases" as const, option })),
      ...matchesBySection.disciplines.map((option) => ({ sectionKey: "disciplines" as const, option })),
      ...matchesBySection.documentTypes.map((option) => ({ sectionKey: "documentTypes" as const, option })),
      ...matchesBySection.levels.map((option) => ({ sectionKey: "levels" as const, option })),
      ...matchesBySection.revisions.map((option) => ({ sectionKey: "revisions" as const, option })),
      ...matchesBySection.statuses.map((option) => ({ sectionKey: "statuses" as const, option })),
    ] as Array<{ sectionKey: CodeSectionKey; option: NamingOption }>
  ).slice(0, 12);

  const matchingSections = SECTION_ORDER.filter((sectionKey) => matchesBySection[sectionKey].length > 0);
  const activeOptions = queryTokens.length > 0 ? matchesBySection[activeSection] : sectionOptions[activeSection];
  const previewRevisionOptions =
    activeSection === "revisions" && queryTokens.length === 0
      ? [
          ...activeOptions.filter((option) => /^R0[0-4]$/.test(option.code)),
          ...activeOptions.filter((option) => /^W0[1-4]$/.test(option.code)),
        ]
      : activeOptions;
  const showRevisionOverflowHint =
    activeSection === "revisions" && queryTokens.length === 0 && previewRevisionOptions.length < activeOptions.length;
  const selectedOption =
    findOptionByCode(sectionOptions[activeSection], selection[activeSection]) ??
    sectionOptions[activeSection][0] ??
    null;
  const activeMeta = SECTION_META[activeSection];
  const activeGuideSegment =
    guideSegments.find((segment) => segment.key === activeGuideKey) ??
    guideSegments[0];
  const drawingNumberIndex = guideSegments.findIndex((segment) => segment.key === "drawingNumber");
  const stickyGuideSegments =
    drawingNumberIndex > 0 ? guideSegments.slice(0, drawingNumberIndex) : guideSegments;
  const trailingGuideSegments =
    drawingNumberIndex >= 0 ? guideSegments.slice(drawingNumberIndex) : [];

  function handleSectionChange(sectionKey: CodeSectionKey) {
    setActiveSection(sectionKey);
    setActiveGuideKey(SECTION_TO_GUIDE_KEY[sectionKey]);
  }

  function handleOptionSelect(sectionKey: CodeSectionKey, code: string) {
    setSelection((current) => ({
      ...current,
      [sectionKey]: code,
    }));
    handleSectionChange(sectionKey);
  }

  function handleGuideSelect(segment: SegmentGuideItem) {
    setActiveGuideKey(segment.key);

    if (segment.sectionKey) {
      setActiveSection(segment.sectionKey);
    }
  }

  function handleEditorRowChange(
    sectionKey: EditableCodeSectionKey,
    rowId: string,
    field: "code" | "name",
    value: string,
  ) {
    setAdminNotice(null);
    setAdminDraft((current) => ({
      ...current,
      [sectionKey]: current[sectionKey].map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: field === "code" ? normalizeEditorCode(value) : value,
            }
          : row,
      ),
    }));
  }

  function handleAddEditorRow(sectionKey: EditableCodeSectionKey) {
    setAdminNotice(null);
    setAdminDraft((current) => ({
      ...current,
      [sectionKey]: [
        ...current[sectionKey],
        {
          id: createStandardEditorRowId(),
          code: "",
          name: "",
          active: true,
        },
      ],
    }));
  }

  function handleRequestDeactivate(sectionKey: EditableCodeSectionKey, rowId: string) {
    setAdminNotice(null);
    setPendingStatusChange({
      sectionKey,
      rowId,
      nextActive: false,
    });
  }

  function handleRestoreRow(sectionKey: EditableCodeSectionKey, rowId: string) {
    setAdminNotice(null);
    setPendingStatusChange(null);
    setAdminDraft((current) => ({
      ...current,
      [sectionKey]: current[sectionKey].map((row) =>
        row.id === rowId
          ? {
              ...row,
              active: true,
            }
          : row,
      ),
    }));
  }

  function handleConfirmStatusChange() {
    if (!pendingStatusChange) {
      return;
    }

    setAdminNotice(null);
    setAdminDraft((current) => ({
      ...current,
      [pendingStatusChange.sectionKey]: current[pendingStatusChange.sectionKey].map((row) =>
        row.id === pendingStatusChange.rowId
          ? {
              ...row,
              active: pendingStatusChange.nextActive,
            }
          : row,
      ),
    }));
    setPendingStatusChange(null);
  }

  function handleCancelStatusChange() {
    setPendingStatusChange(null);
  }

  function handleResetAdminDraft() {
    setAdminDraft(buildEditorDraft(namingStandardConfig.values));
    setPendingStatusChange(null);
    setAdminNotice({
      tone: "muted",
      text: "Przywrócono ostatnią zapisaną wersję standardu.",
    });
  }

  async function handleSaveStandard() {
    if (hasAdminValidationErrors) {
      setAdminNotice({
        tone: "error",
        text: "Popraw błędy w aktywnych słownikach przed zapisaniem standardu.",
      });
      return;
    }

    setIsSavingStandard(true);
    setAdminNotice(null);
    setPendingStatusChange(null);

    try {
      const nextConfig = await saveRuntimeNamingStandard(pendingStandardValues);
      setAdminDraft(buildEditorDraft(nextConfig.values));
      setAdminNotice({
        tone: "success",
        text: nextConfig.lastReportPath
          ? "Standard został zapisany. Raport zmian zapisano w historii."
          : "Standard został zapisany.",
      });
    } catch (error) {
      setAdminNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Nie udało się zapisać standardu.",
      });
    } finally {
      setIsSavingStandard(false);
    }
  }

  return (
    <section className="standard-view">
      <div className="naming-card standard-instruction-card">
        <div className="panel-header">
          <div>
            <h2>Jak czytać nazwę pliku:</h2>
          </div>
        </div>

        <div className="standard-instruction-stage">
          <div className="standard-instruction-scroll-zone">
            <div className="standard-example-shell">
              <span className="standard-example-label">Przykładowa nazwa</span>
              <div className="standard-example-line" aria-label="Przykładowa standardowa nazwa pliku">
                {guideSegments.map((segment, index) => (
                  <Fragment key={segment.key}>
                    <div className="standard-example-piece" style={getAccentStyle(segment.key)}>
                      <button
                        type="button"
                        className={`standard-example-token ${activeGuideKey === segment.key ? "active" : ""}`}
                        onClick={() => handleGuideSelect(segment)}
                      >
                        {segment.value}
                      </button>
                      {activeGuideKey === segment.key ? (
                        <div className="standard-example-callout" aria-live="polite">
                          <span className="standard-example-callout-line" aria-hidden="true" />
                          <div className="standard-example-callout-copy">
                            <strong>{activeGuideSegment.title}</strong>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {index < guideSegments.length - 1 ? (
                      <span className="standard-example-separator" aria-hidden="true">
                        -
                      </span>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="standard-guide-list" aria-label="Legenda segmentów standardowej nazwy">
              {stickyGuideSegments.map((segment) => (
                <button
                  key={segment.key}
                  type="button"
                  className={`standard-guide-row ${activeGuideKey === segment.key ? "active" : ""}`}
                  style={getAccentStyle(segment.key)}
                  onClick={() => handleGuideSelect(segment)}
                >
                  <span className="standard-guide-code">{segment.value}</span>
                  <span className="standard-guide-divider" aria-hidden="true" />
                  <div className="standard-guide-copy">
                    <strong>{segment.title}</strong>
                    <span>{segment.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="standard-guide-list" aria-label="Dalsza część legendy standardowej nazwy">
            {trailingGuideSegments.map((segment) => (
              <button
                key={segment.key}
                type="button"
                className={`standard-guide-row ${activeGuideKey === segment.key ? "active" : ""}`}
                style={getAccentStyle(segment.key)}
                onClick={() => handleGuideSelect(segment)}
              >
                <span className="standard-guide-code">{segment.value}</span>
                <span className="standard-guide-divider" aria-hidden="true" />
                <div className="standard-guide-copy">
                  <strong>{segment.title}</strong>
                  <span>{segment.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="naming-card standard-dictionaries-card">
        <div className="panel-header standard-dictionaries-header">
          <div>
            <h2>Pełne listy kodów</h2>
            <p className="standard-copy">
              Tutaj sprawdzisz wszystkie kody używane w standardzie
            </p>
          </div>
          <div className="standard-dictionaries-header-actions">
            <div className="status-strip standard-status-strip">
              <span>{formatPolishCount(sectionOptions[activeSection].length, "kod", "kody", "kodów")} w sekcji</span>
              {!isAdminMode && queryTokens.length > 0 ? (
                <span>{formatPolishCount(activeOptions.length, "wynik", "wyniki", "wyników")} po filtrowaniu</span>
              ) : null}
              {isAdminMode && hasAdminChanges ? <span>Niezapisane zmiany</span> : null}
              {isAdminMode && editableActiveSection ? (
                <span>{formatPolishCount(visibleEditorRows.length, "wiersz", "wiersze", "wierszy")} w widoku</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="standard-section-chip-row">
          {SECTION_ORDER.map((sectionKey) => {
            const meta = SECTION_META[sectionKey];

            return (
              <button
                key={sectionKey}
                type="button"
                className={`chip standard-section-chip ${activeSection === sectionKey ? "active" : ""}`}
                style={getAccentStyle(SECTION_TO_GUIDE_KEY[sectionKey])}
                onClick={() => handleSectionChange(sectionKey)}
              >
                <span>{meta.label}</span>
                <strong>{sectionOptions[sectionKey].length}</strong>
              </button>
            );
          })}
        </div>

        {isAdminMode ? (
          <>
            <div className="standard-admin-toolbar">
              <div className="standard-admin-toolbar-copy">
                <strong>Tryb administratora</strong>
                <span>
                  Edytujesz aktywną sekcję słownika.
                </span>
              </div>

              <div className="standard-admin-toolbar-actions">
                <div className="standard-admin-filter-row" role="tablist" aria-label="Filtr widoku kodów">
                  <button
                    type="button"
                    className={`chip ${adminFilter === "active" ? "active" : ""}`}
                    onClick={() => setAdminFilter("active")}
                  >
                    Aktywne
                  </button>
                  <button
                    type="button"
                    className={`chip ${adminFilter === "inactive" ? "active" : ""}`}
                    onClick={() => setAdminFilter("inactive")}
                  >
                    Nieaktywne
                  </button>
                  <button
                    type="button"
                    className={`chip ${adminFilter === "all" ? "active" : ""}`}
                    onClick={() => setAdminFilter("all")}
                  >
                    Wszystkie
                  </button>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void fileFilterApi.openFile(namingStandardConfig.path)}
                  disabled={!namingStandardConfig.path}
                >
                  Otwórz plik JSON
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void fileFilterApi.openFolder(namingStandardConfig.backupsPath)}
                  disabled={!namingStandardConfig.backupsPath}
                >
                  Otwórz historię
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleResetAdminDraft}
                  disabled={!hasAdminChanges || isSavingStandard}
                >
                  Cofnij zmiany
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleSaveStandard()}
                  disabled={!canSaveStandard}
                >
                  {isSavingStandard ? "Zapisywanie..." : "Zapisz standard"}
                </button>
              </div>
            </div>

            {adminNotice ? (
              <div className={`standard-admin-notice ${adminNotice.tone}`} aria-live="polite">
                {adminNotice.text}
              </div>
            ) : null}

            {pendingStatusRow ? (
              <div className="standard-admin-impact-panel" aria-live="polite">
                <strong>Dezaktywować kod {pendingStatusRow.code}?</strong>
                <p>
                  Kod zniknie z nowych wyborów w Nazywaniu, nowe pliki z tym kodem będą niezgodne w Filtrze,
                  Odkodowanie nadal rozpozna istniejące nazwy, a w Standardzie kod przejdzie do nieaktywnych.
                </p>
                <div className="standard-admin-impact-actions">
                  <button type="button" className="ghost-button" onClick={handleCancelStatusChange}>
                    Anuluj
                  </button>
                  <button type="button" className="primary-button" onClick={handleConfirmStatusChange}>
                    Dezaktywuj
                  </button>
                </div>
              </div>
            ) : null}

            {hasAdminValidationErrors ? (
              <div className="standard-admin-validation" aria-live="polite">
                {adminValidation.summary.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="standard-search-row">
              <label className="field standard-search-field">
                <span>Szukaj po kodzie lub nazwie</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="np. przekrój, PB, A1, parter, architektura"
                />
              </label>

              {queryTokens.length > 0 ? (
                <div className="standard-search-summary" aria-live="polite">
                  <span>{formatPolishCount(globalHits.length, "wynik", "wyniki", "wyników")} w szybkim podglądzie</span>
                  <span>{formatPolishCount(matchingSections.length, "sekcja", "sekcje", "sekcji")} z dopasowaniem</span>
                </div>
              ) : null}
            </div>

            {queryTokens.length > 0 ? (
              globalHits.length > 0 ? (
                <div className="standard-search-hits">
                  {globalHits.map(({ sectionKey, option }) => (
                    <button
                      key={`${sectionKey}-${option.code}`}
                      type="button"
                      className="chip standard-hit-button"
                      style={getAccentStyle(SECTION_TO_GUIDE_KEY[sectionKey])}
                      onClick={() => handleOptionSelect(sectionKey, option.code)}
                    >
                      <span>{SECTION_META[sectionKey].label}</span>
                      <strong>{option.code}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">Brak dopasowań dla podanego zapytania.</p>
              )
            ) : null}
          </>
        )}

        <div className="standard-explorer-grid">
          <div
            className="standard-detail-card"
            style={getAccentStyle(SECTION_TO_GUIDE_KEY[activeSection])}
          >
            {isAdminMode ? (
              <>
                <span className="standard-detail-label">Tryb administratora</span>
                <div className="standard-detail-code">
                  {editableActiveSection ? SECTION_META[editableActiveSection].label : "R/W"}
                </div>
                <strong>
                  {editableActiveSection
                    ? `Edytujesz sekcję: ${SECTION_META[editableActiveSection].label}`
                    : "Rewizja pozostaje tylko do odczytu"}
                </strong>
                <p>
                  {editableActiveSection
                    ? "Dodawaj nowe kody, dezaktywuj je albo przywracaj. Zmiany trafiają do wspólnego standardu, a poprzednia wersja jest automatycznie zapisywana w historii."
                    : "Zakres rewizji i wersji koncepcji nadal wynika z logiki aplikacji: R00-R99 oraz W01-W99."}
                </p>
                <div className="standard-selection-example">
                  <span>Plik standardu</span>
                  <code>{namingStandardConfig.path || "Brak ścieżki do pliku"}</code>
                </div>
                <div className="standard-selection-example">
                  <span>Historia standardu</span>
                  <code>{namingStandardConfig.backupsPath || "Brak folderu historii"}</code>
                </div>
                <div className="standard-alias-list">
                  <span className="standard-alias-pill">
                    {namingStandardConfig.source === "userData" ? "plik użytkownika" : "wersja wbudowana"}
                  </span>
                  {editableActiveSection ? (
                    <span className="standard-alias-pill">{getEditorCodeHint(editableActiveSection)}</span>
                  ) : null}
                  {hasAdminChanges ? <span className="standard-alias-pill">oczekują niezapisane zmiany</span> : null}
                </div>
                <p className="standard-detail-helper">
                  {editableActiveSection
                    ? "Nieaktywny kod pozostaje rozpoznawalny dla istniejących nazw, ale znika z nowych wyborów."
                    : "Jeśli później będziemy chcieli edytować rewizje albo układ nazwy, to będzie osobna iteracja."}
                </p>
              </>
            ) : (
              <>
                <span className="standard-detail-label">{activeMeta.eyebrow}</span>
                <div className="standard-detail-code">{selectedOption?.code ?? selection[activeSection]}</div>
                <strong>{selectedOption ? stripCodePrefix(selectedOption.label) : activeMeta.label}</strong>
                <p>{activeMeta.description}</p>
                <div className="standard-selection-example">
                  <span>Aktualny przykład nazwy</span>
                  <code>{exampleFileName}</code>
                </div>

                {selectedOption ? (
                  <>
                    {getSearchAliases(selectedOption).length > 0 ? (
                      <div className="standard-alias-list">
                        {getSearchAliases(selectedOption).map((alias) => (
                          <span key={alias} className="standard-alias-pill">
                            {alias}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="standard-detail-helper">{activeMeta.helper}</p>
                  </>
                ) : null}
              </>
            )}
          </div>

          {isAdminMode && editableActiveSection ? (
            <div className="standard-option-panel standard-admin-panel">
              <div className="standard-option-panel-header">
                <div>
                  <span>Edycja słownika</span>
                  <strong>{SECTION_META[editableActiveSection].label}</strong>
                </div>
                <span>{formatPolishCount(visibleEditorRows.length, "wiersz", "wiersze", "wierszy")}</span>
              </div>

              <div className="standard-admin-table-head">
                <span>Kod</span>
                <span>Nazwa</span>
                <span>Status</span>
                <span>Akcje</span>
              </div>

              <div className="standard-admin-editor-list">
                {visibleEditorRows.map((row) => {
                  const rowError = activeEditorErrors[row.id];
                  const rowErrorText = [rowError?.code, rowError?.name].filter(Boolean).join(" ");

                  return (
                    <div
                      key={row.id}
                      className={`standard-admin-editor-row ${rowError ? "invalid" : ""}`}
                    >
                      <input
                        value={row.code}
                        onChange={(event) =>
                          handleEditorRowChange(editableActiveSection, row.id, "code", event.target.value)
                        }
                        aria-label={`Kod sekcji ${SECTION_META[editableActiveSection].label}`}
                        aria-invalid={Boolean(rowError?.code)}
                        placeholder="np. CSP"
                        className="standard-admin-input standard-admin-code-input"
                      />
                      <input
                        value={row.name}
                        onChange={(event) =>
                          handleEditorRowChange(editableActiveSection, row.id, "name", event.target.value)
                        }
                        aria-label={`Nazwa sekcji ${SECTION_META[editableActiveSection].label}`}
                        aria-invalid={Boolean(rowError?.name)}
                        placeholder="np. Przekrój pionowy"
                        className="standard-admin-input"
                      />
                      <span className={`standard-admin-status-pill ${row.active ? "active" : "inactive"}`}>
                        {row.active ? "Aktywny" : "Nieaktywny"}
                      </span>
                      <div className="standard-admin-row-actions">
                        {row.active ? (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleRequestDeactivate(editableActiveSection, row.id)}
                            disabled={activeEditorRowCount <= 1}
                          >
                            Dezaktywuj
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => handleRestoreRow(editableActiveSection, row.id)}
                          >
                            Przywróć
                          </button>
                        )}
                      </div>
                      {rowErrorText ? <span className="standard-admin-row-error">{rowErrorText}</span> : null}
                    </div>
                  );
                })}
                {visibleEditorRows.length === 0 ? (
                  <div className="empty-state standard-empty-state">
                    <p>Brak kodów w bieżącym widoku.</p>
                  </div>
                ) : null}
              </div>

              <div className="standard-admin-panel-footer">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => handleAddEditorRow(editableActiveSection)}
                >
                  Dodaj kod
                </button>
              </div>
            </div>
          ) : (
            <div className="standard-option-panel">
              <div className="standard-option-panel-header">
                <div>
                  <span>{isAdminMode ? "Podgląd tylko do odczytu" : activeMeta.title}</span>
                  <strong>{SECTION_META[activeSection].label}</strong>
                </div>
                <span>{formatPolishCount(activeOptions.length, "pozycja", "pozycje", "pozycji")}</span>
              </div>

              {activeOptions.length === 0 ? (
                <div className="empty-state standard-empty-state">
                  <p>W tej sekcji nie ma wyników dla bieżącego wyszukiwania.</p>
                </div>
              ) : (
                <div className="standard-option-list">
                  {previewRevisionOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      className={`standard-option-row ${selection[activeSection] === option.code ? "active" : ""}`}
                      style={getAccentStyle(SECTION_TO_GUIDE_KEY[activeSection])}
                      onClick={() => handleOptionSelect(activeSection, option.code)}
                    >
                      <span className="standard-option-code">{option.code}</span>
                      <div className="standard-option-copy">
                        <strong>{stripCodePrefix(option.label)}</strong>
                        <span>{option.label}</span>
                      </div>
                    </button>
                  ))}
                  {showRevisionOverflowHint ? (
                    <div className="standard-option-overflow" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
