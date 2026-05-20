import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { externalNamingApi } from "./app/api";
import type {
  AppSession,
  CodeOption,
  FileNamingRow,
  ProjectDefaults,
  SessionProject,
} from "./app/types";
import {
  buildExportItems,
  buildRowsFromFiles,
  buildTargetFileName,
  createProjectFromProfile,
  formatFileSize,
  getBatchDuplicateMessages,
  getOptionLabel,
  getProjectTitle,
  getSelectedRows,
  mergeDefaults,
  normalizeRevision,
  validateRow,
} from "./domain/naming";
import dwgIconUrl from "../../file-filter-desktop/src/assets/extension-icons/dwg.svg";
import excelIconUrl from "../../file-filter-desktop/src/assets/extension-icons/excel.svg";
import pdfIconUrl from "../../file-filter-desktop/src/assets/extension-icons/pdf.svg";
import wordIconUrl from "../../file-filter-desktop/src/assets/extension-icons/word.svg";

const SESSION_VERSION = 1;
type ExtensionFilter = "pdf" | "dwg" | "word" | "excel" | "other";
type SourceSortDirection = "asc" | "desc" | null;

const EXTENSION_FILTERS: Array<{
  id: ExtensionFilter;
  label: string;
  extensions: string[];
  iconUrl?: string;
}> = [
  { id: "pdf", label: "PDF", extensions: [".pdf"], iconUrl: pdfIconUrl },
  { id: "dwg", label: "DWG", extensions: [".dwg"], iconUrl: dwgIconUrl },
  { id: "word", label: "Word", extensions: [".doc", ".docx"], iconUrl: wordIconUrl },
  { id: "excel", label: "Excel", extensions: [".xls", ".xlsx"], iconUrl: excelIconUrl },
  { id: "other", label: "Inne", extensions: [] },
];

const KNOWN_FILTER_EXTENSIONS = new Set(
  EXTENSION_FILTERS.flatMap((filter) => filter.extensions).map((extension) => extension.toLowerCase()),
);
const SHEET_NUMBER_DUPLICATE_MESSAGE =
  "Ten sam numer arkusza występuje już w tym projekcie dla tej fazy i branży";

function buildSession(projects: SessionProject[], activeProjectId: string, outputRoot: string): AppSession {
  return {
    version: SESSION_VERSION,
    activeProjectId,
    outputRoot,
    projects,
  };
}

function sanitizeLoadedSession(session: AppSession | null): AppSession | null {
  if (!session || session.version !== SESSION_VERSION || !Array.isArray(session.projects)) {
    return null;
  }

  return {
    version: SESSION_VERSION,
    activeProjectId: typeof session.activeProjectId === "string" ? session.activeProjectId : "",
    outputRoot: typeof session.outputRoot === "string" ? session.outputRoot : "",
    projects: session.projects
      .filter((project) => project?.profile?.projectNumber)
      .map((project) => ({
        ...project,
        rows: project.rows.map((row) => ({
          ...row,
          drawingNumberMode: row.drawingNumberMode ?? "auto",
        })),
      })),
  };
}

function rowMatchesExtensionFilter(row: FileNamingRow, activeFilter: ExtensionFilter | null) {
  if (!activeFilter) {
    return true;
  }

  const extension = row.extension.toLowerCase();
  if (activeFilter === "other") {
    return !KNOWN_FILTER_EXTENSIONS.has(extension);
  }

  return EXTENSION_FILTERS.find((filter) => filter.id === activeFilter)?.extensions.includes(extension) ?? true;
}

function getOrderedRows(
  rows: FileNamingRow[],
  activeFilter: ExtensionFilter | null,
  sourceSortDirection: SourceSortDirection,
) {
  const filteredRows = rows.filter((row) => rowMatchesExtensionFilter(row, activeFilter));
  if (!sourceSortDirection) {
    return filteredRows;
  }

  return [...filteredRows].sort((left, right) => {
    const comparison = left.fileName.localeCompare(right.fileName, "pl", {
      numeric: true,
      sensitivity: "base",
    });
    return sourceSortDirection === "asc" ? comparison : -comparison;
  });
}

function getDrawingLetter(drawingNumber: string) {
  return /^[A-Z]/.test(drawingNumber) ? drawingNumber[0] : "";
}

function getDrawingDigits(drawingNumber: string) {
  const match = /^[A-Z]?(\d{0,2})/.exec(drawingNumber);
  return match?.[1] ?? "";
}

function combineDrawingNumber(letter: string, digits: string) {
  return `${letter.slice(0, 1).toUpperCase()}${digits.replace(/\D/g, "").slice(0, 2)}`;
}

function normalizeDrawingNumberInput(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const letter = cleaned.match(/[A-Z]/)?.[0] ?? "";
  const digits = cleaned.replace(/\D/g, "").slice(0, 2);
  return combineDrawingNumber(letter, digits);
}

function replaceDrawingLetter(drawingNumber: string, letter: string) {
  const digits = getDrawingDigits(drawingNumber);
  return combineDrawingNumber(letter, digits);
}

function getDuplicateRowIds(project: SessionProject, rows: FileNamingRow[], selectedIds: Set<string>) {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    if (!selectedIds.has(row.id)) {
      continue;
    }

    const targetFileName = buildTargetFileName(row, project.profile);
    if (!targetFileName) {
      continue;
    }

    const key = [project.profile.projectNumber, row.bucket, targetFileName.toLocaleLowerCase("pl")].join("|");
    const existingRowId = seen.get(key);
    if (existingRowId) {
      duplicates.add(existingRowId);
      duplicates.add(row.id);
    } else {
      seen.set(key, row.id);
    }
  }

  return duplicates;
}

function getSheetNumberDuplicateRowIds(project: SessionProject, rows: FileNamingRow[], selectedIds: Set<string>) {
  const groups = new Map<string, FileNamingRow[]>();

  for (const row of rows) {
    if (!selectedIds.has(row.id) || !row.phase || !row.discipline || !/^[A-Z]\d{2}$/.test(row.drawingNumber)) {
      continue;
    }

    const key = [project.profile.projectNumber, row.phase, row.discipline, row.drawingNumber].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const duplicates = new Set<string>();
  for (const rowsInGroup of groups.values()) {
    if (rowsInGroup.length < 2) {
      continue;
    }

    const buckets = new Set(rowsInGroup.map((row) => row.bucket));
    const isAllowedPdfEdtPair = rowsInGroup.length === 2 && buckets.has("PDF") && buckets.has("EDT");
    if (!isAllowedPdfEdtPair) {
      rowsInGroup.forEach((row) => duplicates.add(row.id));
    }
  }

  return duplicates;
}

function getSheetNumberDuplicateMessages(projects: SessionProject[], activeRowIdsByProject: Record<string, string[]>) {
  return projects.flatMap((project) => {
    const activeRows = project.rows.filter((row) => activeRowIdsByProject[project.id]?.includes(row.id) ?? true);
    const duplicateIds = getSheetNumberDuplicateRowIds(project, activeRows, new Set(project.selectedFileIds));
    return duplicateIds.size > 0 ? [`${project.profile.projectNumber}: ${SHEET_NUMBER_DUPLICATE_MESSAGE}`] : [];
  });
}

function CodeSelect({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: CodeOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Wybierz</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {getOptionLabel(options, option.code)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        onBlur={onBlur}
      />
    </label>
  );
}

export function App() {
  const [projects, setProjects] = useState<SessionProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [outputRoot, setOutputRoot] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | "muted">("muted");
  const [loading, setLoading] = useState(false);
  const [activeRowIdsByProject, setActiveRowIdsByProject] = useState<Record<string, string[]>>({});
  const sessionRef = useRef<AppSession>(buildSession([], "", ""));

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;
  const selectedRows = useMemo(() => getSelectedRows(projects, activeRowIdsByProject), [activeRowIdsByProject, projects]);
  const selectedValidRows = selectedRows.filter((item) => !item.validationMessage);
  const duplicateMessages = useMemo(
    () => getBatchDuplicateMessages(projects, activeRowIdsByProject),
    [activeRowIdsByProject, projects],
  );
  const sheetNumberDuplicateMessages = useMemo(
    () => getSheetNumberDuplicateMessages(projects, activeRowIdsByProject),
    [activeRowIdsByProject, projects],
  );
  const selectedCount = selectedRows.length;

  useEffect(() => {
    sessionRef.current = buildSession(projects, activeProjectId, outputRoot);
  }, [activeProjectId, outputRoot, projects]);

  useEffect(() => {
    let cancelled = false;

    void externalNamingApi.loadSession().then((loadedSession) => {
      if (cancelled) {
        return;
      }

      const session = sanitizeLoadedSession(loadedSession);
      if (!session || session.projects.length === 0) {
        return;
      }

      const shouldRestore = window.confirm("Znaleziono zapisaną sesję. Przywrócić projekty i foldery robocze?");
      if (!shouldRestore) {
        void externalNamingApi.clearSession();
        return;
      }

      setProjects(session.projects);
      setActiveProjectId(session.activeProjectId || session.projects[0]?.id || "");
      setOutputRoot(session.outputRoot);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return externalNamingApi.onSaveSessionBeforeClose(async () => externalNamingApi.saveSession(sessionRef.current));
  }, []);

  function showMessage(nextMessage: string, tone: "error" | "success" | "muted" = "muted") {
    setMessage(nextMessage);
    setMessageTone(tone);
  }

  function updateProject(projectId: string, updater: (project: SessionProject) => SessionProject) {
    setProjects((current) =>
      current.map((project) => (project.id === projectId ? updater(project) : project)),
    );
  }

  async function importProfile() {
    setLoading(true);
    try {
      const profile = await externalNamingApi.importProjectProfile();
      if (!profile) {
        return;
      }

      setProjects((current) => {
        const existing = current.find((project) => project.profile.projectNumber === profile.projectNumber);
        if (!existing) {
          const nextProject = createProjectFromProfile(profile);
          setActiveProjectId(nextProject.id);
          showMessage(`Dodano profil projektu ${getProjectTitle(profile)}.`, "success");
          return [...current, nextProject];
        }

        const defaults = mergeDefaults(profile, existing.defaults);
        const rows = existing.rows.map((row) => ({
          ...row,
          building: profile.namingStandardVersion === 4 ? row.building || defaults.building || "A" : "",
        }));

        setActiveProjectId(existing.id);
        showMessage(`Zaktualizowano profil projektu ${getProjectTitle(profile)}.`, "success");
        return current.map((project) =>
          project.id === existing.id
            ? {
                ...project,
                profile,
                defaults,
                rows,
              }
            : project,
        );
      });
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Nie udało się zaimportować profilu.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function chooseWorkingFolder(project: SessionProject) {
    const folderPath = await externalNamingApi.chooseDirectory("Wybierz folder roboczy projektu");
    if (!folderPath) {
      return;
    }

    await refreshProjectFiles(project.id, folderPath);
  }

  async function refreshProjectFiles(projectId: string, folderPath?: string) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }

    const targetFolder = folderPath ?? project.workingFolder;
    if (!targetFolder) {
      showMessage("Najpierw wybierz folder roboczy projektu.", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await externalNamingApi.listWorkspaceFiles(targetFolder);
      const previousRowIds = new Set(project.rows.map((row) => row.id));
      const previousSelectedIds = new Set(project.selectedFileIds);
      const rows = buildRowsFromFiles(result.files, project.rows, project.defaults, project.profile);
      const availableIds = new Set(rows.map((row) => row.id));
      const nextSelectedIds = rows
        .filter((row) => previousSelectedIds.has(row.id) || !previousRowIds.has(row.id))
        .map((row) => row.id)
        .filter((rowId) => availableIds.has(rowId));

      updateProject(projectId, (current) => ({
        ...current,
        workingFolder: targetFolder,
        files: result.files,
        rows,
        selectedFileIds: project.rows.length === 0 ? rows.map((row) => row.id) : nextSelectedIds,
        skippedOversized: result.skippedOversized,
        skippedUnreadable: result.skippedUnreadable,
        lastRefreshedAt: new Date().toISOString(),
      }));

      showMessage(`Wczytano ${rows.length} plików z folderu roboczego.`, "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Nie udało się odświeżyć folderu.", "error");
    } finally {
      setLoading(false);
    }
  }

  function updateDefaults(project: SessionProject, patch: Partial<ProjectDefaults>) {
    const nextDefaults = { ...project.defaults, ...patch };
    const disciplinePrefix = patch.discipline?.trim().toUpperCase()[0] ?? "";
    updateProject(project.id, (current) => ({
      ...current,
      defaults: nextDefaults,
      rows: disciplinePrefix
        ? current.rows.map((row) => ({
            ...row,
            discipline: patch.discipline ?? row.discipline,
            drawingNumber: replaceDrawingLetter(row.drawingNumber, disciplinePrefix),
            drawingNumberMode: "manual" as const,
          }))
        : current.rows,
    }));
  }

  function applyDefaults(project: SessionProject, selectedOnly: boolean) {
    const selectedIds = new Set(project.selectedFileIds);
    const orderedActiveRowIds = activeRowIdsByProject[project.id] ?? project.rows.map((row) => row.id);
    const activeIds = new Set(orderedActiveRowIds);
    updateProject(project.id, (current) => {
      const rowsWithDefaults = current.rows.map((row) => {
        if (!activeIds.has(row.id) || (selectedOnly && !selectedIds.has(row.id))) {
          return row;
        }

        return {
          ...row,
          phase: current.defaults.phase,
          discipline: current.defaults.discipline,
          documentType: current.defaults.documentType,
          building: current.profile.namingStandardVersion === 4 ? current.defaults.building || "A" : "",
          level: current.defaults.level,
          revision: current.defaults.revision,
          status: current.defaults.status,
        };
      });

      return {
        ...current,
        rows: rowsWithDefaults,
      };
    });
  }

  function updateRow(project: SessionProject, rowId: string, patch: Partial<FileNamingRow>) {
    updateProject(project.id, (current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  }

  function setProjectActiveRows(projectId: string, rowIds: string[]) {
    setActiveRowIdsByProject((current) => {
      const previous = current[projectId] ?? [];
      if (previous.length === rowIds.length && previous.every((rowId, index) => rowId === rowIds[index])) {
        return current;
      }

      return {
        ...current,
        [projectId]: rowIds,
      };
    });
  }

  function setProjectSelection(project: SessionProject, selectedFileIds: string[]) {
    updateProject(project.id, (current) => ({
      ...current,
      selectedFileIds,
    }));
  }

  function updateDrawingNumber(project: SessionProject, rowId: string, drawingNumber: string) {
    updateProject(project.id, (current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId ? { ...row, drawingNumber, drawingNumberMode: "manual" as const } : row,
      ),
    }));
  }

  function renumberProjectRows(project: SessionProject, rowNumbers: Record<string, string>) {
    updateProject(project.id, (current) => ({
      ...current,
      rows: current.rows.map((row) =>
        rowNumbers[row.id] ? { ...row, drawingNumber: rowNumbers[row.id], drawingNumberMode: "manual" as const } : row,
      ),
    }));
  }

  async function chooseOutputRoot() {
    const folderPath = await externalNamingApi.chooseDirectory("Wybierz folder wynikowy");
    if (folderPath) {
      setOutputRoot(folderPath);
    }
  }

  async function exportSelectedFiles() {
    if (selectedCount === 0) {
      showMessage("Zaznacz pliki do eksportu.", "error");
      return;
    }

    const invalidRows = selectedRows.filter((item) => item.validationMessage);
    if (invalidRows.length > 0) {
      showMessage(`Nie można eksportować. Popraw ${invalidRows.length} zaznaczonych plików.`, "error");
      return;
    }

    if (duplicateMessages.length > 0) {
      showMessage(`Nie można eksportować. Zduplikowane nazwy: ${duplicateMessages.slice(0, 3).join("; ")}`, "error");
      return;
    }

    if (sheetNumberDuplicateMessages.length > 0) {
      showMessage(`Nie można eksportować. ${SHEET_NUMBER_DUPLICATE_MESSAGE}.`, "error");
      return;
    }

    let targetRoot = outputRoot;
    if (!targetRoot) {
      const selectedFolder = await externalNamingApi.chooseDirectory("Wybierz folder wynikowy");
      if (!selectedFolder) {
        return;
      }

      targetRoot = selectedFolder;
      setOutputRoot(selectedFolder);
    }

    const exportItems = buildExportItems(projects, activeRowIdsByProject);
    setLoading(true);

    try {
      const existingTargets = await externalNamingApi.checkExportTargets(targetRoot, exportItems);
      const overwriteExisting =
        existingTargets.length > 0
          ? window.confirm(
              `W folderze wynikowym istnieje już ${existingTargets.length} plików, które zostaną nadpisane. Kontynuować?`,
            )
          : false;

      if (existingTargets.length > 0 && !overwriteExisting) {
        showMessage("Eksport przerwany. Istniejące pliki nie zostały nadpisane.", "muted");
        return;
      }

      const result = await externalNamingApi.exportFiles(targetRoot, exportItems, overwriteExisting);
      showMessage(`Skopiowano ${result.copiedCount} plików do folderu wynikowego.`, "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Nie udało się wyeksportować plików.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveSessionNow() {
    await externalNamingApi.saveSession(buildSession(projects, activeProjectId, outputRoot));
    showMessage("Sesja została zapisana.", "success");
  }

  async function clearSessionNow() {
    if (!window.confirm("Wyczyścić zapisaną sesję i bieżące projekty?")) {
      return;
    }

    await externalNamingApi.clearSession();
    setProjects([]);
    setActiveProjectId("");
    setOutputRoot("");
    showMessage("Sesja została wyczyszczona.", "muted");
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Plikonazywacz</h1>
        </div>
        <div className="top-actions">
          <button type="button" className="secondary-button" onClick={importProfile} disabled={loading}>
            Importuj profil JSON
          </button>
          <button type="button" className="secondary-button" onClick={chooseOutputRoot}>
            Folder wynikowy
          </button>
          <button type="button" className="secondary-button" onClick={saveSessionNow} disabled={projects.length === 0}>
            Zapisz sesję
          </button>
          <button type="button" className="ghost-button" onClick={clearSessionNow}>
            Wyczyść
          </button>
        </div>
      </header>

      {message ? <div className={`banner ${messageTone}`}>{message}</div> : null}

      <main className="workspace">
        <aside className="project-sidebar">
          <div className="sidebar-header">
            <span>Projekty</span>
            <strong>{projects.length}</strong>
          </div>
          {projects.length === 0 ? (
            <div className="empty-box">Zaimportuj profil projektu JSON, żeby rozpocząć.</div>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`project-tab ${project.id === activeProject?.id ? "active" : ""}`}
                  onClick={() => setActiveProjectId(project.id)}
                >
                  <strong>{project.profile.projectNumber}</strong>
                  <span>{project.profile.projectName}</span>
                  <small>v{project.profile.namingStandardVersion}</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="main-panel">
          {!activeProject ? (
            <div className="empty-state">
              <h2>Brak projektu</h2>
              <p>Zaimportuj profil JSON otrzymany od Ekoinbud.</p>
            </div>
          ) : (
            <ProjectWorkspace
              duplicateMessages={duplicateMessages}
              loading={loading}
              outputRoot={outputRoot}
              project={activeProject}
              sheetNumberDuplicateMessages={sheetNumberDuplicateMessages}
              selectedValidCount={selectedValidRows.length}
              totalSelectedCount={selectedCount}
              onApplyDefaults={applyDefaults}
              onChooseWorkingFolder={chooseWorkingFolder}
              onExport={exportSelectedFiles}
              onRefresh={refreshProjectFiles}
              onRowChange={updateRow}
              onActiveRowsChange={setProjectActiveRows}
              onDrawingNumberChange={updateDrawingNumber}
              onRenumberRows={renumberProjectRows}
              onSelectionChange={setProjectSelection}
              onDefaultsChange={updateDefaults}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function ProjectWorkspace({
  duplicateMessages,
  loading,
  outputRoot,
  project,
  sheetNumberDuplicateMessages,
  selectedValidCount,
  totalSelectedCount,
  onApplyDefaults,
  onChooseWorkingFolder,
  onDefaultsChange,
  onExport,
  onRefresh,
  onActiveRowsChange,
  onDrawingNumberChange,
  onRenumberRows,
  onRowChange,
  onSelectionChange,
}: {
  duplicateMessages: string[];
  loading: boolean;
  outputRoot: string;
  project: SessionProject;
  sheetNumberDuplicateMessages: string[];
  selectedValidCount: number;
  totalSelectedCount: number;
  onApplyDefaults: (project: SessionProject, selectedOnly: boolean) => void;
  onChooseWorkingFolder: (project: SessionProject) => void;
  onDefaultsChange: (project: SessionProject, patch: Partial<ProjectDefaults>) => void;
  onExport: () => void;
  onRefresh: (projectId: string) => void;
  onActiveRowsChange: (projectId: string, rowIds: string[]) => void;
  onDrawingNumberChange: (project: SessionProject, rowId: string, drawingNumber: string) => void;
  onRenumberRows: (project: SessionProject, rowNumbers: Record<string, string>) => void;
  onRowChange: (project: SessionProject, rowId: string, patch: Partial<FileNamingRow>) => void;
  onSelectionChange: (project: SessionProject, selectedFileIds: string[]) => void;
}) {
  const profile = project.profile;
  const [activeFilter, setActiveFilter] = useState<ExtensionFilter | null>(null);
  const [sourceSortDirection, setSourceSortDirection] = useState<SourceSortDirection>(null);
  const [lastClickedRowId, setLastClickedRowId] = useState<string | null>(null);
  const defaultRenumberStart = `${project.defaults.discipline.trim().toUpperCase()[0] ?? "X"}01`;
  const [renumberMenuOpen, setRenumberMenuOpen] = useState(false);
  const [renumberDraft, setRenumberDraft] = useState(defaultRenumberStart);
  const selectedIds = new Set(project.selectedFileIds);
  const orderedRows = useMemo(
    () => getOrderedRows(project.rows, activeFilter, sourceSortDirection),
    [activeFilter, project.rows, sourceSortDirection],
  );
  const orderedActiveRowIds = useMemo(() => orderedRows.map((row) => row.id), [orderedRows]);
  const activeSelectedRows = orderedRows.filter((row) => selectedIds.has(row.id));
  const duplicateRowIds = useMemo(() => getDuplicateRowIds(project, orderedRows, selectedIds), [orderedRows, project, selectedIds]);
  const sheetNumberDuplicateRowIds = useMemo(
    () => getSheetNumberDuplicateRowIds(project, orderedRows, selectedIds),
    [orderedRows, project, selectedIds],
  );
  const projectInvalidSelectedCount = orderedRows.filter(
    (row) => selectedIds.has(row.id) && validateRow(row, profile),
  ).length;

  useEffect(() => {
    onActiveRowsChange(project.id, orderedActiveRowIds);
  }, [onActiveRowsChange, orderedActiveRowIds, project.id]);

  useEffect(() => {
    setRenumberDraft(defaultRenumberStart);
  }, [defaultRenumberStart, project.id]);

  function commitSelection(selectedFileIds: string[]) {
    onSelectionChange(project, selectedFileIds);
  }

  function toggleFilter(filter: ExtensionFilter) {
    const nextFilter = activeFilter === filter ? null : filter;
    const nextOrderedActiveRowIds = getOrderedRows(project.rows, nextFilter, sourceSortDirection).map((row) => row.id);
    setActiveFilter(nextFilter);
    setLastClickedRowId(null);
    onActiveRowsChange(project.id, nextOrderedActiveRowIds);
  }

  function toggleSourceSort() {
    const nextSortDirection = sourceSortDirection === "asc" ? "desc" : "asc";
    const nextOrderedActiveRowIds = getOrderedRows(project.rows, activeFilter, nextSortDirection).map((row) => row.id);
    setSourceSortDirection(nextSortDirection);
    setLastClickedRowId(null);
    onActiveRowsChange(project.id, nextOrderedActiveRowIds);
  }

  function handleRowSelection(rowId: string, event: MouseEvent) {
    const visibleIds = orderedActiveRowIds;
    const nextSelected = new Set(project.selectedFileIds);

    if (event.shiftKey && lastClickedRowId && visibleIds.includes(lastClickedRowId)) {
      const start = visibleIds.indexOf(lastClickedRowId);
      const end = visibleIds.indexOf(rowId);
      for (const selectedRowId of visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1)) {
        nextSelected.add(selectedRowId);
      }
    } else {
      if (nextSelected.has(rowId)) {
        nextSelected.delete(rowId);
      } else {
        nextSelected.add(rowId);
      }
    }

    setLastClickedRowId(rowId);
    commitSelection(Array.from(nextSelected));
  }

  function selectVisibleRows(selected: boolean) {
    const nextSelected = new Set(project.selectedFileIds);
    for (const rowId of orderedActiveRowIds) {
      if (selected) {
        nextSelected.add(rowId);
      } else {
        nextSelected.delete(rowId);
      }
    }

    commitSelection(Array.from(nextSelected));
  }

  function renumberSelectedRows() {
    if (activeSelectedRows.length === 0) {
      return;
    }

    const startValue = normalizeDrawingNumberInput(renumberDraft);
    if (!/^[A-Z]\d{2}$/.test(startValue)) {
      window.alert("Numer startowy musi mieć format litera + dwie cyfry, np. E01.");
      return;
    }

    const prefix = startValue[0];
    const startNumber = Number(startValue.slice(1));
    if (startNumber + activeSelectedRows.length - 1 > 99) {
      window.alert("Zakres numeracji przekracza 99.");
      return;
    }

    const nextNumbers: Record<string, string> = {};
    activeSelectedRows.forEach((row, index) => {
      nextNumbers[row.id] = `${prefix}${String(startNumber + index).padStart(2, "0")}`;
    });

    onRenumberRows(project, nextNumbers);
    setRenumberMenuOpen(false);
  }

  return (
    <>
      <div className="project-header">
        <div>
          <p className="eyebrow">Projekt {profile.namingStandardVersion === 4 ? "v4" : "v3"}</p>
          <h2>{getProjectTitle(profile)}</h2>
        </div>
        <div className="project-summary">
          <span>{project.rows.length} plików</span>
          <span>{activeSelectedRows.length} zaznaczonych w widoku</span>
          <span>{selectedValidCount}/{totalSelectedCount} gotowych</span>
        </div>
      </div>

      <section className="section-grid">
        <div className="panel">
          <div className="panel-title">
            <span>1. Folder roboczy</span>
          </div>
          <div className="folder-row">
            <div className="folder-path">{project.workingFolder || "Nie wybrano folderu roboczego"}</div>
            <button type="button" className="secondary-button" onClick={() => onChooseWorkingFolder(project)}>
              Wybierz folder
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onRefresh(project.id)}
              disabled={!project.workingFolder || loading}
            >
              Odśwież
            </button>
          </div>
          {project.skippedOversized || project.skippedUnreadable ? (
            <p className="hint">
              Pominięto {project.skippedOversized} plików większych niż 200 MB i {project.skippedUnreadable} pozycji
              niedostępnych.
            </p>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-title">
            <span>2. Dane wspólne</span>
          </div>
          <div className="fields-grid">
            <CodeSelect
              label="Faza"
              value={project.defaults.phase}
              options={profile.allowedValues.phases}
              onChange={(phase) => onDefaultsChange(project, { phase })}
            />
            <CodeSelect
              label="Branża"
              value={project.defaults.discipline}
              options={profile.allowedValues.disciplines}
              onChange={(discipline) => onDefaultsChange(project, { discipline })}
            />
            <CodeSelect
              label="Typ dokumentu"
              value={project.defaults.documentType}
              options={profile.allowedValues.documentTypes}
              onChange={(documentType) => onDefaultsChange(project, { documentType })}
            />
            {profile.namingStandardVersion === 4 ? (
              <CodeSelect
                label="Budynek"
                value={project.defaults.building}
                options={profile.allowedValues.buildings}
                onChange={(building) => onDefaultsChange(project, { building })}
              />
            ) : null}
            <CodeSelect
              label="Poziom"
              value={project.defaults.level}
              options={profile.allowedValues.levels}
              onChange={(level) => onDefaultsChange(project, { level })}
            />
            <TextField
              label="Rewizja"
              value={project.defaults.revision}
              placeholder="R00"
              onChange={(revision) => onDefaultsChange(project, { revision })}
              onBlur={() => onDefaultsChange(project, { revision: normalizeRevision(project.defaults.revision) })}
            />
            <CodeSelect
              label="Status"
              value={project.defaults.status}
              options={profile.allowedValues.statuses}
              onChange={(status) => onDefaultsChange(project, { status })}
            />
          </div>
          <div className="panel-actions">
            <button type="button" className="secondary-button" onClick={() => onApplyDefaults(project, true)}>
              Zastosuj do zaznaczonych
            </button>
            <button type="button" className="ghost-button" onClick={() => onApplyDefaults(project, false)}>
              Zastosuj do wszystkich
            </button>
          </div>
        </div>
      </section>

      <section className="panel files-panel">
        <div className="panel-title">
          <span>3. Pliki do eksportu</span>
          <div className="panel-actions">
            <button type="button" className="ghost-button" onClick={() => selectVisibleRows(true)}>
              Zaznacz wszystkie
            </button>
            <button type="button" className="ghost-button" onClick={() => selectVisibleRows(false)}>
              Odznacz wszystkie
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onExport}
              disabled={
                loading ||
                totalSelectedCount === 0 ||
                projectInvalidSelectedCount > 0 ||
                duplicateMessages.length > 0 ||
                sheetNumberDuplicateMessages.length > 0
              }
            >
              Eksportuj zaznaczone
            </button>
          </div>
        </div>

        <div className="export-note">
          <span>
            Folder wynikowy: {outputRoot || "zostanie wybrany przy eksporcie"} · Widoczne: {orderedRows.length}
          </span>
          <span>PDF trafi do `3. PDF`, pozostałe pliki do `2. EDT`.</span>
        </div>

        <div className="extension-filter-bar" aria-label="Filtr rozszerzeń plików">
          {EXTENSION_FILTERS.map((filter) => {
            const count = project.rows.filter((row) => rowMatchesExtensionFilter(row, filter.id)).length;
            const isActive = activeFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                className={`extension-filter ${isActive ? "active" : ""}`}
                onClick={() => toggleFilter(filter.id)}
                title={`Pokaż ${filter.label}`}
                aria-pressed={isActive}
              >
                {filter.iconUrl ? <img src={filter.iconUrl} alt="" /> : <span className="extension-filter-other">?</span>}
                <span>{filter.label}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </div>

        {project.rows.length === 0 ? (
          <div className="empty-state compact">
            <h3>Brak plików</h3>
            <p>Wybierz folder roboczy, aby wczytać pliki projektu.</p>
          </div>
        ) : orderedRows.length === 0 ? (
          <div className="empty-state compact">
            <h3>Brak plików w filtrze</h3>
            <p>Wyłącz filtr albo wybierz inne rozszerzenie.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="files-table">
              <thead>
                <tr>
                  <th>Eksport</th>
                  <th>
                    <button type="button" className="sort-header" onClick={toggleSourceSort}>
                      Plik źródłowy
                      <span>{sourceSortDirection === "asc" ? "▲" : sourceSortDirection === "desc" ? "▼" : ""}</span>
                    </button>
                  </th>
                  <th>Folder</th>
                  <th>Typ</th>
                  {profile.namingStandardVersion === 4 ? <th>Budynek</th> : null}
                  <th>Poziom</th>
                  <th className="number-header-cell">
                    <button
                      type="button"
                      className="renumber-header-button"
                      onClick={() => setRenumberMenuOpen((current) => !current)}
                      disabled={activeSelectedRows.length === 0}
                      title="Ponumeruj zaznaczone"
                    >
                      Numer
                    </button>
                    {renumberMenuOpen ? (
                      <div className="renumber-popover">
                        <label>
                          <span>Numeruj od</span>
                          <input
                            value={renumberDraft}
                            maxLength={3}
                            onChange={(event) => setRenumberDraft(normalizeDrawingNumberInput(event.target.value))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                renumberSelectedRows();
                              }
                              if (event.key === "Escape") {
                                setRenumberMenuOpen(false);
                              }
                            }}
                          />
                        </label>
                        <button type="button" className="secondary-button" onClick={renumberSelectedRows}>
                          Ponumeruj
                        </button>
                      </div>
                    ) : null}
                  </th>
                  <th>Rewizja</th>
                  <th>Status</th>
                  <th>Nazwa wynikowa</th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((row) => {
                  const targetName = buildTargetFileName(row, profile);
                  const validation = validateRow(row, profile);
                  const hasNumberError = validation.toLowerCase().includes("numer");
                  const selected = selectedIds.has(row.id);
                  const sheetDuplicateMessage = sheetNumberDuplicateRowIds.has(row.id)
                    ? SHEET_NUMBER_DUPLICATE_MESSAGE
                    : "";
                  const duplicateMessage = duplicateRowIds.has(row.id) ? "Zduplikowana nazwa wynikowa blokuje eksport." : "";
                  const blockingMessage = selected ? validation || sheetDuplicateMessage || duplicateMessage : "";

                  return (
                    <tr
                      key={row.id}
                      className={`${selected ? "selected-row" : "muted-row"} ${blockingMessage ? "blocking-row" : ""}`}
                      title={blockingMessage || undefined}
                      onClick={(event) => handleRowSelection(row.id, event)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRowSelection(row.id, event);
                          }}
                          aria-label={`Eksportuj ${row.fileName}`}
                        />
                      </td>
                      <td>
                        <div className="source-file" title={blockingMessage || undefined}>
                          <strong>{row.fileName}</strong>
                          <span>{row.relativePath}</span>
                          <small>{formatFileSize(row.sizeBytes)}</small>
                        </div>
                      </td>
                      <td>
                        <span className={`bucket-pill ${row.bucket.toLowerCase()}`}>{row.bucket === "PDF" ? "3. PDF" : "2. EDT"}</span>
                      </td>
                      <td>
                        <select
                          value={row.documentType}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => onRowChange(project, row.id, { documentType: event.target.value })}
                        >
                          <option value="">Wybierz</option>
                          {profile.allowedValues.documentTypes.map((option) => (
                            <option key={option.code} value={option.code}>
                              {getOptionLabel(profile.allowedValues.documentTypes, option.code)}
                            </option>
                          ))}
                        </select>
                      </td>
                      {profile.namingStandardVersion === 4 ? (
                        <td>
                          <select
                            value={row.building}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => onRowChange(project, row.id, { building: event.target.value })}
                          >
                            <option value="">Wybierz</option>
                            {profile.allowedValues.buildings.map((option) => (
                              <option key={option.code} value={option.code}>
                                {getOptionLabel(profile.allowedValues.buildings, option.code)}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      <td>
                        <select
                          value={row.level}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => onRowChange(project, row.id, { level: event.target.value })}
                        >
                          <option value="">Wybierz</option>
                          {profile.allowedValues.levels.map((option) => (
                            <option key={option.code} value={option.code}>
                              {getOptionLabel(profile.allowedValues.levels, option.code)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="drawing-number-fields" onClick={(event) => event.stopPropagation()}>
                          <input
                            className={`letter-input ${hasNumberError ? "invalid-field" : ""}`}
                            value={getDrawingLetter(row.drawingNumber)}
                            maxLength={1}
                            aria-label={`Litera branży dla ${row.fileName}`}
                            onChange={(event) =>
                              onDrawingNumberChange(
                                project,
                                row.id,
                                combineDrawingNumber(event.target.value.toUpperCase(), getDrawingDigits(row.drawingNumber)),
                              )
                            }
                          />
                          <input
                            className={`digits-input ${hasNumberError ? "invalid-field" : ""}`}
                            value={getDrawingDigits(row.drawingNumber)}
                            inputMode="numeric"
                            maxLength={2}
                            aria-label={`Numer rysunku dla ${row.fileName}`}
                            onChange={(event) =>
                              onDrawingNumberChange(
                                project,
                                row.id,
                                combineDrawingNumber(getDrawingLetter(row.drawingNumber), event.target.value),
                              )
                            }
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          className="short-input"
                          value={row.revision}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => onRowChange(project, row.id, { revision: event.target.value.toUpperCase() })}
                          onBlur={() => onRowChange(project, row.id, { revision: normalizeRevision(row.revision) })}
                        />
                      </td>
                      <td>
                        <select
                          value={row.status}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => onRowChange(project, row.id, { status: event.target.value })}
                        >
                          <option value="">Wybierz</option>
                          {profile.allowedValues.statuses.map((option) => (
                            <option key={option.code} value={option.code}>
                              {getOptionLabel(profile.allowedValues.statuses, option.code)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className={`target-name ${validation ? "invalid" : ""}`} title={blockingMessage || undefined}>
                          <strong>{targetName || "Niekompletne dane"}</strong>
                          {validation ? <span>{validation}</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
