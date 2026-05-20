export type NamingStandardVersion = 3 | 4;

export type CodeOption = {
  code: string;
  label: string;
};

export type ProjectProfile = {
  schemaVersion: 1;
  profileId: string;
  projectNumber: string;
  projectName: string;
  namingStandardVersion: NamingStandardVersion;
  allowedValues: {
    phases: CodeOption[];
    disciplines: CodeOption[];
    documentTypes: CodeOption[];
    levels: CodeOption[];
    statuses: CodeOption[];
    buildings: CodeOption[];
  };
  defaults: ProjectDefaults;
  sourcePath?: string;
  importedAt?: string;
};

export type ProjectDefaults = {
  phase: string;
  discipline: string;
  documentType: string;
  building: string;
  level: string;
  revision: string;
  status: string;
};

export type WorkspaceFile = {
  id: string;
  fileName: string;
  absolutePath: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  bucket: ExportBucket;
};

export type WorkspaceFilesResult = {
  files: WorkspaceFile[];
  skippedOversized: number;
  skippedUnreadable: number;
};

export type ExportBucket = "PDF" | "EDT";
export type DrawingNumberMode = "auto" | "manual";

export type FileNamingRow = {
  id: string;
  sourcePath: string;
  fileName: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  bucket: ExportBucket;
  phase: string;
  discipline: string;
  documentType: string;
  building: string;
  level: string;
  drawingNumber: string;
  drawingNumberMode?: DrawingNumberMode;
  revision: string;
  status: string;
};

export type SessionProject = {
  id: string;
  profile: ProjectProfile;
  workingFolder: string;
  outputMessage: string;
  skippedOversized: number;
  skippedUnreadable: number;
  files: WorkspaceFile[];
  rows: FileNamingRow[];
  selectedFileIds: string[];
  defaults: ProjectDefaults;
  lastRefreshedAt: string;
};

export type AppSession = {
  version: 1;
  activeProjectId: string;
  outputRoot: string;
  projects: SessionProject[];
};

export type ExportItem = {
  projectNumber: string;
  projectName: string;
  bucket: ExportBucket;
  sourcePath: string;
  targetFileName: string;
};

export type ExistingExportTarget = {
  targetPath: string;
  targetFileName: string;
  projectNumber: string;
  bucket: ExportBucket;
};

export type ExportResult = {
  copiedCount: number;
  outputRoot: string;
};

export interface ExternalNamingApi {
  importProjectProfile: () => Promise<ProjectProfile | null>;
  chooseDirectory: (title: string) => Promise<string | null>;
  listWorkspaceFiles: (folderPath: string) => Promise<WorkspaceFilesResult>;
  checkExportTargets: (outputRoot: string, items: ExportItem[]) => Promise<ExistingExportTarget[]>;
  exportFiles: (
    outputRoot: string,
    items: ExportItem[],
    overwriteExisting: boolean,
  ) => Promise<ExportResult>;
  loadSession: () => Promise<AppSession | null>;
  saveSession: (session: AppSession) => Promise<boolean>;
  clearSession: () => Promise<boolean>;
  onSaveSessionBeforeClose: (callback: () => Promise<boolean>) => () => void;
}

declare global {
  interface Window {
    externalNamingApi: ExternalNamingApi;
  }
}
