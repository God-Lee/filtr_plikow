export type AppView = "filter" | "naming";

export type NoticeTone = "error" | "muted" | "success";

export type NamingViewDraft = {
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

export type AppSettings = {
  projectsRoot: string;
  favoriteProjects: string[];
  namingViewDraft: NamingViewDraft;
};

export type ParsedSegments = {
  projectNumber: string | null;
  phase: string | null;
  disciplineCode: string | null;
  documentType: string | null;
  level: string | null;
  drawingNumber: string | null;
  revision: string | null;
  status: string | null;
};

export type FileRecord = {
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

export type ScanResult = {
  projectName: string;
  projectPath: string;
  scannedAt: string;
  totalFiles: number;
  validCount: number;
  invalidCount: number;
  missingFolders: string[];
  files: FileRecord[];
};

export type FilterGroup<TItem> = {
  key: string;
  label: string;
  getValue: (item: TItem) => string;
};

export type SortDirection = "asc" | "desc";

export type SortKey =
  | "fileName"
  | "isValid"
  | "phase"
  | "disciplineCode"
  | "documentType"
  | "level"
  | "drawingNumber"
  | "revision"
  | "status";

export type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

export type FavoriteProjectCard = {
  projectName: string;
  number: string;
  label: string;
};

export type NamingFolderFile = {
  id: string;
  fileName: string;
  absolutePath: string;
  folderPath: string;
  relativePath: string;
  extension: string;
  baseName: string;
};

export type NamingFileRow = {
  id: string;
  sourcePath: string;
  fileName: string;
  relativePath: string;
  extension: string;
  documentType: string;
  level: string;
  drawingNumber: string;
  drawingNumberLocked: boolean;
  revision: string;
  status: string;
};

export type ResolvedSession = {
  projectNumber: string;
  phaseCode: string;
  disciplineCode: string;
};

export type ParsedStandardName = {
  projectNumber: string;
  phase: string;
  disciplineCode: string;
  documentType: string;
  level: string;
  drawingNumber: string;
  revision: string;
  status: string;
};

export type RowValidation = {
  status: "copied" | "error" | "ok" | "warning";
  message: string;
  details: string[];
  warningMessage?: string;
};

export type EvaluatedRow = {
  row: NamingFileRow;
  targetFileName: string;
  targetPath: string;
  validation: RowValidation;
};

export type NamingOption = {
  code: string;
  label: string;
  searchTerms: string[];
};

export type PendingBulkApply = {
  changedField: "revision" | "status";
  nextRevision: string;
  nextStatus: string;
  previousRevision: string;
  previousStatus: string;
};

export type LastBulkOperation = {
  rows: NamingFileRow[];
  message: string;
};

export type ExtensionFilterGroup = "doc" | "dwg" | "pdf" | "xls";

export type NamingFilesResult = {
  files: NamingFolderFile[];
  ignoredCount: number;
  totalCount: number;
};

export type InvalidReportFile = {
  fileName: string;
  disciplineFolder: string;
};

export type FileCopyItem = {
  sourcePath: string;
  targetPath: string;
  overwriteExisting?: boolean;
};

export type ExportInvalidFilesReportResult = {
  saved: boolean;
  reportPath: string | null;
};

export interface FileFilterApi {
  getSettings: () => Promise<AppSettings>;
  chooseProjectsRoot: () => Promise<AppSettings>;
  updateFavoriteProjects: (favoriteProjects: string[]) => Promise<AppSettings>;
  updateNamingViewDraft: (namingViewDraft: NamingViewDraft) => Promise<AppSettings>;
  listProjects: () => Promise<string[]>;
  scanProject: (projectName: string) => Promise<ScanResult>;
  exportInvalidFilesReport: (
    files: InvalidReportFile[],
  ) => Promise<ExportInvalidFilesReportResult>;
  chooseDirectory: (title: string) => Promise<string | null>;
  listNamingFiles: (folderPath: string) => Promise<NamingFilesResult>;
  copyNamingFiles: (items: FileCopyItem[]) => Promise<{ copiedCount: number }>;
  openFile: (targetPath: string) => Promise<void>;
  openFolder: (targetPath: string) => Promise<void>;
}

declare global {
  interface Window {
    fileFilterApi: FileFilterApi;
  }
}
