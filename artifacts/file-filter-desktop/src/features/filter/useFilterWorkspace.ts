import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fileFilterApi } from "../../app/api";
import { useNamingStandardVersion } from "../../app/standard-config";
import { useTransientBanner } from "../../app/useTransientBanner";
import type {
  DateFilterKey,
  DateFilterValue,
  DecodeSourceFile,
  FilterColumnKey,
  NamingStandardVersion,
  NoticeTone,
  ScanResult,
  SortConfig,
  SortKey,
} from "../../app/types";
import {
  INITIAL_EXPANDED_GROUPS,
  INITIAL_FILTERS,
  MAX_FAVORITE_PROJECTS,
  buildDisciplineFolderTooltip,
  filterFilesBySearch,
  getActiveFilterCount,
  getFilterOptions,
  getFilteredFiles,
  getFilteredProjects,
  getFilteredFileSummaryLabel,
  getDefaultVisibleColumnKeys,
  getSortedFiles,
  getVisibleFavoriteProjects,
  getVisibleFilterGroups,
  type DateFilterMap,
  sanitizeVisibleColumnKeys,
  sanitizeSelectedFilters,
} from "./domain";

type FilterOptionMap = Record<string, string[]>;
function getVisibleFilterColumnsStorageKey(namingStandardVersion: NamingStandardVersion) {
  return `file-filter.visibleColumnKeys.standard-v${namingStandardVersion}`;
}

function extractProjectNumber(projectName: string) {
  const match = /^(\d{5})/.exec(projectName);
  return match ? match[1] : "";
}

const INITIAL_DATE_FILTERS: DateFilterMap = {
  createdAt: null,
  modifiedAt: null,
};

function getInitialVisibleColumnKeys(namingStandardVersion: NamingStandardVersion = 4) {
  try {
    const rawValue = window.localStorage.getItem(getVisibleFilterColumnsStorageKey(namingStandardVersion));
    return rawValue
      ? sanitizeVisibleColumnKeys(JSON.parse(rawValue), namingStandardVersion)
      : getDefaultVisibleColumnKeys(namingStandardVersion);
  } catch {
    return getDefaultVisibleColumnKeys(namingStandardVersion);
  }
}

export function useFilterWorkspace() {
  const namingStandardVersion = useNamingStandardVersion();
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
  const [reportMessageType, setReportMessageType] = useState<Exclude<NoticeTone, "muted">>("success");
  const [exportingInvalidReport, setExportingInvalidReport] = useState(false);
  const [exportingProjectProfile, setExportingProjectProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [showValidOnly, setShowValidOnly] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [filters, setFilters] = useState<FilterOptionMap>(INITIAL_FILTERS);
  const [dateFilters, setDateFilters] = useState<DateFilterMap>(INITIAL_DATE_FILTERS);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(INITIAL_EXPANDED_GROUPS);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "fileName", direction: "asc" });
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<FilterColumnKey[]>(getInitialVisibleColumnKeys);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const projectPickerRef = useRef<HTMLDivElement | null>(null);
  const projectOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredProjectQuery = useDeferredValue(projectQuery);

  useTransientBanner(errorMessage, () => setErrorMessage(""));
  useTransientBanner(reportMessage, () => setReportMessage(""));

  function dismissReportMessage() {
    setReportMessage("");
  }

  async function refreshProjects(preferredProject?: string) {
    setLoadingProjects(true);
    setErrorMessage("");
    setReportMessage("");

    try {
      const [settings, projectNames] = await Promise.all([
        fileFilterApi.getSettings(),
        fileFilterApi.listProjects(),
      ]);

      startTransition(() => {
        setProjectsRoot(settings.projectsRoot);
        setFavoriteProjects(settings.favoriteProjects);
        setProjects(projectNames);

        const nextProject =
          preferredProject && projectNames.includes(preferredProject) ? preferredProject : "";

        setSelectedProject(nextProject);
        setProjectQuery(nextProject);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się wczytać listy projektów.");
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  useEffect(() => {
    try {
      const namingStandardVersion = scanResult?.namingStandardVersion ?? 4;
      window.localStorage.setItem(
        getVisibleFilterColumnsStorageKey(namingStandardVersion),
        JSON.stringify(visibleColumnKeys),
      );
    } catch {
      // Widoczność kolumn nadal działa w bieżącej sesji.
    }
  }, [scanResult?.namingStandardVersion, visibleColumnKeys]);

  useEffect(() => {
    if (visibleColumnKeys.includes(sortConfig.key)) {
      return;
    }

    setSortConfig({ key: visibleColumnKeys[0] ?? "fileName", direction: "asc" });
  }, [sortConfig.key, visibleColumnKeys]);

  const baseMatchingFiles = useMemo(
    () => filterFilesBySearch(scanResult?.files ?? [], deferredSearchQuery),
    [deferredSearchQuery, namingStandardVersion, scanResult?.files],
  );

  const filterOptions = useMemo(
    () => getFilterOptions(baseMatchingFiles, filters, false),
    [baseMatchingFiles, filters, namingStandardVersion],
  );

  const visibleFilterGroups = useMemo(
    () => getVisibleFilterGroups(filterOptions, false),
    [filterOptions],
  );

  const filteredProjects = useMemo(
    () => getFilteredProjects(projects, deferredProjectQuery, selectedProject),
    [deferredProjectQuery, projects, selectedProject],
  );

  const visibleFavoriteProjects = useMemo(
    () => getVisibleFavoriteProjects(projects, favoriteProjects),
    [favoriteProjects, projects],
  );

  const selectedFileIdSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);

  const filesMatchingActiveFilters = useMemo(
    () => getFilteredFiles(baseMatchingFiles, filters, showInvalidOnly, showValidOnly, dateFilters),
    [baseMatchingFiles, dateFilters, filters, showInvalidOnly, showValidOnly],
  );

  const filteredFiles = useMemo(
    () =>
      showSelectedOnly
        ? filesMatchingActiveFilters.filter((file) => selectedFileIdSet.has(file.id))
        : filesMatchingActiveFilters,
    [filesMatchingActiveFilters, selectedFileIdSet, showSelectedOnly],
  );
  const sortedFiles = useMemo(() => getSortedFiles(filteredFiles, sortConfig), [filteredFiles, sortConfig]);
  const filteredValidCount = useMemo(
    () => filteredFiles.filter((file) => file.isValid).length,
    [filteredFiles],
  );
  const filteredInvalidCount = useMemo(
    () => filteredFiles.filter((file) => !file.isValid).length,
    [filteredFiles],
  );
  const selectedFiles = useMemo<DecodeSourceFile[]>(
    () => {
      const filesById = new Map((scanResult?.files ?? []).map((file) => [file.id, file]));

      return selectedFileIds
        .map((fileId) => filesById.get(fileId))
        .filter((file): file is NonNullable<typeof file> => Boolean(file))
        .map((file) => ({
          id: file.id,
          fileName: file.fileName,
          absolutePath: file.absolutePath,
          folderPath: file.folderPath,
          extension: file.extension,
          baseName: file.baseName,
          projectName: file.projectName,
          projectNumber: file.projectNumber,
        }));
    },
    [scanResult?.files, selectedFileIds],
  );

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

    if (selectedProject && !projects.includes(selectedProject)) {
      setSelectedProject("");
    }

    if (highlightedProjectIndex >= filteredProjects.length) {
      setHighlightedProjectIndex(filteredProjects.length - 1);
    }
  }, [filteredProjects, highlightedProjectIndex, projects, selectedProject]);

  useEffect(() => {
    if (!projectPickerOpen || highlightedProjectIndex < 0) {
      return;
    }

    const highlightedProject = filteredProjects[highlightedProjectIndex];
    if (!highlightedProject) {
      return;
    }

    projectOptionRefs.current[highlightedProject]?.scrollIntoView({ block: "nearest" });
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
    setFilters((current) => sanitizeSelectedFilters(current, filterOptions, false));
  }, [filterOptions]);

  useEffect(() => {
    const availableFileIds = new Set((scanResult?.files ?? []).map((file) => file.id));
    setSelectedFileIds((current) => current.filter((fileId) => availableFileIds.has(fileId)));
  }, [scanResult?.files]);

  async function handleChooseRoot() {
    dismissReportMessage();
    const settings = await fileFilterApi.chooseProjectsRoot();
    setProjectsRoot(settings.projectsRoot);
    setFavoriteProjects(settings.favoriteProjects);
    setScanResult(null);
    setFilters(INITIAL_FILTERS);
    setExpandedGroups(INITIAL_EXPANDED_GROUPS);
    setDateFilters(INITIAL_DATE_FILTERS);
    setProjectQuery("");
    setProjectPickerOpen(false);
    setHighlightedProjectIndex(-1);
    setShowSelectedOnly(false);
    setSelectedFileIds([]);
    await refreshProjects();
  }

  async function runScan(projectName: string) {
    if (!projectName) {
      return;
    }

    setScanning(true);
    setErrorMessage("");

    try {
      const result = await fileFilterApi.scanProject(projectName);
      const availableFileIds = new Set(result.files.map((file) => file.id));
      startTransition(() => {
        setScanResult(result);
        setFilters(INITIAL_FILTERS);
        setExpandedGroups(INITIAL_EXPANDED_GROUPS);
        setDateFilters(INITIAL_DATE_FILTERS);
        setSearchQuery("");
        setShowInvalidOnly(false);
        setShowValidOnly(false);
        setShowSelectedOnly(false);
        setVisibleColumnKeys(
          result.namingStandardVersion === 3
            ? getDefaultVisibleColumnKeys(3)
            : getInitialVisibleColumnKeys(result.namingStandardVersion),
        );
        setSelectedFileIds((current) => current.filter((fileId) => availableFileIds.has(fileId)));
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się przeskanować projektu.");
    } finally {
      setScanning(false);
    }
  }

  async function handleProjectSelect(project: string) {
    dismissReportMessage();
    setHighlightedProjectIndex(-1);
    setSelectedProject(project);
    setProjectQuery(project);
    setProjectPickerOpen(false);
    await runScan(project);
  }

  async function handleFavoriteToggle() {
    if (!selectedProject) {
      return;
    }

    dismissReportMessage();

    const projectIsFavorite = favoriteProjects.includes(selectedProject);
    if (!projectIsFavorite && favoriteProjects.length >= MAX_FAVORITE_PROJECTS) {
      setErrorMessage(`Możesz dodać maksymalnie ${MAX_FAVORITE_PROJECTS} ulubionych projektów.`);
      return;
    }

    try {
      const nextFavoriteProjects = projectIsFavorite
        ? favoriteProjects.filter((project) => project !== selectedProject)
        : [...favoriteProjects, selectedProject];

      const settings = await fileFilterApi.updateFavoriteProjects(nextFavoriteProjects);
      setFavoriteProjects(settings.favoriteProjects);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się zapisać ulubionych projektów.");
    }
  }

  async function handleRefreshCurrentProject() {
    if (!selectedProject) {
      return;
    }

    dismissReportMessage();
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
      const result = await fileFilterApi.exportInvalidFilesReport(invalidFiles);
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

  async function handleExportProjectProfile() {
    if (!scanResult) {
      setReportMessageType("error");
      setReportMessage("Najpierw wybierz i przeskanuj projekt.");
      return;
    }

    setExportingProjectProfile(true);
    setErrorMessage("");

    try {
      const result = await fileFilterApi.exportProjectProfile({
        projectName: scanResult.projectName,
        projectNumber: extractProjectNumber(scanResult.projectName),
        namingStandardVersion: scanResult.namingStandardVersion,
      });

      if (!result.saved) {
        return;
      }

      setReportMessageType("success");
      setReportMessage(`Profil Plikonazywacza zapisano: ${result.profilePath}`);
    } catch (error) {
      setReportMessageType("error");
      setReportMessage(error instanceof Error ? error.message : "Nie udało się wyeksportować profilu projektu.");
    } finally {
      setExportingProjectProfile(false);
    }
  }

  function toggleFilter(filterKey: string, value: string) {
    dismissReportMessage();
    setFilters((current) => {
      const active = current[filterKey] ?? [];
      const next = active.includes(value)
        ? active.filter((item) => item !== value)
        : [...active, value];

      setExpandedGroups((currentExpanded) => ({
        ...currentExpanded,
        [filterKey]: currentExpanded[filterKey],
      }));

      return {
        ...current,
        [filterKey]: next,
      };
    });
  }

  function clearFilters() {
    dismissReportMessage();
    setFilters(INITIAL_FILTERS);
    setExpandedGroups(INITIAL_EXPANDED_GROUPS);
    setDateFilters(INITIAL_DATE_FILTERS);
    setSearchQuery("");
    setShowInvalidOnly(false);
    setShowValidOnly(false);
    setShowSelectedOnly(false);
  }

  function toggleInvalidOnly(checked: boolean) {
    dismissReportMessage();
    setShowInvalidOnly(checked);
    if (checked) {
      setShowValidOnly(false);
    }
  }

  function toggleValidOnly(checked: boolean) {
    dismissReportMessage();
    setShowValidOnly(checked);
    if (checked) {
      setShowInvalidOnly(false);
    }
  }

  function toggleSelectedOnly(checked: boolean) {
    dismissReportMessage();
    setShowSelectedOnly(checked);
  }

  function toggleSort(sortKey: SortKey) {
    dismissReportMessage();
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

  function toggleColumnVisibility(columnKey: FilterColumnKey) {
    dismissReportMessage();
    setVisibleColumnKeys((current) => {
      if (current.includes(columnKey)) {
        return current.length > 1 ? current.filter((key) => key !== columnKey) : current;
      }

      return [...current, columnKey];
    });
  }

  function setDateFilter(dateKey: DateFilterKey, filter: DateFilterValue | null) {
    dismissReportMessage();
    setDateFilters((current) => ({
      ...current,
      [dateKey]: filter,
    }));
  }

  const activeFilterCount = getActiveFilterCount(
    filters,
    showInvalidOnly,
    showValidOnly,
    showSelectedOnly,
    dateFilters,
  );
  const validCountTooltip = useMemo(
    () => buildDisciplineFolderTooltip(filteredFiles, true),
    [filteredFiles],
  );
  const invalidCountTooltip = useMemo(
    () => buildDisciplineFolderTooltip(filteredFiles, false),
    [filteredFiles],
  );

  function toggleFileSelection(fileId: string) {
    dismissReportMessage();
    setSelectedFileIds((current) =>
      current.includes(fileId) ? current.filter((selectedId) => selectedId !== fileId) : [...current, fileId],
    );
  }

  function toggleAllVisibleFiles() {
    if (sortedFiles.length === 0) {
      return;
    }

    dismissReportMessage();
    const visibleIds = sortedFiles.map((file) => file.id);
    const areAllVisibleSelected = visibleIds.every((fileId) => selectedFileIds.includes(fileId));

    setSelectedFileIds((current) =>
      areAllVisibleSelected
        ? current.filter((fileId) => !visibleIds.includes(fileId))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  function clearSelectedFiles() {
    dismissReportMessage();
    setSelectedFileIds([]);
  }

  function handleSearchQueryChange(value: string) {
    dismissReportMessage();
    setSearchQuery(value);
  }

  function handleProjectQueryChange(value: string) {
    dismissReportMessage();
    setProjectQuery(value);
  }

  return {
    activeFilterCount,
    clearFilters,
    dateFilters,
    errorMessage,
    expandedGroups,
    exportingInvalidReport,
    exportingProjectProfile,
    filteredProjects,
    filterOptions,
    filters,
    handleChooseRoot,
    handleExportInvalidFilesReport,
    handleExportProjectProfile,
    handleFavoriteToggle,
    handleProjectSelect,
    handleProjectQueryChange,
    handleRefreshCurrentProject,
    handleSearchQueryChange,
    filteredInvalidCount,
    filteredValidCount,
    highlightedProjectIndex,
    invalidCountTooltip,
    loadingProjects,
    projectOptionRefs,
    projectPickerOpen,
    projectPickerRef,
    projectQuery,
    projectsRoot,
    reportMessage,
    reportMessageType,
    resultsCountLabel: getFilteredFileSummaryLabel(sortedFiles.length),
    scanResult,
    scanning,
    selectedFileIds,
    selectedFiles,
    selectedFilesCount: selectedFiles.length,
    searchQuery,
    selectedProject,
    selectedProjectIsFavorite: selectedProject ? favoriteProjects.includes(selectedProject) : false,
    setExpandedGroups,
    setHighlightedProjectIndex,
    setProjectPickerOpen,
    setProjectQuery: handleProjectQueryChange,
    setSearchQuery: handleSearchQueryChange,
    showInvalidOnly,
    showSelectedOnly,
    showValidOnly,
    sortConfig,
    sortedFiles,
    toggleAllVisibleFiles,
    toggleFilter,
    toggleFileSelection,
    toggleInvalidOnly,
    toggleSelectedOnly,
    toggleSort,
    toggleValidOnly,
    toggleColumnVisibility,
    setDateFilter,
    validCountTooltip,
    visibleColumnKeys,
    visibleFavoriteProjects,
    visibleFilterGroups,
    clearSelectedFiles,
  };
}
