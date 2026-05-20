import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  EvaluatedRow,
  ExtensionFilterGroup,
  LastBulkOperation,
  NamingFileRow,
  NamingFolderFile,
  NamingHeroMenuState,
  NamingOption,
  NamingStandardVersion,
  NamingViewDraft,
  PendingBulkApply,
  ResolvedSession,
} from "./app/types";
import { useNamingStandardVersion } from "./app/standard-config";
import { normalizeText as normalize } from "./app/utils/text";
import { useTransientBanner } from "./app/useTransientBanner";
import { InlineCodeSelect } from "./features/naming/components/InlineCodeSelect";
import { RevisionInput } from "./features/naming/components/RevisionInput";
import { RevisionPresetInput } from "./features/naming/components/RevisionPresetInput";
import {
  BUILDING_DESIGNATION_OPTIONS,
  DISCIPLINE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  EXTENSION_FILTER_ICON_MAP,
  LEVEL_OPTIONS,
  PHASE_OPTIONS,
  STATUS_OPTIONS,
  areStringArraysEqual,
  buildDrawingConflictKey,
  buildDrawingContextKey,
  buildInitialRow,
  buildTargetFileName,
  buildTargetIdentityKey,
  dedupeRowsBySourcePath,
  extractBaseName,
  extractFileNameFromInput,
  extractProjectNumber,
  findOptionByCode,
  formatDrawingNumber,
  formatPolishCount,
  getExtensionFilterGroup,
  getNextDrawingNumber,
  getRevisionFromFileName,
  getRevisionValidationMessage,
  getStatusFromFileName,
  getSuggestedOptions,
  inferDrawingNumber,
  isBuildingDesignationValid,
  isDrawingNumberValidForDiscipline,
  isProjectNumberValid,
  isRevisionCodeValid,
  isRevisionPartialInputAllowed,
  isRevisionValidationMessage,
  joinWindowsPath,
  mergeRowWithLatestFile,
  normalizeFileSystemPath,
  normalizeFileSystemPathList,
  normalizeRevisionInput,
  parseStandardizedFileName,
  resolveOption,
} from "./features/naming/domain";

const BULK_STATUS_INPUT_MESSAGE = "Wpisz poprawny status: S0, S1, S2 lub A1.";

function shouldToggleSelectionFromTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && !target.closest("button, input, select, textarea, a, label");
}

type NamingViewProps = {
  selectedProjectName: string;
  namingStandardVersion: NamingStandardVersion | null;
  refreshWorkingFolderRequestToken: number;
  undoLastOperationRequestToken: number;
  onHeroMenuStateChange: (state: NamingHeroMenuState) => void;
};

export function NamingView({
  selectedProjectName,
  namingStandardVersion: projectNamingStandardVersion,
  refreshWorkingFolderRequestToken,
  undoLastOperationRequestToken,
  onHeroMenuStateChange,
}: NamingViewProps) {
  const namingStandardConfigVersion = useNamingStandardVersion();
  const effectiveNamingStandardVersion = projectNamingStandardVersion ?? 4;
  const initialDraftRef = useRef<NamingViewDraft | null>(null);
  const defaultRevisionInputRef = useRef<HTMLInputElement | null>(null);
  const handledRefreshRequestTokenRef = useRef(0);
  const handledUndoRequestTokenRef = useRef(0);
  const hasRestoredFoldersRef = useRef(false);
  const hasLoadedDraftRef = useRef(false);
  const workingFolderRequestIdRef = useRef(0);
  const pendingWorkingFolderPathRef = useRef("");
  const [draftReady, setDraftReady] = useState(false);
  const [projectNumber, setProjectNumber] = useState(extractProjectNumber(selectedProjectName));
  const [phaseInput, setPhaseInput] = useState("");
  const [disciplineInput, setDisciplineInput] = useState("");
  const [defaultRevision, setDefaultRevision] = useState("");
  const [defaultRevisionInput, setDefaultRevisionInput] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("");
  const [workingFolder, setWorkingFolder] = useState("");
  const [workingStats, setWorkingStats] = useState({ ignoredCount: 0, totalCount: 0 });
  const [targetFolder, setTargetFolder] = useState("");
  const [targetStats, setTargetStats] = useState({ ignoredCount: 0, totalCount: 0 });
  const [targetFiles, setTargetFiles] = useState<NamingFolderFile[]>([]);
  const [rows, setRows] = useState<NamingFileRow[]>([]);
  const [ignoredRows, setIgnoredRows] = useState<NamingFileRow[]>([]);
  const [ignoredSourcePathsByFolder, setIgnoredSourcePathsByFolder] = useState<Record<string, string[]>>({});
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [copiedTargetPaths, setCopiedTargetPaths] = useState<string[]>([]);
  const [bulkRevision, setBulkRevision] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [pendingBulkApply, setPendingBulkApply] = useState<PendingBulkApply | null>(null);
  const [lastBulkOperation, setLastBulkOperation] = useState<LastBulkOperation | null>(null);
  const [copySummaryOpen, setCopySummaryOpen] = useState(false);
  const [drawingStartDialogOpen, setDrawingStartDialogOpen] = useState(false);
  const [drawingStartInput, setDrawingStartInput] = useState("1");
  const [drawingStartTouched, setDrawingStartTouched] = useState(false);
  const [message, setMessage] = useState("");
  const [successDialogTitle, setSuccessDialogTitle] = useState("Operacja zakończona");
  const [successDialogMessage, setSuccessDialogMessage] = useState("");
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [overwriteConfirmRowId, setOverwriteConfirmRowId] = useState<string | null>(null);
  const [batchWarningRowIds, setBatchWarningRowIds] = useState<string[]>([]);
  const [batchWarningIncludedRowIds, setBatchWarningIncludedRowIds] = useState<string[]>([]);
  const [customNameDialogRowId, setCustomNameDialogRowId] = useState<string | null>(null);
  const [customNameInput, setCustomNameInput] = useState("");
  const [customNameTouched, setCustomNameTouched] = useState(false);
  const [messageType, setMessageType] = useState<"error" | "success" | "muted">("muted");
  const [loadingWorkingFolder, setLoadingWorkingFolder] = useState(false);
  const [loadingTargetFolder, setLoadingTargetFolder] = useState(false);
  const [copyingFiles, setCopyingFiles] = useState(false);
  const [copyingRowIds, setCopyingRowIds] = useState<string[]>([]);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const rowPointerDownRef = useRef<{ rowId: string; at: number } | null>(null);
  const [isSetupCollapsed, setIsSetupCollapsed] = useState(false);
  const [isIgnoredSectionCollapsed, setIsIgnoredSectionCollapsed] = useState(true);
  const [hasAutoCollapsedSetup, setHasAutoCollapsedSetup] = useState(false);
  const [hasFileListChanges, setHasFileListChanges] = useState(false);
  const [extensionFilter, setExtensionFilter] = useState<ExtensionFilterGroup | "">("");

  useTransientBanner(message, () => setMessage(""));
  const [phaseMenuOpen, setPhaseMenuOpen] = useState(false);
  const [disciplineMenuOpen, setDisciplineMenuOpen] = useState(false);
  const [highlightedPhaseIndex, setHighlightedPhaseIndex] = useState(-1);
  const [highlightedDisciplineIndex, setHighlightedDisciplineIndex] = useState(-1);

  const phaseMatch = useMemo(() => resolveOption(phaseInput, PHASE_OPTIONS), [namingStandardConfigVersion, phaseInput]);
  const disciplineMatch = useMemo(
    () => resolveOption(disciplineInput, DISCIPLINE_OPTIONS),
    [disciplineInput, namingStandardConfigVersion],
  );
  const phaseSuggestions = useMemo(
    () => getSuggestedOptions(phaseInput, PHASE_OPTIONS),
    [namingStandardConfigVersion, phaseInput],
  );
  const disciplineSuggestions = useMemo(
    () => getSuggestedOptions(disciplineInput, DISCIPLINE_OPTIONS),
    [disciplineInput, namingStandardConfigVersion],
  );

  const resolvedSession = useMemo<ResolvedSession | null>(() => {
    if (!isProjectNumberValid(projectNumber) || !phaseMatch || !disciplineMatch) {
      return null;
    }

    return {
      projectNumber: projectNumber.trim(),
      phaseCode: phaseMatch.code,
      disciplineCode: disciplineMatch.code,
    };
  }, [disciplineMatch, phaseMatch, projectNumber]);

  const canAutoCollapseSetup = Boolean(resolvedSession && workingFolder && targetFolder);

  useEffect(() => {
    if (hasLoadedDraftRef.current) {
      return;
    }

    void (async () => {
      const settings = await window.fileFilterApi.getSettings();
      const savedDraft = settings.namingViewDraft;
      initialDraftRef.current = savedDraft;

      if (savedDraft.projectNumber) {
        setProjectNumber(savedDraft.projectNumber);
      }

      setPhaseInput(savedDraft.phaseInput);
      setDisciplineInput(savedDraft.disciplineInput);
      setDefaultRevision(savedDraft.defaultRevision || "");
      setDefaultRevisionInput(savedDraft.defaultRevisionInput);
      setDefaultStatus(savedDraft.defaultStatus || "");
      setWorkingFolder(savedDraft.workingFolder);
      setTargetFolder(savedDraft.targetFolder);
      setIgnoredSourcePathsByFolder(savedDraft.ignoredSourcePathsByFolder ?? {});
      hasLoadedDraftRef.current = true;
      setDraftReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!hasLoadedDraftRef.current) {
      return;
    }

    const nextProjectNumber = extractProjectNumber(selectedProjectName);
    if (!projectNumber && nextProjectNumber) {
      setProjectNumber(nextProjectNumber);
    }
  }, [projectNumber, selectedProjectName]);

  useEffect(() => {
    if (!hasLoadedDraftRef.current) {
      return;
    }

    void window.fileFilterApi.updateNamingViewDraft({
      projectNumber,
      phaseInput,
      disciplineInput,
      defaultRevision,
      defaultRevisionInput,
      defaultStatus,
      workingFolder,
      targetFolder,
      ignoredSourcePathsByFolder,
    });
  }, [
    defaultRevision,
    defaultRevisionInput,
    defaultStatus,
    disciplineInput,
    ignoredSourcePathsByFolder,
    phaseInput,
    projectNumber,
    targetFolder,
    workingFolder,
  ]);

  useEffect(() => {
    if (hasRestoredFoldersRef.current || !draftReady) {
      return;
    }

    hasRestoredFoldersRef.current = true;
    const savedDraft = initialDraftRef.current;
    if (!savedDraft) {
      return;
    }

    void (async () => {
      if (savedDraft.workingFolder) {
        await loadWorkingFolder(savedDraft.workingFolder);
      }

      if (savedDraft.targetFolder) {
        await loadTargetFolder(savedDraft.targetFolder);
      }
    })();
  }, [draftReady]);

  useEffect(() => {
    if (canAutoCollapseSetup && !hasAutoCollapsedSetup) {
      setIsSetupCollapsed(true);
      setHasAutoCollapsedSetup(true);
    }
  }, [canAutoCollapseSetup, hasAutoCollapsedSetup]);

  useEffect(() => {
    setSelectedRowIds(rows.map((row) => row.id));
  }, [rows]);

  useEffect(() => {
    if (rows.length === 0) {
      setBulkRevision("");
      setBulkStatus("");
    }
  }, [rows.length]);

  useEffect(() => {
    onHeroMenuStateChange({
      canRefreshWorkingFolder: Boolean(workingFolder) && !loadingWorkingFolder,
      refreshWorkingFolderLabel: loadingWorkingFolder ? "Odświeżanie folderu roboczego..." : "Odśwież folder roboczy",
      canUndoLastOperation: Boolean(lastBulkOperation),
    });
  }, [lastBulkOperation, loadingWorkingFolder, onHeroMenuStateChange, workingFolder]);

  useEffect(() => {
    return () =>
      onHeroMenuStateChange({
        canRefreshWorkingFolder: false,
        refreshWorkingFolderLabel: "Odśwież folder roboczy",
        canUndoLastOperation: false,
      });
  }, [onHeroMenuStateChange]);

  useEffect(() => {
    if (
      refreshWorkingFolderRequestToken > 0 &&
      refreshWorkingFolderRequestToken !== handledRefreshRequestTokenRef.current
    ) {
      handledRefreshRequestTokenRef.current = refreshWorkingFolderRequestToken;
      void handleRefreshWorkingFolder();
    }
  }, [refreshWorkingFolderRequestToken]);

  useEffect(() => {
    if (undoLastOperationRequestToken > 0 && undoLastOperationRequestToken !== handledUndoRequestTokenRef.current) {
      handledUndoRequestTokenRef.current = undoLastOperationRequestToken;
      undoLastBulkOperation();
    }
  }, [undoLastOperationRequestToken]);

  useEffect(() => {
    if (!workingFolder) {
      return;
    }

    if (pendingWorkingFolderPathRef.current === normalizeFileSystemPath(workingFolder)) {
      return;
    }

    const nextIgnoredPaths = normalizeFileSystemPathList(ignoredRows.map((row) => row.sourcePath));

    setIgnoredSourcePathsByFolder((currentMap) => {
      const rawCurrentPaths = currentMap[workingFolder] ?? [];
      const currentPaths = normalizeFileSystemPathList(rawCurrentPaths);
      const pathsChanged = !areStringArraysEqual(currentPaths, nextIgnoredPaths);
      const storageNeedsNormalization = !areStringArraysEqual(rawCurrentPaths, currentPaths);

      if (!pathsChanged && !storageNeedsNormalization) {
        return currentMap;
      }

      const nextMap = { ...currentMap };
      if (nextIgnoredPaths.length === 0) {
        delete nextMap[workingFolder];
      } else {
        nextMap[workingFolder] = nextIgnoredPaths;
      }

      return nextMap;
    });
  }, [ignoredRows, workingFolder]);

  useEffect(() => {
    if (ignoredRows.length === 0) {
      return;
    }

    const ignoredPathSet = new Set(ignoredRows.map((row) => normalizeFileSystemPath(row.sourcePath)));

    setRows((currentRows) => {
      const nextRows = currentRows.filter((row) => !ignoredPathSet.has(normalizeFileSystemPath(row.sourcePath)));
      return nextRows.length === currentRows.length ? currentRows : nextRows;
    });
  }, [ignoredRows]);

  useEffect(() => {
    if (!resolvedSession) {
      return;
    }

    setRows((currentRows) => {
      let hasChanges = false;

      const nextRows = currentRows.map((row) => {
        if (row.drawingNumberLocked) {
          return row;
        }

        const inferredDrawingNumber = inferDrawingNumber(extractBaseName(row.fileName), resolvedSession.disciplineCode);
        if (!inferredDrawingNumber) {
          return row;
        }

        const hasValidCurrentNumber =
          Boolean(row.drawingNumber) && isDrawingNumberValidForDiscipline(resolvedSession.disciplineCode, row.drawingNumber);

        if (hasValidCurrentNumber || row.drawingNumber === inferredDrawingNumber) {
          return row;
        }

        hasChanges = true;
        return {
          ...row,
          drawingNumber: inferredDrawingNumber,
        };
      });

      return hasChanges ? nextRows : currentRows;
    });
  }, [resolvedSession]);

  async function refreshTargetFolderData(folderPath: string) {
    const result = await window.fileFilterApi.listNamingFiles(folderPath);
    setTargetFiles(result.files);
    setTargetStats({ ignoredCount: result.ignoredCount, totalCount: result.totalCount });
    return result;
  }

  async function loadWorkingFolder(nextFolderPath: string) {
    const requestId = workingFolderRequestIdRef.current + 1;
    workingFolderRequestIdRef.current = requestId;
    pendingWorkingFolderPathRef.current = normalizeFileSystemPath(nextFolderPath);
    setLoadingWorkingFolder(true);

    try {
      const result = await window.fileFilterApi.listNamingFiles(nextFolderPath);
      if (requestId !== workingFolderRequestIdRef.current) {
        return;
      }

      const savedIgnoredPaths = normalizeFileSystemPathList(
        ignoredSourcePathsByFolder[nextFolderPath] ??
          initialDraftRef.current?.ignoredSourcePathsByFolder?.[nextFolderPath] ??
          [],
      );
      const savedIgnoredPathSet = new Set(savedIgnoredPaths);
      setWorkingFolder(nextFolderPath);
      setWorkingStats({ ignoredCount: result.ignoredCount, totalCount: result.totalCount });
      setCopiedTargetPaths([]);
      setIsIgnoredSectionCollapsed(savedIgnoredPaths.length === 0);
      setHasFileListChanges(false);
      setLastBulkOperation(null);
      setBulkRevision("");
      setBulkStatus("");

      const loadedRows = result.files.map((file) => buildInitialRow(file, defaultRevision, defaultStatus));
      const nextIgnoredRows = dedupeRowsBySourcePath(
        loadedRows.filter((row) => savedIgnoredPathSet.has(normalizeFileSystemPath(row.sourcePath))),
      );
      const nextIgnoredPathSet = new Set(nextIgnoredRows.map((row) => normalizeFileSystemPath(row.sourcePath)));
      const nextRows = dedupeRowsBySourcePath(
        loadedRows.filter((row) => !nextIgnoredPathSet.has(normalizeFileSystemPath(row.sourcePath))),
      );
      setIgnoredRows(nextIgnoredRows);
      setRows(nextRows);
      setSelectedRowIds(nextRows.map((row) => row.id));
      setMessage(
        loadedRows.length > 0
          ? `Wczytano ${loadedRows.length} obsługiwanych plików do nazwania.`
          : "Nie znaleziono obsługiwanych plików w wybranym folderze.",
      );
      setMessageType(loadedRows.length > 0 ? "success" : "muted");
    } catch (error) {
      if (requestId !== workingFolderRequestIdRef.current) {
        return;
      }

      setMessage(error instanceof Error ? error.message : "Nie udało się wczytać folderu roboczego.");
      setMessageType("error");
    } finally {
      if (requestId === workingFolderRequestIdRef.current) {
        pendingWorkingFolderPathRef.current = "";
        setLoadingWorkingFolder(false);
      }
    }
  }

  async function loadTargetFolder(nextFolderPath: string) {
    setLoadingTargetFolder(true);

    try {
      const result = await refreshTargetFolderData(nextFolderPath);
      setTargetFolder(nextFolderPath);
      setCopiedTargetPaths([]);
      setMessage(
        result.files.length > 0
          ? `Folder docelowy zawiera ${result.files.length} obsługiwanych plików do porównania.`
          : "Folder docelowy jest pusty albo nie zawiera obsługiwanych plików.",
      );
      setMessageType("muted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wczytać folderu docelowego.");
      setMessageType("error");
    } finally {
      setLoadingTargetFolder(false);
    }
  }

  async function refreshWorkingFolderInPlace() {
    if (!workingFolder) {
      return;
    }

    const requestId = workingFolderRequestIdRef.current + 1;
    workingFolderRequestIdRef.current = requestId;
    pendingWorkingFolderPathRef.current = normalizeFileSystemPath(workingFolder);
    setLoadingWorkingFolder(true);

    try {
      const result = await window.fileFilterApi.listNamingFiles(workingFolder);
      if (requestId !== workingFolderRequestIdRef.current) {
        return;
      }

      setWorkingStats({ ignoredCount: result.ignoredCount, totalCount: result.totalCount });

      const latestFilesByPath = new Map(
        result.files.map((file) => [normalizeFileSystemPath(file.absolutePath), file]),
      );
      const seenPaths = new Set<string>();

      const nextRows = dedupeRowsBySourcePath(
        rows
          .filter((row) => latestFilesByPath.has(normalizeFileSystemPath(row.sourcePath)))
          .map((row) => {
            const normalizedSourcePath = normalizeFileSystemPath(row.sourcePath);
            seenPaths.add(normalizedSourcePath);
            return mergeRowWithLatestFile(row, latestFilesByPath.get(normalizedSourcePath)!);
          }),
      );

      const nextIgnoredRows = dedupeRowsBySourcePath(
        ignoredRows
          .filter((row) => latestFilesByPath.has(normalizeFileSystemPath(row.sourcePath)))
          .map((row) => {
            const normalizedSourcePath = normalizeFileSystemPath(row.sourcePath);
            seenPaths.add(normalizedSourcePath);
            return mergeRowWithLatestFile(row, latestFilesByPath.get(normalizedSourcePath)!);
          }),
      );
      const nextIgnoredPathSet = new Set(nextIgnoredRows.map((row) => normalizeFileSystemPath(row.sourcePath)));
      const sanitizedNextRows = nextRows.filter(
        (row) => !nextIgnoredPathSet.has(normalizeFileSystemPath(row.sourcePath)),
      );

      const addedRows = dedupeRowsBySourcePath(
        result.files
          .filter((file) => {
            const normalizedSourcePath = normalizeFileSystemPath(file.absolutePath);
            return !seenPaths.has(normalizedSourcePath) && !nextIgnoredPathSet.has(normalizedSourcePath);
          })
          .map((file) => buildInitialRow(file, defaultRevision, defaultStatus)),
      );

      const removedCount = rows.length + ignoredRows.length - sanitizedNextRows.length - nextIgnoredRows.length;

      setRows([...sanitizedNextRows, ...addedRows]);
      setIgnoredRows(nextIgnoredRows);
      setLastBulkOperation(null);

      if (addedRows.length === 0 && removedCount === 0) {
        setMessage("Odświeżono folder roboczy. Nie wykryto zmian w liście plików.");
        setMessageType("muted");
        return;
      }

      const messageParts: string[] = [];
      if (addedRows.length > 0) {
        messageParts.push(`dodano ${formatPolishCount(addedRows.length, "plik", "pliki", "plików")}`);
      }
      if (removedCount > 0) {
        messageParts.push(`usunięto ${formatPolishCount(removedCount, "plik", "pliki", "plików")} z sesji`);
      }

      setMessage(`Odświeżono folder roboczy: ${messageParts.join(", ")}.`);
      setMessageType("success");
    } catch (error) {
      if (requestId !== workingFolderRequestIdRef.current) {
        return;
      }

      setMessage(error instanceof Error ? error.message : "Nie udało się odświeżyć folderu roboczego.");
      setMessageType("error");
    } finally {
      if (requestId === workingFolderRequestIdRef.current) {
        pendingWorkingFolderPathRef.current = "";
        setLoadingWorkingFolder(false);
      }
    }
  }

  async function handleChooseWorkingFolder() {
    const chosenPath = await window.fileFilterApi.chooseDirectory("Wybierz folder roboczy z plikami do nazwania");
    if (!chosenPath) {
      return;
    }

    await loadWorkingFolder(chosenPath);
  }

  async function handleChooseTargetFolder() {
    const chosenPath = await window.fileFilterApi.chooseDirectory("Wybierz folder docelowy dla poprawnie nazwanych plików");
    if (!chosenPath) {
      return;
    }

    await loadTargetFolder(chosenPath);
  }

  function handleDefaultRevisionCommit(nextValue: string) {
    if (messageType === "error" && isRevisionValidationMessage(message)) {
      setMessage("");
    }

    setDefaultRevision(nextValue);
    setDefaultRevisionInput(nextValue);
  }

  function updateRow(rowId: string, patch: Partial<NamingFileRow>) {
    setHasFileListChanges(true);
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function rememberBulkOperation(previousRows: NamingFileRow[], message: string) {
    setLastBulkOperation({
      rows: previousRows.map((row) => ({ ...row })),
      message,
    });
  }

  function applyRevisionAndStatusToAll(nextRevision: string, nextStatus: string) {
    if (rows.length === 0) {
      return;
    }

    const shouldApplyRevision = nextRevision.trim().length > 0;
    const shouldApplyStatus = nextStatus.trim().length > 0;
    if (!shouldApplyRevision && !shouldApplyStatus) {
      return;
    }

    rememberBulkOperation(rows, "Cofnięto masową zmianę rewizji i statusu.");
    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        revision: shouldApplyRevision ? nextRevision : row.revision,
        status: shouldApplyStatus ? nextStatus : row.status,
      })),
    );
  }

  function handleBulkRevisionInputChange(input: string) {
    if (messageType === "error" && isRevisionValidationMessage(message)) {
      setMessage("");
    }

    const nextValue = input.toUpperCase().replace(/\s+/g, "").slice(0, 3);
    if (nextValue && !isRevisionPartialInputAllowed(nextValue) && !normalizeRevisionInput(nextValue)) {
      setMessage(getRevisionValidationMessage(nextValue));
      setMessageType("error");
      return;
    }

    setBulkRevision(nextValue);
  }

  function handleBulkStatusInputChange(input: string) {
    if (messageType === "error" && message === BULK_STATUS_INPUT_MESSAGE) {
      setMessage("");
    }

    setBulkStatus(input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2));
  }

  function handleApplyBulkChangesFromMoreActions() {
    const rawRevision = bulkRevision.trim();
    const rawStatus = bulkStatus.trim().toUpperCase();
    const normalizedRevision = rawRevision ? normalizeRevisionInput(rawRevision) : null;
    const nextRevision = normalizedRevision ?? "";
    const nextStatus = rawStatus;

    if (rawRevision && !normalizedRevision) {
      setMessage(getRevisionValidationMessage(rawRevision));
      setMessageType("error");
      return;
    }

    if (rawStatus && !findOptionByCode(STATUS_OPTIONS, rawStatus)) {
      setMessage(BULK_STATUS_INPUT_MESSAGE);
      setMessageType("error");
      return;
    }

    if (!nextRevision && !nextStatus) {
      return;
    }

    if (
      messageType === "error" &&
      (isRevisionValidationMessage(message) || message === BULK_STATUS_INPUT_MESSAGE)
    ) {
      setMessage("");
    }

    setBulkRevision(nextRevision);
    setBulkStatus(nextStatus);
    setMoreActionsOpen(false);

    if (rows.length === 0) {
      return;
    }

    if (hasFileListChanges) {
      setPendingBulkApply({
        changedField: nextRevision ? "revision" : "status",
        nextRevision,
        nextStatus,
        previousRevision: nextRevision,
        previousStatus: nextStatus,
      });
      return;
    }

    applyRevisionAndStatusToAll(nextRevision, nextStatus);
  }

  function confirmBulkApply() {
    if (!pendingBulkApply) {
      return;
    }

    applyRevisionAndStatusToAll(pendingBulkApply.nextRevision, pendingBulkApply.nextStatus);
    setPendingBulkApply(null);
  }

  function rejectBulkApply() {
    if (!pendingBulkApply) {
      return;
    }

    setBulkRevision(pendingBulkApply.previousRevision);
    setBulkStatus(pendingBulkApply.previousStatus);
    setPendingBulkApply(null);
  }

  function undoLastBulkOperation() {
    if (!lastBulkOperation) {
      return;
    }

    setRows(lastBulkOperation.rows.map((row) => ({ ...row })));
    setMessage(lastBulkOperation.message);
    setMessageType("muted");
    setLastBulkOperation(null);
    setHasFileListChanges(true);
  }

  function applyValueFromFileName(
    label: string,
    getValue: (row: NamingFileRow) => string,
    applyPatch: (value: string) => Partial<NamingFileRow>,
  ) {
    if (rows.length === 0) {
      setMoreActionsOpen(false);
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const nextRows = rows.map((row) => {
      const nextValue = getValue(row);
      if (!nextValue) {
        skippedCount += 1;
        return row;
      }

      updatedCount += 1;
      return {
        ...row,
        ...applyPatch(nextValue),
      };
    });

    setHasFileListChanges(true);
    setRows(nextRows);
    setLastBulkOperation(null);
    const summaryMessage =
      `Zczytano ${label} dla ${formatPolishCount(updatedCount, "pliku", "plików", "plików")}. ` +
      `Pominięto ${formatPolishCount(skippedCount, "plik", "pliki", "plików")}.`;

    setMessage(summaryMessage);
    setMessageType(updatedCount > 0 ? "success" : "muted");
    setSuccessDialogTitle("Odczytywanie zakończone");
    setSuccessDialogMessage(summaryMessage);
    setMoreActionsOpen(false);
  }

  function handleApplyRevisionFromFileNames() {
    applyValueFromFileName("numer rewizji", (row) => getRevisionFromFileName(row.fileName), (revision) => ({ revision }));
  }

  function handleApplyStatusFromFileNames() {
    applyValueFromFileName("status", (row) => getStatusFromFileName(row.fileName), (status) => ({ status }));
  }

  function toggleDrawingNumberLock(rowId: string) {
    const targetRow = rows.find((row) => row.id === rowId);
    if (!targetRow?.drawingNumber) {
      return;
    }

    setHasFileListChanges(true);
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              drawingNumberLocked: !row.drawingNumberLocked,
            }
          : row,
      ),
    );
  }

  function moveRowToIgnored(rowId: string) {
    const movedRow = rows.find((row) => row.id === rowId);
    if (!movedRow) {
      return;
    }

    setHasFileListChanges(true);
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
    setIgnoredRows((currentRows) => [...currentRows, movedRow]);
    setSelectedRowIds((currentIds) => currentIds.filter((id) => id !== rowId));
    setCopyingRowIds((currentIds) => currentIds.filter((id) => id !== rowId));
    setBatchWarningRowIds((currentIds) => currentIds.filter((id) => id !== rowId));
    setBatchWarningIncludedRowIds((currentIds) => currentIds.filter((id) => id !== rowId));

    if (overwriteConfirmRowId === rowId) {
      setOverwriteConfirmRowId(null);
    }

    if (customNameDialogRowId === rowId) {
      closeCustomNameDialog();
    }

    if (draggedRowId === rowId) {
      setDraggedRowId(null);
    }

    if (dragOverRowId === rowId) {
      setDragOverRowId(null);
    }
  }

  function restoreIgnoredRow(rowId: string) {
    const restoredRow = ignoredRows.find((row) => row.id === rowId);
    if (!restoredRow) {
      return;
    }

    setHasFileListChanges(true);
    setIgnoredRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
    setRows((currentRows) => [...currentRows, restoredRow]);
    setSelectedRowIds((currentIds) => [...currentIds, rowId]);
  }

  function toggleRowSelection(rowId: string) {
    moveRowToIgnored(rowId);
  }

  function handleSelectableRowPointerDown(rowId: string) {
    rowPointerDownRef.current = {
      rowId,
      at: Date.now(),
    };
  }

  function handleSelectableRowClick(event: ReactMouseEvent<HTMLTableRowElement>, rowId: string) {
    if (!shouldToggleSelectionFromTarget(event.target)) {
      return;
    }

    const interaction = rowPointerDownRef.current;
    rowPointerDownRef.current = null;
    if (!interaction || interaction.rowId !== rowId) {
      return;
    }

    if (Date.now() - interaction.at > 250) {
      return;
    }

    toggleRowSelection(rowId);
  }

  function toggleVisibleRows(visibleRowIds: string[]) {
    if (visibleRowIds.length === 0) {
      return;
    }

    const visibleRowIdSet = new Set(visibleRowIds);
    const visibleRows = rows.filter((row) => visibleRowIdSet.has(row.id));
    if (visibleRows.length === 0) {
      return;
    }

    const nextIgnoredRows = [...ignoredRows, ...visibleRows];
    setHasFileListChanges(true);
    setIgnoredRows(nextIgnoredRows);
    setRows((currentRows) => currentRows.filter((row) => !visibleRowIdSet.has(row.id)));
    setSelectedRowIds((currentIds) => currentIds.filter((id) => !visibleRowIdSet.has(id)));
    setCopyingRowIds((currentIds) => currentIds.filter((id) => !visibleRowIdSet.has(id)));
    setBatchWarningRowIds((currentIds) => currentIds.filter((id) => !visibleRowIdSet.has(id)));
    setBatchWarningIncludedRowIds((currentIds) => currentIds.filter((id) => !visibleRowIdSet.has(id)));
    setOverwriteConfirmRowId((currentId) => (currentId && visibleRowIdSet.has(currentId) ? null : currentId));

    if (customNameDialogRowId && visibleRowIdSet.has(customNameDialogRowId)) {
      closeCustomNameDialog();
    }

    if (draggedRowId && visibleRowIdSet.has(draggedRowId)) {
      setDraggedRowId(null);
    }

    if (dragOverRowId && visibleRowIdSet.has(dragOverRowId)) {
      setDragOverRowId(null);
    }

    setIsIgnoredSectionCollapsed(false);
  }

  function moveRowByOffset(rowId: string, offset: number) {
    setHasFileListChanges(true);
    setRows((currentRows) => {
      const currentIndex = currentRows.findIndex((row) => row.id === rowId);
      const nextIndex = currentIndex + offset;

      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= currentRows.length) {
        return currentRows;
      }

      const nextRows = [...currentRows];
      const [movedRow] = nextRows.splice(currentIndex, 1);
      nextRows.splice(nextIndex, 0, movedRow);
      return nextRows;
    });
  }

  function moveRowToTarget(rowId: string, targetRowId: string) {
    if (rowId === targetRowId) {
      return;
    }

    setHasFileListChanges(true);
    setRows((currentRows) => {
      const currentIndex = currentRows.findIndex((row) => row.id === rowId);
      const targetIndex = currentRows.findIndex((row) => row.id === targetRowId);

      if (currentIndex === -1 || targetIndex === -1) {
        return currentRows;
      }

      const nextRows = [...currentRows];
      const [movedRow] = nextRows.splice(currentIndex, 1);
      nextRows.splice(targetIndex, 0, movedRow);
      return nextRows;
    });
  }

  function removeRowFromView(rowId: string) {
    const removedRow = rows.find((row) => row.id === rowId);
    if (!removedRow) {
      return;
    }

    setHasFileListChanges(true);
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
    setSelectedRowIds((currentIds) => currentIds.filter((id) => id !== rowId));
    setCopyingRowIds((currentIds) => currentIds.filter((id) => id !== rowId));

    if (draggedRowId === rowId) {
      setDraggedRowId(null);
    }

    if (dragOverRowId === rowId) {
      setDragOverRowId(null);
    }

    setMessage(`Usunięto plik ${removedRow.fileName} z podglądu listy.`);
    setMessageType("muted");
  }

  function sortRowsByFileName() {
    setHasFileListChanges(true);
    setRows((currentRows) =>
      [...currentRows].sort((left, right) =>
        left.fileName.localeCompare(right.fileName, "pl", { sensitivity: "base", numeric: true }),
      ),
    );
  }

  function handlePhaseSelect(option: NamingOption) {
    setPhaseInput(option.code);
    setPhaseMenuOpen(false);
    setHighlightedPhaseIndex(-1);
  }

  function handleDisciplineSelect(option: NamingOption) {
    setDisciplineInput(option.code);
    setDisciplineMenuOpen(false);
    setHighlightedDisciplineIndex(-1);
  }

  const targetFileNameSet = useMemo(
    () => new Set(targetFiles.map((file) => normalize(file.fileName))),
    [targetFiles],
  );

  const targetDrawingKeySet = useMemo(() => {
    const keys = new Set<string>();
    const identityKeys = new Set<string>();

    targetFiles.forEach((file) => {
      const parsed = parseStandardizedFileName(file.fileName);
      if (!parsed) {
        return;
      }

      keys.add(
        [
          parsed.projectNumber,
          parsed.phase,
          parsed.disciplineCode,
          parsed.namingStandardVersion === 4 ? parsed.buildingDesignation ?? "" : "",
          parsed.drawingNumber,
          parsed.revision,
          parsed.status,
        ].join("|"),
      );

      const extensionIndex = file.fileName.lastIndexOf(".");
      const extension = extensionIndex >= 0 ? file.fileName.slice(extensionIndex).toLowerCase() : "";
      identityKeys.add(
        [
          parsed.projectNumber,
          parsed.phase,
          parsed.disciplineCode,
          parsed.documentType,
          parsed.namingStandardVersion === 4 ? parsed.buildingDesignation ?? "" : "",
          parsed.level,
          parsed.drawingNumber,
          parsed.revision,
          parsed.status,
          extension,
        ].join("|"),
      );
    });

    return { keys, identityKeys };
  }, [namingStandardConfigVersion, targetFiles]);

  const copiedTargetPathSet = useMemo(() => new Set(copiedTargetPaths), [copiedTargetPaths]);

  const evaluatedRows = useMemo<EvaluatedRow[]>(() => {
    const draftRows = rows.map((row) => {
      const targetFileName = buildTargetFileName(row, resolvedSession, effectiveNamingStandardVersion);
      const targetPath = targetFolder && targetFileName ? joinWindowsPath(targetFolder, targetFileName) : "";

      return {
        row,
        targetFileName,
        targetPath,
      };
    });

    const fullNameCounts = new Map<string, number>();
    const drawingKeyCounts = new Map<string, number>();

    draftRows.forEach((draft) => {
      if (draft.targetFileName) {
        const key = normalize(draft.targetFileName);
        fullNameCounts.set(key, (fullNameCounts.get(key) ?? 0) + 1);
      }

      if (resolvedSession && draft.row.drawingNumber && draft.row.revision && draft.row.status) {
        const drawingKey = buildDrawingConflictKey(resolvedSession, draft.row, effectiveNamingStandardVersion);
        drawingKeyCounts.set(drawingKey, (drawingKeyCounts.get(drawingKey) ?? 0) + 1);
      }
    });

    return draftRows.map((draft) => {
      const details: string[] = [];
      const isCopied = Boolean(draft.targetPath && copiedTargetPathSet.has(draft.targetPath));
      let warningMessage = "";

      if (!resolvedSession) {
        if (!isProjectNumberValid(projectNumber)) {
          details.push("Numer projektu musi mieć 5 cyfr.");
        }

        if (!phaseMatch) {
          details.push("Uzupełnij rozpoznaną fazę projektu.");
        }

        if (!disciplineMatch) {
          details.push("Uzupełnij rozpoznaną branżę.");
        }
      }

      if (!draft.row.documentType) {
        details.push("Brakuje typu dokumentu.");
      }

      if (effectiveNamingStandardVersion === 4 && !isBuildingDesignationValid(draft.row.buildingDesignation)) {
        details.push("Oznaczenie budynku musi mieć wartość A-I albo X.");
      }

      if (!draft.row.level) {
        details.push("Brakuje poziomu.");
      }

      if (!draft.row.drawingNumber) {
        details.push("Brakuje numeru arkusza.");
      } else if (!/^[A-Z]\d{2}$/.test(draft.row.drawingNumber)) {
        details.push("Numer arkusza musi mieć format litera + dwie cyfry, np. E04.");
      } else if (
        resolvedSession &&
        !isDrawingNumberValidForDiscipline(resolvedSession.disciplineCode, draft.row.drawingNumber)
      ) {
        details.push("Numer arkusza musi zaczynać się od pierwszej litery branży albo od X.");
      }

      if (!draft.row.revision) {
        details.push("Brakuje rewizji.");
      } else if (!isRevisionCodeValid(draft.row.revision)) {
        details.push("Rewizja musi mieć format R00-R99 albo W01-W99.");
      }

      if (!draft.row.status) {
        details.push("Brakuje statusu.");
      }

      if (!targetFolder) {
        details.push("Wybierz folder docelowy.");
      }

      if (!isCopied && draft.targetFileName) {
        const normalizedTargetFileName = normalize(draft.targetFileName);
        const hasExistingTargetFileByName = targetFileNameSet.has(normalizedTargetFileName);
        const hasExistingTargetFileByIdentity =
          resolvedSession &&
          draft.row.documentType &&
          (effectiveNamingStandardVersion === 3 || draft.row.buildingDesignation) &&
          draft.row.level &&
          draft.row.drawingNumber &&
          draft.row.revision &&
          draft.row.status
            ? targetDrawingKeySet.identityKeys.has(
                buildTargetIdentityKey(resolvedSession, {
                  documentType: draft.row.documentType,
                  buildingDesignation: draft.row.buildingDesignation,
                  level: draft.row.level,
                  drawingNumber: draft.row.drawingNumber,
                  revision: draft.row.revision,
                  status: draft.row.status,
                  extension: draft.row.extension,
                }, effectiveNamingStandardVersion),
              )
            : false;
        const hasExistingTargetFile = hasExistingTargetFileByName || hasExistingTargetFileByIdentity;

        if ((fullNameCounts.get(normalizedTargetFileName) ?? 0) > 1) {
          details.push("W tej partii powstają dwa pliki o tej samej nazwie.");
        }

        if (hasExistingTargetFile) {
          warningMessage = "W folderze docelowym znajduje się już plik o takiej nazwie.";
        }
      }

      if (!isCopied && resolvedSession && draft.row.drawingNumber && draft.row.revision && draft.row.status) {
        const drawingKey = buildDrawingConflictKey(resolvedSession, draft.row, effectiveNamingStandardVersion);
        const hasExistingTargetFile = draft.targetFileName
          ? targetFileNameSet.has(normalize(draft.targetFileName))
          : false;

        if ((drawingKeyCounts.get(drawingKey) ?? 0) > 1) {
          details.push("Numer arkusza powiela się w tej partii dla tego samego kontekstu.");
        }

        if (!hasExistingTargetFile && targetDrawingKeySet.keys.has(drawingKey)) {
          details.push("Numer arkusza jest już zajęty w folderze docelowym dla tego samego kontekstu.");
        }
      }

      return {
        ...draft,
        validation: isCopied
          ? {
              status: "copied" as const,
              message: "Plik skopiowany",
              details: [],
            }
          : details.length > 0
            ? {
                status: "error" as const,
                message: details[0],
                details,
              }
            : warningMessage
              ? {
                  status: "warning" as const,
                  message: "Gotowy do kopiowania",
                  details: [],
                  warningMessage,
                }
            : {
                status: "ok" as const,
                message: "Gotowy do kopiowania",
                details: [],
              },
      };
    });
  }, [
    copiedTargetPathSet,
    disciplineMatch,
    effectiveNamingStandardVersion,
    namingStandardConfigVersion,
    phaseMatch,
    projectNumber,
    resolvedSession,
    rows,
    targetDrawingKeySet,
    targetFileNameSet,
    targetFolder,
  ]);

  const selectedSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);

  const extensionFilterOptions = useMemo(
    () =>
      (["pdf", "dwg", "doc", "xls"] as ExtensionFilterGroup[]).filter((group) =>
        rows.some((row) => getExtensionFilterGroup(row.extension) === group),
      ),
    [rows],
  );

  useEffect(() => {
    if (!extensionFilter) {
      return;
    }

    if (!extensionFilterOptions.includes(extensionFilter)) {
      setExtensionFilter("");
    }
  }, [extensionFilter, extensionFilterOptions]);

  const filteredEvaluatedRows = useMemo(
    () =>
      extensionFilter
        ? evaluatedRows.filter((evaluatedRow) => getExtensionFilterGroup(evaluatedRow.row.extension) === extensionFilter)
        : evaluatedRows,
    [evaluatedRows, extensionFilter],
  );

  const visibleRowIds = useMemo(
    () => filteredEvaluatedRows.map((evaluatedRow) => evaluatedRow.row.id),
    [filteredEvaluatedRows],
  );

  const allVisibleRowsSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((rowId) => selectedSet.has(rowId));

  const summary = useMemo(() => {
    const readyCount = evaluatedRows.filter((row) => row.validation.status !== "error").length;
    const errorCount = evaluatedRows.filter((row) => row.validation.status === "error").length;
    const warningCount = evaluatedRows.filter((row) => row.validation.status === "warning").length;

    return {
      total: evaluatedRows.length,
      readyCount,
      warningCount,
      errorCount,
    };
  }, [evaluatedRows]);

  const copyableRows = useMemo(
    () => evaluatedRows.filter((row) => row.validation.status === "ok" || row.validation.status === "warning"),
    [evaluatedRows],
  );

  const canCopyFiles =
    copyableRows.length > 0 &&
    Boolean(targetFolder) &&
    Boolean(resolvedSession);

  const overwriteConfirmRow = useMemo(
    () => evaluatedRows.find((row) => row.row.id === overwriteConfirmRowId) ?? null,
    [evaluatedRows, overwriteConfirmRowId],
  );

  const customNameDialogRow = useMemo(
    () => evaluatedRows.find((row) => row.row.id === customNameDialogRowId) ?? null,
    [customNameDialogRowId, evaluatedRows],
  );

  const batchWarningRows = useMemo(
    () => evaluatedRows.filter((row) => batchWarningRowIds.includes(row.row.id)),
    [batchWarningRowIds, evaluatedRows],
  );

  const customNameCandidate = useMemo(() => {
    if (!customNameDialogRow) {
      return null;
    }

    const baseName = extractFileNameFromInput(customNameInput).trim();
    if (!baseName) {
      return null;
    }

    if (baseName.includes(".")) {
      return null;
    }

    const fileName = `${baseName}${customNameDialogRow.row.extension}`;
    const parsed = parseStandardizedFileName(fileName);
    if (!parsed) {
      return null;
    }

    if (parsed.namingStandardVersion !== effectiveNamingStandardVersion) {
      return null;
    }

    if (!isDrawingNumberValidForDiscipline(parsed.disciplineCode, parsed.drawingNumber)) {
      return null;
    }

    if (
      resolvedSession &&
      (parsed.projectNumber !== resolvedSession.projectNumber ||
        parsed.phase !== resolvedSession.phaseCode ||
        parsed.disciplineCode !== resolvedSession.disciplineCode)
    ) {
      return null;
    }

    return { fileName, parsed };
  }, [customNameDialogRow, customNameInput, effectiveNamingStandardVersion, namingStandardConfigVersion, resolvedSession]);

  function assignNextDrawingNumber(rowId: string) {
    if (!resolvedSession) {
      return;
    }

    const currentRow = rows.find((row) => row.id === rowId);
    if (!currentRow || currentRow.drawingNumberLocked) {
      return;
    }

    const drawingPrefix = resolvedSession.disciplineCode[0] ?? "X";
    const contextKey = buildDrawingContextKey(resolvedSession, currentRow, effectiveNamingStandardVersion);
    const usedNumbers = new Set<string>();

    targetFiles.forEach((file) => {
      const parsed = parseStandardizedFileName(file.fileName);
      if (!parsed) {
        return;
      }

      const targetContextKey = [
        parsed.projectNumber,
        parsed.phase,
        parsed.disciplineCode,
        parsed.namingStandardVersion === 4 ? parsed.buildingDesignation ?? "" : "",
        parsed.revision,
        parsed.status,
      ].join("|");

      if (targetContextKey === contextKey) {
        usedNumbers.add(parsed.drawingNumber);
      }
    });

    rows.forEach((row) => {
      if (
        row.id !== rowId &&
        row.revision === currentRow.revision &&
        row.status === currentRow.status &&
        (effectiveNamingStandardVersion === 3 || row.buildingDesignation === currentRow.buildingDesignation) &&
        row.drawingNumber
      ) {
        usedNumbers.add(row.drawingNumber);
      }
    });

    const nextDrawingNumber = getNextDrawingNumber(drawingPrefix, usedNumbers);
    if (!nextDrawingNumber) {
      setMessage("Nie udało się znaleźć wolnego numeru arkusza w zakresie 01-99.");
      setMessageType("error");
      return;
    }

    setHasFileListChanges(true);
    updateRow(rowId, { drawingNumber: nextDrawingNumber });
  }

  function openAssignDrawingNumbersDialog() {
    if (!resolvedSession || rows.length === 0) {
      return;
    }

    setDrawingStartInput("1");
    setDrawingStartTouched(false);
    setDrawingStartDialogOpen(true);
  }

  function assignDrawingNumbersToAll(startNumber: number) {
    if (!resolvedSession || rows.length === 0) {
      return;
    }

    const unlockedRowsCount = rows.filter((row) => !row.drawingNumberLocked).length;
    const endNumber = startNumber + unlockedRowsCount - 1;
    if (endNumber > 99) {
      setMessage(
        `Dla ${unlockedRowsCount} ${unlockedRowsCount === 1 ? "pliku" : unlockedRowsCount < 5 ? "plików" : "plików"} numer początkowy nie może być większy niż ${100 - unlockedRowsCount}.`,
      );
      setMessageType("error");
      return;
    }

    const drawingPrefix = resolvedSession.disciplineCode[0] ?? "X";
    const usedNumbersByContext = new Map<string, Set<string>>();

    targetFiles.forEach((file) => {
      const parsed = parseStandardizedFileName(file.fileName);
      if (!parsed) {
        return;
      }

      const contextKey = [
        parsed.projectNumber,
        parsed.phase,
        parsed.disciplineCode,
        parsed.namingStandardVersion === 4 ? parsed.buildingDesignation ?? "" : "",
        parsed.revision,
        parsed.status,
      ].join("|");
      if (!usedNumbersByContext.has(contextKey)) {
        usedNumbersByContext.set(contextKey, new Set());
      }
      usedNumbersByContext.get(contextKey)?.add(parsed.drawingNumber);
    });

    rows.forEach((row) => {
      if (!row.drawingNumberLocked || !row.drawingNumber) {
        return;
      }

      const contextKey = buildDrawingContextKey(resolvedSession, row, effectiveNamingStandardVersion);
      if (!usedNumbersByContext.has(contextKey)) {
        usedNumbersByContext.set(contextKey, new Set());
      }
      usedNumbersByContext.get(contextKey)?.add(row.drawingNumber);
    });

    let nextIndex = startNumber;
    const nextRows = rows.map((row) => {
      if (row.drawingNumberLocked || !resolvedSession) {
        return row;
      }

      const contextKey = buildDrawingContextKey(resolvedSession, row, effectiveNamingStandardVersion);
      if (!usedNumbersByContext.has(contextKey)) {
        usedNumbersByContext.set(contextKey, new Set());
      }

      const usedNumbers = usedNumbersByContext.get(contextKey)!;
      let candidate = formatDrawingNumber(drawingPrefix, nextIndex);

      while (usedNumbers.has(candidate)) {
        nextIndex += 1;
        if (nextIndex > 99) {
          setMessage("Nie udało się nadać numerów wszystkim plikom bez konfliktów.");
          setMessageType("error");
          return row;
        }
        candidate = formatDrawingNumber(drawingPrefix, nextIndex);
      }

      usedNumbers.add(candidate);
      nextIndex += 1;
      return {
        ...row,
        drawingNumber: candidate,
      };
    });

    rememberBulkOperation(rows, "Cofnięto masowe nadawanie numerów arkusza.");
    setHasFileListChanges(true);
    setRows(nextRows);
    setMessage("");
    setSuccessDialogTitle("Numerowanie zakończone");
    setSuccessDialogMessage(
      `Nadano numery arkuszy ${formatDrawingNumber(drawingPrefix, startNumber)}-${formatDrawingNumber(drawingPrefix, endNumber)}.`,
    );
  }

  function confirmAssignDrawingNumbers() {
    const trimmedInput = drawingStartInput.trim();
    setDrawingStartTouched(true);

    if (!/^\d{1,2}$/.test(trimmedInput)) {
      return;
    }

    const startNumber = Number(trimmedInput);
    if (startNumber < 1 || startNumber > 99) {
      return;
    }

    setDrawingStartDialogOpen(false);
    assignDrawingNumbersToAll(startNumber);
  }

  async function handleCopyFiles() {
    if (!canCopyFiles) {
      return;
    }

    setCopySummaryOpen(true);
  }

  async function continueCopyFiles() {
    setCopySummaryOpen(false);

    const warningRows = copyableRows.filter((row) => row.validation.status === "warning");
    if (warningRows.length > 0) {
      setBatchWarningRowIds(warningRows.map((row) => row.row.id));
      setBatchWarningIncludedRowIds(warningRows.map((row) => row.row.id));
      return;
    }

    await executeCopyRows(copyableRows, new Set());
  }

  async function executeCopyRows(rowsToCopy: EvaluatedRow[], overwriteRowIds: Set<string>) {
    if (rowsToCopy.length === 0) {
      return;
    }

    setCopyingFiles(true);

    try {
      const items = rowsToCopy.map((row) => ({
        sourcePath: row.row.sourcePath,
        targetPath: row.targetPath,
        overwriteExisting: overwriteRowIds.has(row.row.id),
      }));

      const result = await window.fileFilterApi.copyNamingFiles(items);
      setCopiedTargetPaths((currentPaths) => {
        const nextPaths = new Set(currentPaths);
        rowsToCopy.forEach((row) => {
          if (row.targetPath) {
            nextPaths.add(row.targetPath);
          }
        });
        return Array.from(nextPaths);
      });

      if (targetFolder) {
        await refreshTargetFolderData(targetFolder);
      }

      setMessage("");
      setSuccessDialogTitle("Kopiowanie zakończone");
      setSuccessDialogMessage(
        `Skopiowano ${formatPolishCount(result.copiedCount, "plik", "pliki", "plików")} do folderu docelowego.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się skopiować plików.");
      setMessageType("error");
    } finally {
      setCopyingFiles(false);
    }
  }

  async function handleRefreshWorkingFolder() {
    if (!workingFolder) {
      return;
    }

    await refreshWorkingFolderInPlace();
  }

  async function handleCopySingleRow(evaluatedRow: EvaluatedRow) {
    if (
      (evaluatedRow.validation.status !== "ok" && evaluatedRow.validation.status !== "warning") ||
      !evaluatedRow.targetPath ||
      !targetFolder
    ) {
      return;
    }

    if (evaluatedRow.validation.status === "warning") {
      setOverwriteConfirmRowId(evaluatedRow.row.id);
      return;
    }

    setCopyingRowIds((currentIds) => [...currentIds, evaluatedRow.row.id]);

    try {
      await window.fileFilterApi.copyNamingFiles([
        {
          sourcePath: evaluatedRow.row.sourcePath,
          targetPath: evaluatedRow.targetPath,
        },
      ]);

      setCopiedTargetPaths((currentPaths) =>
        currentPaths.includes(evaluatedRow.targetPath) ? currentPaths : [...currentPaths, evaluatedRow.targetPath],
      );
      await refreshTargetFolderData(targetFolder);
      setMessage(`Skopiowano plik ${evaluatedRow.row.fileName} do folderu docelowego.`);
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się skopiować pliku.");
      setMessageType("error");
    } finally {
      setCopyingRowIds((currentIds) => currentIds.filter((id) => id !== evaluatedRow.row.id));
    }
  }

  async function confirmSingleOverwrite() {
    if (!overwriteConfirmRow || !overwriteConfirmRow.targetPath || !targetFolder) {
      setOverwriteConfirmRowId(null);
      return;
    }

    setCopyingRowIds((currentIds) => [...currentIds, overwriteConfirmRow.row.id]);

    try {
      await window.fileFilterApi.copyNamingFiles([
        {
          sourcePath: overwriteConfirmRow.row.sourcePath,
          targetPath: overwriteConfirmRow.targetPath,
          overwriteExisting: true,
        },
      ]);

      setCopiedTargetPaths((currentPaths) =>
        currentPaths.includes(overwriteConfirmRow.targetPath) ? currentPaths : [...currentPaths, overwriteConfirmRow.targetPath],
      );
      await refreshTargetFolderData(targetFolder);
      setMessage(`Nadpisano plik ${overwriteConfirmRow.row.fileName} w folderze docelowym.`);
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się nadpisać pliku.");
      setMessageType("error");
    } finally {
      setCopyingRowIds((currentIds) => currentIds.filter((id) => id !== overwriteConfirmRow.row.id));
      setOverwriteConfirmRowId(null);
    }
  }

  async function confirmBatchWarnings() {
    const warningRowsToCopy = batchWarningRows.filter((row) => batchWarningIncludedRowIds.includes(row.row.id));
    const okRows = copyableRows.filter((row) => row.validation.status === "ok");
    const rowsToCopy = [...okRows, ...warningRowsToCopy];

    setBatchWarningRowIds([]);
    setBatchWarningIncludedRowIds([]);

    await executeCopyRows(rowsToCopy, new Set(warningRowsToCopy.map((row) => row.row.id)));
  }

  function openCustomNameDialog(evaluatedRow: EvaluatedRow) {
    setCustomNameDialogRowId(evaluatedRow.row.id);
    const extension = evaluatedRow.row.extension;
    const initialValue = evaluatedRow.targetFileName.endsWith(extension)
      ? evaluatedRow.targetFileName.slice(0, -extension.length)
      : evaluatedRow.targetFileName;
    setCustomNameInput(initialValue);
    setCustomNameTouched(false);
  }

  function closeCustomNameDialog() {
    setCustomNameDialogRowId(null);
    setCustomNameInput("");
    setCustomNameTouched(false);
  }

  function applyCustomNameFromDialog() {
    if (!customNameDialogRow || !customNameCandidate) {
      setCustomNameTouched(true);
      return;
    }

    if (!resolvedSession) {
      setProjectNumber(customNameCandidate.parsed.projectNumber);
      setPhaseInput(customNameCandidate.parsed.phase);
      setDisciplineInput(customNameCandidate.parsed.disciplineCode);
    }

    updateRow(customNameDialogRow.row.id, {
      documentType: customNameCandidate.parsed.documentType,
      level: customNameCandidate.parsed.level,
      drawingNumber: customNameCandidate.parsed.drawingNumber,
      revision: customNameCandidate.parsed.revision,
      status: customNameCandidate.parsed.status,
    });

    closeCustomNameDialog();
  }

  useEffect(() => {
    if (!customNameDialogRow) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCustomNameDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [customNameDialogRow]);

  return (
    <section className="naming-view">
      {successDialogMessage ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="copy-success-title">
            <h3 id="copy-success-title">{successDialogTitle}</h3>
            <p>{successDialogMessage}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => setSuccessDialogMessage("")}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moreActionsOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card more-actions-modal" role="dialog" aria-modal="true" aria-labelledby="more-actions-title">
            <h3 id="more-actions-title">Więcej opcji</h3>
            <div className="more-actions-section">
              <h4>Aktualizacja rewizji/statusu</h4>
              <p>Wpisz Rewizję i/lub Status, które chcesz ustawić dla zaznaczonych plików.</p>
              <div className="more-actions-bulk-row">
                <label className="field more-actions-field more-actions-field-revision">
                  <span>Rewizja</span>
                  <input
                    value={bulkRevision}
                    className="more-actions-code-input"
                    onChange={(event) => handleBulkRevisionInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleApplyBulkChangesFromMoreActions();
                      }
                    }}
                    placeholder="R00"
                    maxLength={3}
                    autoFocus
                  />
                </label>
                <label className="field more-actions-field more-actions-field-status">
                  <span>Status</span>
                  <InlineCodeSelect
                    value={bulkStatus}
                    options={STATUS_OPTIONS}
                    placeholder="S0"
                    menuLabel="Wybierz status dla zaznaczonych plików"
                    onChange={handleBulkStatusInputChange}
                  />
                </label>
                <button
                  type="button"
                  className="primary-button more-actions-apply-button"
                  onClick={handleApplyBulkChangesFromMoreActions}
                  disabled={rows.length === 0 || (!bulkRevision.trim() && !bulkStatus.trim())}
                >
                  Zastosuj
                </button>
              </div>
            </div>

            <div className="more-actions-section">
              <h4>Odczytaj z nazwy pliku</h4>
              <div className="modal-button-stack more-actions-button-stack">
                <button
                  type="button"
                  className="ghost-button modal-button-wide"
                  onClick={() => {
                    handleApplyRevisionFromFileNames();
                    setMoreActionsOpen(false);
                  }}
                >
                  Odczytaj numer rewizji z nazwy pliku
                </button>
                <button
                  type="button"
                  className="ghost-button modal-button-wide"
                  onClick={() => {
                    handleApplyStatusFromFileNames();
                    setMoreActionsOpen(false);
                  }}
                >
                  Odczytaj status z nazwy pliku
                </button>
              </div>
              <p>
                Wybranie jednej z opcji automatycznie zczyta numer rewizji lub status z istniejącej nazwy pliku -
                przydatne jeżeli nadpisujesz plik.
              </p>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setMoreActionsOpen(false)}>
                Zamknij
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {copySummaryOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="copy-summary-title">
            <h3 id="copy-summary-title">Podsumowanie kopiowania</h3>
            <p>Sprawdź, co zostanie uwzględnione w tej operacji.</p>
            <div className="copy-summary-modal-list">
              <div className="copy-summary-modal-item">
                <strong>{copyableRows.length}</strong>
                <span>gotowych do kopiowania</span>
              </div>
              <div className="copy-summary-modal-item">
                <strong>{summary.warningCount}</strong>
                <span>z nadpisaniem</span>
              </div>
              <div className="copy-summary-modal-item">
                <strong>{ignoredRows.length}</strong>
                <span>ignorowanych</span>
              </div>
              <div className="copy-summary-modal-item">
                <strong>{summary.errorCount}</strong>
                <span>z błędami</span>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setCopySummaryOpen(false)}>
                Anuluj
              </button>
              <button type="button" className="primary-button" onClick={() => void continueCopyFiles()}>
                Kontynuuj
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {drawingStartDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="drawing-start-title">
            <h3 id="drawing-start-title">Od jakiego numeru zacząć?</h3>
            <p>Podaj liczbę od 1 do 99.</p>
            <p>
              Po kliknięciu OK program nada kolejne numery arkuszy wszystkim odblokowanym pozycjom, zaczynając od
              podanej wartości. Zablokowane numery arkuszy pozostaną bez zmian.
            </p>
            <input
              className={`modal-input ${drawingStartTouched && !/^\d{1,2}$/.test(drawingStartInput.trim()) ? "invalid" : ""}`}
              value={drawingStartInput}
              onChange={(event) => setDrawingStartInput(event.target.value.replace(/\D/g, "").slice(0, 2))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmAssignDrawingNumbers();
                }
              }}
              placeholder="1"
              autoFocus
            />
            {drawingStartTouched &&
            (!/^\d{1,2}$/.test(drawingStartInput.trim()) ||
              Number(drawingStartInput.trim()) < 1 ||
              Number(drawingStartInput.trim()) > 99) ? (
              <div className="modal-error">Wpisz numer początkowy od 1 do 99.</div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setDrawingStartDialogOpen(false)}>
                Anuluj
              </button>
              <button type="button" className="primary-button" onClick={confirmAssignDrawingNumbers}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingBulkApply ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="bulk-apply-title">
            <h3 id="bulk-apply-title">Zastosować zmiany?</h3>
            <p>Chcesz zastosować te zmiany do całej bieżącej listy plików do nazwania?</p>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={rejectBulkApply}>
                Nie
              </button>
              <button type="button" className="primary-button" onClick={confirmBulkApply}>
                Tak
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {overwriteConfirmRow ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="overwrite-confirm-title">
            <h3 id="overwrite-confirm-title">Potwierdź nadpisanie</h3>
            <p>W folderze docelowym znajduje się już plik o takiej nazwie. Czy chcesz nadpisać tamten plik?</p>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setOverwriteConfirmRowId(null)}>
                Nie
              </button>
              <button type="button" className="primary-button" onClick={() => void confirmSingleOverwrite()}>
                Tak
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {batchWarningRows.length > 0 ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="batch-warning-title">
            <h3 id="batch-warning-title">Potwierdź nadpisanie plików</h3>
            <p>W folderze docelowym istnieją już pliki o takich nazwach. Zaznacz, które pliki mają zostać nadpisane.</p>
            <div className="warning-list">
              {batchWarningRows.map((row) => (
                <label key={row.row.id} className="warning-list-item">
                  <input
                    type="checkbox"
                    checked={batchWarningIncludedRowIds.includes(row.row.id)}
                    onChange={() =>
                      setBatchWarningIncludedRowIds((currentIds) =>
                        currentIds.includes(row.row.id)
                          ? currentIds.filter((id) => id !== row.row.id)
                          : [...currentIds, row.row.id],
                      )
                    }
                  />
                  <div className="warning-list-item-content">
                    <div className="warning-list-column">
                      <span className="warning-list-label">Obecna nazwa</span>
                      <strong>{row.row.fileName}</strong>
                    </div>
                    <div className="warning-list-column">
                      <span className="warning-list-label">Docelowa nazwa</span>
                      <strong className="warning-list-target-name">{row.targetFileName}</strong>
                      <span className="warning-list-message">{row.validation.warningMessage}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setBatchWarningRowIds([]);
                  setBatchWarningIncludedRowIds([]);
                }}
              >
                Przerwij
              </button>
              <button type="button" className="primary-button" onClick={() => void confirmBatchWarnings()}>
                Kontynuuj
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {customNameDialogRow ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="custom-name-title">
            <h3 id="custom-name-title">Własna nazwa pliku</h3>
            <p>Wpisz nazwę pliku bez rozszerzenia. Rozszerzenie zostanie dodane automatycznie.</p>
            <input
              className={`modal-input ${customNameTouched && !customNameCandidate ? "invalid" : ""}`}
              value={customNameInput}
              onChange={(event) => {
                setCustomNameInput(event.target.value);
                setCustomNameTouched(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyCustomNameFromDialog();
                }
              }}
              autoFocus
            />
            {customNameTouched && !customNameCandidate ? <div className="modal-error">Błędna nazwa</div> : null}
            <div className="modal-actions centered">
              <button type="button" className="ghost-button" onClick={closeCustomNameDialog}>
                Anuluj
              </button>
              <button type="button" className="primary-button" onClick={applyCustomNameFromDialog}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`naming-card naming-setup-card ${isSetupCollapsed ? "collapsed" : ""}`}>
        <>
        <div className="panel-header">
          <div>
            <h2>Pomocnik nazewnictwa</h2>
          </div>
            <button
              type="button"
              className="filter-group-toggle"
              aria-label={isSetupCollapsed ? "Rozwiń ustawienia pomocnika nazewnictwa" : "Zwiń ustawienia pomocnika nazewnictwa"}
              onClick={() => setIsSetupCollapsed((current) => !current)}
            >
              <span className={`filter-group-toggle-icon ${isSetupCollapsed ? "" : "expanded"}`}>&gt;</span>
            </button>
          </div>

          {isSetupCollapsed ? null : (
            <>
              <p className="naming-lead">Podaj:</p>

              <div className="naming-session-layout">
                <div className="naming-field-stack">
                  <div className="naming-inline-row">
                    <label className="naming-inline-label" htmlFor="naming-project-number">1. Numer projektu</label>
                    <div className="naming-inline-control">
                      <input
                        id="naming-project-number"
                        className="naming-session-input"
                        value={projectNumber}
                        onChange={(event) => setProjectNumber(event.target.value.replace(/\D/g, "").slice(0, 5))}
                        placeholder="Np. 25145"
                      />
                    </div>
                  </div>

                  <div className="naming-inline-row">
                    <label className="naming-inline-label" htmlFor="naming-phase-input">2. Faza projektu</label>
                    <div className="naming-inline-control">
                      <div className={`naming-autocomplete ${phaseMenuOpen ? "open" : ""}`}>
                        <input
                          id="naming-phase-input"
                          className="naming-session-input"
                          value={phaseInput}
                          onFocus={() => {
                            setPhaseMenuOpen(true);
                            setHighlightedPhaseIndex(-1);
                          }}
                          onBlur={() => {
                            window.setTimeout(() => setPhaseMenuOpen(false), 0);
                          }}
                          onChange={(event) => {
                            setPhaseInput(event.target.value);
                            setPhaseMenuOpen(true);
                            setHighlightedPhaseIndex(-1);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setPhaseMenuOpen(false);
                              setHighlightedPhaseIndex(-1);
                              return;
                            }

                            if (event.key === "ArrowDown") {
                              if (phaseSuggestions.length === 0) {
                                return;
                              }

                              event.preventDefault();
                              setPhaseMenuOpen(true);
                              setHighlightedPhaseIndex((current) =>
                                current < 0 ? 0 : Math.min(current + 1, phaseSuggestions.length - 1),
                              );
                              return;
                            }

                            if (event.key === "ArrowUp") {
                              if (phaseSuggestions.length === 0) {
                                return;
                              }

                              event.preventDefault();
                              setPhaseMenuOpen(true);
                              setHighlightedPhaseIndex((current) => (current <= 0 ? 0 : current - 1));
                              return;
                            }

                            if (event.key === "Enter" && phaseSuggestions.length > 0) {
                              event.preventDefault();
                              handlePhaseSelect(
                                highlightedPhaseIndex >= 0 ? phaseSuggestions[highlightedPhaseIndex] : phaseSuggestions[0],
                              );
                            }
                          }}
                          placeholder="Np. PT lub projekt budowlany"
                        />

                        {phaseMenuOpen && phaseSuggestions.length > 0 ? (
                          <div className="naming-autocomplete-menu">
                            {phaseSuggestions.map((option, index) => (
                              <button
                                key={option.code}
                                type="button"
                                className={`naming-autocomplete-option ${index === highlightedPhaseIndex ? "active" : ""}`}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setHighlightedPhaseIndex(index)}
                                onClick={() => handlePhaseSelect(option)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="naming-inline-row">
                    <label className="naming-inline-label" htmlFor="naming-discipline-input">3. Branża</label>
                    <div className="naming-inline-control">
                      <div className={`naming-autocomplete ${disciplineMenuOpen ? "open" : ""}`}>
                        <input
                          id="naming-discipline-input"
                          className="naming-session-input"
                          value={disciplineInput}
                          onFocus={() => {
                            setDisciplineMenuOpen(true);
                            setHighlightedDisciplineIndex(-1);
                          }}
                          onBlur={() => {
                            window.setTimeout(() => setDisciplineMenuOpen(false), 0);
                          }}
                          onChange={(event) => {
                            setDisciplineInput(event.target.value);
                            setDisciplineMenuOpen(true);
                            setHighlightedDisciplineIndex(-1);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setDisciplineMenuOpen(false);
                              setHighlightedDisciplineIndex(-1);
                              return;
                            }

                            if (event.key === "ArrowDown") {
                              if (disciplineSuggestions.length === 0) {
                                return;
                              }

                              event.preventDefault();
                              setDisciplineMenuOpen(true);
                              setHighlightedDisciplineIndex((current) =>
                                current < 0 ? 0 : Math.min(current + 1, disciplineSuggestions.length - 1),
                              );
                              return;
                            }

                            if (event.key === "ArrowUp") {
                              if (disciplineSuggestions.length === 0) {
                                return;
                              }

                              event.preventDefault();
                              setDisciplineMenuOpen(true);
                              setHighlightedDisciplineIndex((current) => (current <= 0 ? 0 : current - 1));
                              return;
                            }

                            if (event.key === "Enter" && disciplineSuggestions.length > 0) {
                              event.preventDefault();
                              handleDisciplineSelect(
                                highlightedDisciplineIndex >= 0
                                  ? disciplineSuggestions[highlightedDisciplineIndex]
                                  : disciplineSuggestions[0],
                              );
                            }
                          }}
                          placeholder="Np. EL lub konstrukcja"
                        />

                        {disciplineMenuOpen && disciplineSuggestions.length > 0 ? (
                          <div className="naming-autocomplete-menu">
                            {disciplineSuggestions.map((option, index) => (
                              <button
                                key={option.code}
                                type="button"
                                className={`naming-autocomplete-option ${
                                  index === highlightedDisciplineIndex ? "active" : ""
                                }`}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setHighlightedDisciplineIndex(index)}
                                onClick={() => handleDisciplineSelect(option)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="naming-inline-row">
                    <label className="naming-inline-label" htmlFor="naming-revision-input">4. Numer rewizji</label>
                    <div className="naming-inline-control">
                      <RevisionPresetInput
                        id="naming-revision-input"
                        inputRef={defaultRevisionInputRef}
                        value={defaultRevisionInput}
                        onCommit={handleDefaultRevisionCommit}
                        onInvalid={(message) => {
                          setMessage(message);
                          setMessageType("error");
                        }}
                        ariaLabel="Numer rewizji"
                        menuLabel="Pokaż opcje rewizji"
                        placeholder="Np. R21 lub W03"
                      />
                    </div>
                  </div>

                  <div className="naming-inline-row">
                    <label className="naming-inline-label" htmlFor="naming-status-input">5. Status plików</label>
                    <div className="naming-inline-control">
                      <select
                        id="naming-status-input"
                        className="naming-session-input naming-session-select"
                        value={defaultStatus}
                        onChange={(event) => setDefaultStatus(event.target.value)}
                      >
                        <option value="">Pozostaw status z nazwy pliku</option>
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="naming-folder-side">
                  <div className="naming-folder-side-card">
                    <span className="naming-folder-side-label">Folder roboczy</span>
                    <div className="naming-folder-side-row">
                      <span className={`naming-folder-indicator ${workingFolder ? "ready" : ""}`} aria-hidden="true">
                        {workingFolder ? "✓" : ""}
                      </span>
                      <button
                        type="button"
                        className="ghost-button naming-folder-side-button"
                        onClick={() => void handleChooseWorkingFolder()}
                        disabled={loadingWorkingFolder}
                        title={workingFolder || "Nie wybrano folderu roboczego"}
                      >
                        {loadingWorkingFolder ? "Wczytywanie..." : workingFolder ? "Zmień" : "Wybierz"}
                      </button>
                    </div>
                  </div>

                  <div className="naming-folder-side-card">
                    <span className="naming-folder-side-label">Folder docelowy</span>
                    <div className="naming-folder-side-row">
                      <span className={`naming-folder-indicator ${targetFolder ? "ready" : ""}`} aria-hidden="true">
                        {targetFolder ? "✓" : ""}
                      </span>
                      <button
                        type="button"
                        className="ghost-button naming-folder-side-button"
                        onClick={() => void handleChooseTargetFolder()}
                        disabled={loadingTargetFolder}
                        title={targetFolder || "Nie wybrano folderu docelowego"}
                      >
                        {loadingTargetFolder ? "Wczytywanie..." : targetFolder ? "Zmień" : "Wybierz"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      </div>

      {message ? <div className={`banner ${messageType === "error" ? "error" : messageType}`}>{message}</div> : null}

      <div className="naming-summary-grid">
        <article className="summary-card">
          <span>Pliki robocze</span>
          <strong>{workingStats.totalCount}</strong>
        </article>
        <article className="summary-card">
          <span>Obsługiwane</span>
          <strong>{rows.length}</strong>
        </article>
        <article className="summary-card invalid">
          <span>Pominięte</span>
          <strong>{workingStats.ignoredCount}</strong>
        </article>
        <article className="summary-card">
          <span>W folderze docelowym</span>
          <strong>{targetStats.totalCount}</strong>
        </article>
      </div>

      <div className="naming-card naming-table-card">
        <div className="panel-header naming-table-panel-header">
          <div className="naming-table-heading">
            <h2>Pliki do nazwania</h2>
            <div className="status-strip naming-table-status-strip">
              <span>{summary.total} plików w sesji</span>
              <span>{summary.readyCount} gotowych</span>
              <span>{summary.errorCount} z błędami</span>
            </div>
          </div>
          <div className="naming-table-header-center">
            {extensionFilterOptions.length > 0 ? (
              <div className="naming-extension-filter" aria-label="Filtruj po rozszerzeniu pliku">
                {extensionFilterOptions.map((group) => (
                  <button
                    key={group}
                    type="button"
                    className={`naming-extension-filter-button ${extensionFilter === group ? "active" : ""}`}
                    onClick={() => setExtensionFilter((current) => (current === group ? "" : group))}
                    aria-pressed={extensionFilter === group}
                    title={EXTENSION_FILTER_ICON_MAP[group].title}
                  >
                    <img
                      src={EXTENSION_FILTER_ICON_MAP[group].icon}
                      alt={EXTENSION_FILTER_ICON_MAP[group].label}
                      className="naming-extension-filter-icon"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="naming-table-header-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={openAssignDrawingNumbersDialog}
              disabled={rows.length === 0 || !resolvedSession}
            >
              Numerowanie arkuszy
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMoreActionsOpen(true)}
              disabled={rows.length === 0}
            >
              Więcej...
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state empty-state-compact">
            <h3>
              {ignoredRows.length > 0
                ? "Brak aktywnych plików do nazwania."
                : "Wybierz folder roboczy, aby rozpocząć nazewnictwo."}
            </h3>
          </div>
        ) : (
          <div className="table-wrap naming-table-wrap">
            <table className="naming-table">
              <thead>
                <tr>
                  <th className="column-index" aria-hidden="true"></th>
                  <th className="column-check">
                    <input
                      type="checkbox"
                      checked={allVisibleRowsSelected}
                      onChange={() => toggleVisibleRows(visibleRowIds)}
                      aria-label="Zaznacz wszystkie pliki"
                    />
                  </th>
                  <th className="column-file">
                    <div className="table-header-inline">
                      <span>Plik roboczy</span>
                      <button
                        type="button"
                        className="table-sort-icon-button"
                        onClick={sortRowsByFileName}
                        aria-label="Sortuj pliki robocze od A do Z"
                        title="Sortuj A-Z według nazwy pliku roboczego"
                      >
                        ↓
                      </button>
                    </div>
                  </th>
                  <th className="column-type">Typ</th>
                  {effectiveNamingStandardVersion === 4 ? <th className="column-building">Budynek</th> : null}
                  <th className="column-level">Poziom</th>
                  <th className="column-drawing">Numer arkusza</th>
                  <th className="column-revision">Rewizja</th>
                  <th className="column-status-code">Status</th>
                  <th className="column-generated">Proponowana nazwa</th>
                  <th className="column-validation">Walidacja</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvaluatedRows.map((evaluatedRow, rowIndex) => (
                  <tr
                    key={evaluatedRow.row.id}
                    className={`${evaluatedRow.validation.status === "error" ? "invalid-row" : ""} ${
                      dragOverRowId === evaluatedRow.row.id ? "drag-over-row" : ""
                    }`.trim()}
                    onPointerDown={() => handleSelectableRowPointerDown(evaluatedRow.row.id)}
                    onClick={(event) => handleSelectableRowClick(event, evaluatedRow.row.id)}
                  >
                    <td className="column-index">
                      <span className="row-index-label">{rowIndex + 1}</span>
                    </td>
                    <td className="column-check">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(evaluatedRow.row.id)}
                        onChange={() => toggleRowSelection(evaluatedRow.row.id)}
                        aria-label={`Zaznacz plik ${evaluatedRow.row.fileName}`}
                      />
                    </td>
                    <td
                      className="column-file"
                      draggable
                      onDragStart={(event) => {
                        rowPointerDownRef.current = null;
                        setDraggedRowId(evaluatedRow.row.id);
                        setDragOverRowId(evaluatedRow.row.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", evaluatedRow.row.id);
                      }}
                      onDragOver={(event) => {
                        if (!draggedRowId || draggedRowId === evaluatedRow.row.id) {
                          return;
                        }

                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverRowId(evaluatedRow.row.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceRowId = event.dataTransfer.getData("text/plain") || draggedRowId;
                        if (!sourceRowId) {
                          return;
                        }

                        moveRowToTarget(sourceRowId, evaluatedRow.row.id);
                        setDraggedRowId(null);
                        setDragOverRowId(null);
                      }}
                      onDragEnd={() => {
                        rowPointerDownRef.current = null;
                        setDraggedRowId(null);
                        setDragOverRowId(null);
                      }}
                    >
                      <div className="file-cell">
                        <div className="file-cell-copy">
                          <button
                            type="button"
                            className="file-name-button"
                            onClick={() => void window.fileFilterApi.openFolder(evaluatedRow.row.sourcePath.replace(/\\[^\\]+$/, ""))}
                            aria-label={`Otwórz folder dla pliku ${evaluatedRow.row.fileName}`}
                            data-tooltip="Kliknij aby otworzyć folder"
                          >
                            {evaluatedRow.row.fileName}
                          </button>
                        </div>
                        <div className="row-order-actions">
                          <button
                            type="button"
                            className="row-order-button"
                            onClick={() => moveRowByOffset(evaluatedRow.row.id, -1)}
                            disabled={rowIndex === 0}
                            aria-label={`Przesuń plik ${evaluatedRow.row.fileName} wyżej`}
                            title="Przesuń wyżej"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="row-order-button"
                            onClick={() => moveRowByOffset(evaluatedRow.row.id, 1)}
                            disabled={rowIndex === filteredEvaluatedRows.length - 1}
                            aria-label={`Przesuń plik ${evaluatedRow.row.fileName} niżej`}
                            title="Przesuń niżej"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="column-type">
                      <InlineCodeSelect
                        value={evaluatedRow.row.documentType}
                        options={DOCUMENT_TYPE_OPTIONS}
                        placeholder="Wybierz"
                        menuLabel={`Wybierz typ dokumentu dla pliku ${evaluatedRow.row.fileName}`}
                        onChange={(nextValue) => updateRow(evaluatedRow.row.id, { documentType: nextValue })}
                      />
                    </td>
                    {effectiveNamingStandardVersion === 4 ? (
                      <td className="column-building">
                        <InlineCodeSelect
                          value={evaluatedRow.row.buildingDesignation}
                          options={BUILDING_DESIGNATION_OPTIONS}
                          placeholder="A"
                          menuLabel={`Wybierz oznaczenie budynku dla pliku ${evaluatedRow.row.fileName}`}
                          onChange={(nextValue) =>
                            updateRow(evaluatedRow.row.id, { buildingDesignation: nextValue })
                          }
                        />
                      </td>
                    ) : null}
                    <td className="column-level">
                      <InlineCodeSelect
                        value={evaluatedRow.row.level}
                        options={LEVEL_OPTIONS}
                        placeholder="Wybierz"
                        menuLabel={`Wybierz poziom dla pliku ${evaluatedRow.row.fileName}`}
                        onChange={(nextValue) => updateRow(evaluatedRow.row.id, { level: nextValue })}
                      />
                    </td>
                    <td className="column-drawing">
                      <div className="drawing-number-cell">
                        <div className="drawing-number-input-wrap">
                          <input
                            value={evaluatedRow.row.drawingNumber}
                            disabled={evaluatedRow.row.drawingNumberLocked}
                            onChange={(event) =>
                              updateRow(evaluatedRow.row.id, {
                                drawingNumber: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3),
                                drawingNumberLocked: false,
                              })
                            }
                            placeholder="E04"
                          />
                          <button
                            type="button"
                            className={`drawing-lock-inline-button ${evaluatedRow.row.drawingNumberLocked ? "locked" : ""}`}
                            onClick={() => toggleDrawingNumberLock(evaluatedRow.row.id)}
                            disabled={!evaluatedRow.row.drawingNumber}
                            aria-label={
                              evaluatedRow.row.drawingNumberLocked
                                ? `Odblokuj numer arkusza dla pliku ${evaluatedRow.row.fileName}`
                                : `Zablokuj numer arkusza dla pliku ${evaluatedRow.row.fileName}`
                            }
                            title={evaluatedRow.row.drawingNumberLocked ? "Odblokuj numer arkusza" : "Zablokuj numer arkusza"}
                          >
                            &#128274;
                          </button>
                        </div>
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => assignNextDrawingNumber(evaluatedRow.row.id)}
                          disabled={!resolvedSession || evaluatedRow.row.drawingNumberLocked}
                        >
                          Nadaj
                        </button>
                      </div>
                    </td>
                    <td className="column-revision">
                      <RevisionInput
                        value={evaluatedRow.row.revision}
                        ariaLabel={`Wpisz rewizję dla pliku ${evaluatedRow.row.fileName}`}
                        placeholder="R00/W01"
                        onCommit={(nextValue) => {
                          if (messageType === "error" && isRevisionValidationMessage(message)) {
                            setMessage("");
                          }

                          updateRow(evaluatedRow.row.id, { revision: nextValue });
                        }}
                        onInvalid={(message) => {
                          setMessage(message);
                          setMessageType("error");
                        }}
                      />
                    </td>
                    <td className="column-status-code">
                      <InlineCodeSelect
                        value={evaluatedRow.row.status}
                        options={STATUS_OPTIONS}
                        placeholder="Wybierz"
                        menuLabel={`Wybierz status dla pliku ${evaluatedRow.row.fileName}`}
                        onChange={(nextValue) => updateRow(evaluatedRow.row.id, { status: nextValue })}
                      />
                    </td>
                    <td className="column-generated">
                      <button
                        type="button"
                        className={`generated-name-button ${evaluatedRow.targetFileName ? "" : "placeholder"}`}
                        onClick={() => openCustomNameDialog(evaluatedRow)}
                        title="Kliknij, aby wpisać własną nazwę"
                      >
                        <span className="generated-name">{evaluatedRow.targetFileName || "Uzupełnij dane pliku"}</span>
                      </button>
                    </td>
                    <td className="column-validation">
                      <div className="validation-cell">
                        {evaluatedRow.validation.status === "ok" || evaluatedRow.validation.status === "warning" ? (
                          <button
                            type="button"
                            className={`naming-validation-pill naming-validation-action ${
                              evaluatedRow.validation.status === "warning" ? "warning" : "valid"
                            }`}
                            onClick={() => void handleCopySingleRow(evaluatedRow)}
                            disabled={copyingRowIds.includes(evaluatedRow.row.id)}
                            title="Skopiuj plik do folderu docelowego"
                          >
                            {evaluatedRow.validation.status === "warning" ? (
                              <span
                                className="validation-warning-icon"
                                data-tooltip={evaluatedRow.validation.warningMessage}
                                aria-hidden="true"
                              >
                                !
                              </span>
                            ) : null}
                            {copyingRowIds.includes(evaluatedRow.row.id) ? "Kopiowanie..." : evaluatedRow.validation.message}
                          </button>
                        ) : (
                          <span
                            className={`naming-validation-pill ${evaluatedRow.validation.status === "error" ? "invalid" : "copied"}`}
                            title={evaluatedRow.validation.details.join("\n")}
                          >
                            {evaluatedRow.validation.message}
                          </span>
                        )}
                        <button
                          type="button"
                          className="row-remove-button"
                          onClick={() => removeRowFromView(evaluatedRow.row.id)}
                          aria-label={`Usuń plik ${evaluatedRow.row.fileName} z podglądu listy`}
                          title="Usuń z listy"
                        >
                          x
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ignoredRows.length > 0 ? (
        <div className="naming-card ignored-files-card">
          <div className="panel-header">
            <div>
              <h2>Ignorowane pliki</h2>
            </div>
            <div className="ignored-files-header-actions">
              <span className="ignored-files-count">
                {formatPolishCount(ignoredRows.length, "plik", "pliki", "plików")} poza sesją
              </span>
              <button
                type="button"
                className="filter-group-toggle"
                aria-label={isIgnoredSectionCollapsed ? "Rozwiń sekcję wyłączonych plików" : "Zwiń sekcję wyłączonych plików"}
                onClick={() => setIsIgnoredSectionCollapsed((current) => !current)}
              >
                <span className={`filter-group-toggle-icon ${isIgnoredSectionCollapsed ? "" : "expanded"}`}>&gt;</span>
              </button>
            </div>
          </div>

          {isIgnoredSectionCollapsed ? null : (
            <div className="ignored-files-list">
              {ignoredRows.map((row) => (
                <label key={row.id} className="ignored-file-row">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={(event) => {
                      if (event.target.checked) {
                        restoreIgnoredRow(row.id);
                      }
                    }}
                    aria-label={`Przywróć plik ${row.fileName} do nazewnictwa`}
                  />
                  <span className="ignored-file-name">{row.fileName}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="naming-card naming-copy-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Finalizacja</p>
            <h2>Podsumowanie i kopiowanie</h2>
          </div>
        </div>

        <div className="naming-copy-summary">
          <span>Gotowe do kopiowania: {summary.readyCount}</span>
          <span>Do poprawy: {summary.errorCount}</span>
          <span>Folder docelowy: {targetFolder || "nie wybrano"}</span>
        </div>

        <div className="naming-copy-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleCopyFiles()}
            disabled={!canCopyFiles || copyingFiles}
          >
            {copyingFiles ? "Kopiowanie..." : "Kopiuj do folderu docelowego"}
          </button>
        </div>
      </div>
    </section>
  );
}
