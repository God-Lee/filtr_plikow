import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fileFilterApi } from "../../app/api";
import type { NoticeTone, ScanResult, SortConfig, SortKey } from "../../app/types";
import {
  INITIAL_EXPANDED_GROUPS,
  INITIAL_FILTERS,
  buildDisciplineFolderTooltip,
  filterFilesBySearch,
  getActiveFilterCount,
  getFilterOptions,
  getFilteredFiles,
  getFilteredProjects,
  getFilteredFileSummaryLabel,
  getShouldHideExtensionFilter,
  getShouldRemovePdfExtensionOption,
  getSortedFiles,
  getVisibleFavoriteProjects,
  getVisibleFilterGroups,
  sanitizeSelectedFilters,
} from "./domain";

type FilterOptionMap = Record<string, string[]>;

export function useFilterWorkspace() {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [showValidOnly, setShowValidOnly] = useState(false);
  const [filters, setFilters] = useState<FilterOptionMap>(INITIAL_FILTERS);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(INITIAL_EXPANDED_GROUPS);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "fileName", direction: "asc" });
  const projectPickerRef = useRef<HTMLDivElement | null>(null);
  const projectOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredProjectQuery = useDeferredValue(projectQuery);

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

  const shouldHideExtensionFilter = getShouldHideExtensionFilter(filters);
  const shouldRemovePdfExtensionOption = getShouldRemovePdfExtensionOption(filters);

  const baseMatchingFiles = useMemo(
    () => filterFilesBySearch(scanResult?.files ?? [], deferredSearchQuery, showInvalidOnly, showValidOnly),
    [deferredSearchQuery, scanResult?.files, showInvalidOnly, showValidOnly],
  );

  const filterOptions = useMemo(
    () => getFilterOptions(baseMatchingFiles, filters, shouldRemovePdfExtensionOption),
    [baseMatchingFiles, filters, shouldRemovePdfExtensionOption],
  );

  const visibleFilterGroups = useMemo(
    () => getVisibleFilterGroups(filterOptions, shouldHideExtensionFilter),
    [filterOptions, shouldHideExtensionFilter],
  );

  const filteredProjects = useMemo(
    () => getFilteredProjects(projects, deferredProjectQuery, selectedProject),
    [deferredProjectQuery, projects, selectedProject],
  );

  const visibleFavoriteProjects = useMemo(
    () => getVisibleFavoriteProjects(projects, favoriteProjects),
    [favoriteProjects, projects],
  );

  const filteredFiles = useMemo(() => getFilteredFiles(baseMatchingFiles, filters), [baseMatchingFiles, filters]);
  const sortedFiles = useMemo(() => getSortedFiles(filteredFiles, sortConfig), [filteredFiles, sortConfig]);

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
    setFilters((current) => sanitizeSelectedFilters(current, filterOptions, shouldHideExtensionFilter));
  }, [filterOptions, shouldHideExtensionFilter]);

  async function handleChooseRoot() {
    const settings = await fileFilterApi.chooseProjectsRoot();
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
      const result = await fileFilterApi.scanProject(projectName);
      startTransition(() => {
        setScanResult(result);
        setFilters(INITIAL_FILTERS);
        setExpandedGroups(INITIAL_EXPANDED_GROUPS);
        setSearchQuery("");
        setShowInvalidOnly(false);
        setShowValidOnly(false);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nie udało się przeskanować projektu.");
    } finally {
      setScanning(false);
    }
  }

  async function handleProjectSelect(project: string) {
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

    try {
      const nextFavoriteProjects = favoriteProjects.includes(selectedProject)
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

  const activeFilterCount = getActiveFilterCount(filters, showInvalidOnly, showValidOnly);
  const validCountTooltip = useMemo(
    () => buildDisciplineFolderTooltip(scanResult?.files ?? [], true),
    [scanResult?.files],
  );
  const invalidCountTooltip = useMemo(
    () => buildDisciplineFolderTooltip(scanResult?.files ?? [], false),
    [scanResult?.files],
  );

  return {
    activeFilterCount,
    clearFilters,
    errorMessage,
    expandedGroups,
    exportingInvalidReport,
    filteredProjects,
    filterOptions,
    filters,
    handleChooseRoot,
    handleExportInvalidFilesReport,
    handleFavoriteToggle,
    handleProjectSelect,
    handleRefreshCurrentProject,
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
    searchQuery,
    selectedProject,
    selectedProjectIsFavorite: selectedProject ? favoriteProjects.includes(selectedProject) : false,
    setExpandedGroups,
    setHighlightedProjectIndex,
    setProjectPickerOpen,
    setProjectQuery,
    setSearchQuery,
    showInvalidOnly,
    showValidOnly,
    sortConfig,
    sortedFiles,
    toggleFilter,
    toggleInvalidOnly,
    toggleSort,
    toggleValidOnly,
    validCountTooltip,
    visibleFavoriteProjects,
    visibleFilterGroups,
  };
}
