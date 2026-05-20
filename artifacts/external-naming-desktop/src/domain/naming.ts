import type {
  CodeOption,
  ExportBucket,
  ExportItem,
  FileNamingRow,
  ProjectDefaults,
  ProjectProfile,
  SessionProject,
  WorkspaceFile,
} from "../app/types";

export const EMPTY_DEFAULTS: ProjectDefaults = {
  phase: "",
  discipline: "",
  documentType: "",
  building: "A",
  level: "",
  revision: "R00",
  status: "",
};

export function stripCodePrefix(label: string) {
  return label.replace(/^[A-Z0-9]+\s*-\s*/, "").trim();
}

export function getOptionLabel(options: CodeOption[], code: string) {
  const option = options.find((item) => item.code === code);
  return option ? stripCodePrefix(option.label) || option.code : "";
}

export function normalizeRevision(input: string) {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) {
    return "";
  }

  if (/^R\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^W\d{2}$/.test(trimmed) && trimmed !== "W00") {
    return trimmed;
  }

  const numberMatch = /^(R|W)?(\d{1,2})$/.exec(trimmed);
  if (!numberMatch) {
    return trimmed;
  }

  const prefix = numberMatch[1] ?? "R";
  const revision = `${prefix}${numberMatch[2].padStart(2, "0")}`;
  return revision === "W00" ? trimmed : revision;
}

export function isRevisionValid(revision: string) {
  return /^R\d{2}$/.test(revision) || (/^W\d{2}$/.test(revision) && revision !== "W00");
}

export function getFileBucket(fileName: string): ExportBucket {
  return fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "EDT";
}

export function getProjectTitle(profile: ProjectProfile) {
  return profile.projectName && profile.projectName !== profile.projectNumber
    ? `${profile.projectNumber} ${profile.projectName}`
    : profile.projectNumber;
}

export function mergeDefaults(profile: ProjectProfile, remembered?: Partial<ProjectDefaults>): ProjectDefaults {
  return {
    ...EMPTY_DEFAULTS,
    ...profile.defaults,
    ...remembered,
    building: profile.namingStandardVersion === 4 ? remembered?.building || profile.defaults.building || "A" : "",
  };
}

export function createProjectFromProfile(profile: ProjectProfile, remembered?: Partial<ProjectDefaults>): SessionProject {
  const defaults = mergeDefaults(profile, remembered);
  return {
    id: profile.projectNumber,
    profile,
    workingFolder: "",
    outputMessage: "",
    skippedOversized: 0,
    skippedUnreadable: 0,
    files: [],
    rows: [],
    selectedFileIds: [],
    defaults,
    lastRefreshedAt: "",
  };
}

export function inferDrawingNumber(fileName: string, disciplineCode: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const matches = Array.from(baseName.toUpperCase().matchAll(/(^|[^A-Z0-9])([A-Z]\d{2})(?=[^A-Z0-9]|$)/g));
  const disciplinePrefix = disciplineCode?.[0] ?? "";

  if (disciplinePrefix) {
    const matching = matches.find((match) => {
      const value = match[2] ?? "";
      return value.startsWith("X") || value.startsWith(disciplinePrefix);
    });
    if (matching?.[2]) {
      return matching[2];
    }
  }

  return matches[0]?.[2] ?? "";
}

function replaceDrawingPrefix(drawingNumber: string, disciplineCode: string) {
  const disciplinePrefix = getDisciplineDrawingPrefix(disciplineCode);
  if (!disciplinePrefix) {
    return drawingNumber;
  }

  const digits = drawingNumber.match(/\d{1,2}/)?.[0] ?? "";
  return `${disciplinePrefix}${digits.padStart(digits.length === 1 ? 2 : digits.length, "0")}`;
}

export function getDisciplineDrawingPrefix(disciplineCode: string) {
  return disciplineCode.trim().toUpperCase().match(/^[A-Z]/)?.[0] ?? "";
}

export function isDrawingNumberAllowedForDiscipline(drawingNumber: string, disciplineCode: string) {
  const prefix = getDisciplineDrawingPrefix(disciplineCode);
  if (!prefix) {
    return true;
  }

  return drawingNumber.startsWith(prefix) || drawingNumber.startsWith("X");
}

export function inferRevision(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const matches = Array.from(baseName.toUpperCase().matchAll(/(^|[^A-Z0-9])([RW]\d{2})(?=[^A-Z0-9]|$)/g));
  return matches.map((match) => match[2] ?? "").filter(isRevisionValid).at(-1) ?? "";
}

export function buildRowsFromFiles(
  files: WorkspaceFile[],
  existingRows: FileNamingRow[],
  defaults: ProjectDefaults,
  profile: ProjectProfile,
) {
  const existingByPath = new Map(existingRows.map((row) => [row.sourcePath.toLocaleLowerCase("pl"), row]));

  return files.map((file) => {
    const existing = existingByPath.get(file.absolutePath.toLocaleLowerCase("pl"));
    if (existing) {
      return {
        ...existing,
        drawingNumberMode: existing.drawingNumberMode ?? "auto",
        fileName: file.fileName,
        relativePath: file.relativePath,
        extension: file.extension,
        sizeBytes: file.sizeBytes,
        bucket: file.bucket,
      };
    }

    const inferredRevision = inferRevision(file.fileName);
    const inferredDrawingNumber = inferDrawingNumber(file.fileName, defaults.discipline);
    const drawingNumber = replaceDrawingPrefix(inferredDrawingNumber, defaults.discipline);

    return {
      id: file.id,
      sourcePath: file.absolutePath,
      fileName: file.fileName,
      relativePath: file.relativePath,
      extension: file.extension,
      sizeBytes: file.sizeBytes,
      bucket: getFileBucket(file.fileName),
      phase: defaults.phase,
      discipline: defaults.discipline,
      documentType: defaults.documentType,
      building: profile.namingStandardVersion === 4 ? defaults.building || "A" : "",
      level: defaults.level,
      drawingNumber,
      drawingNumberMode: drawingNumber ? ("manual" as const) : ("auto" as const),
      revision: inferredRevision || defaults.revision,
      status: defaults.status,
    };
  });
}

export function buildTargetFileName(row: FileNamingRow, profile: ProjectProfile) {
  if (
    !row.phase ||
    !row.discipline ||
    !row.documentType ||
    (profile.namingStandardVersion === 4 && !row.building) ||
    !row.level ||
    !row.drawingNumber ||
    !row.revision ||
    !row.status
  ) {
    return "";
  }

  const segments = [profile.projectNumber, row.phase, row.discipline, row.documentType];
  if (profile.namingStandardVersion === 4) {
    segments.push(row.building);
  }

  segments.push(row.level, row.drawingNumber, row.revision, row.status);
  return `${segments.join("-")}${row.extension}`;
}

export function validateRow(row: FileNamingRow, profile: ProjectProfile) {
  const missingFields = [];
  if (!row.phase) missingFields.push("faza");
  if (!row.discipline) missingFields.push("branża");
  if (!row.documentType) missingFields.push("typ dokumentu");
  if (profile.namingStandardVersion === 4 && !row.building) missingFields.push("budynek");
  if (!row.level) missingFields.push("poziom");
  if (!row.drawingNumber) missingFields.push("numer");
  if (!row.revision) missingFields.push("rewizja");
  if (!row.status) missingFields.push("status");

  if (missingFields.length > 0) {
    return `Uzupełnij: ${missingFields.join(", ")}.`;
  }

  if (!/^[A-Z]\d{2}$/.test(row.drawingNumber)) {
    return "Numer musi mieć format litera + dwie cyfry, np. A01.";
  }

  if (!isDrawingNumberAllowedForDiscipline(row.drawingNumber, row.discipline)) {
    const disciplinePrefix = getDisciplineDrawingPrefix(row.discipline);
    return `Numer musi zaczynać się od ${disciplinePrefix} albo X.`;
  }

  if (!isRevisionValid(row.revision)) {
    return "Rewizja musi mieć format R00-R99 albo W01-W99.";
  }

  if (profile.namingStandardVersion === 4 && !/^(?:[A-I]|X)$/.test(row.building)) {
    return "Budynek musi mieć oznaczenie A-I albo X.";
  }

  return "";
}

export function getSelectedRows(projects: SessionProject[], activeRowIdsByProject?: Record<string, string[]>) {
  return projects.flatMap((project) => {
    const selected = new Set(project.selectedFileIds);
    const activeRowIds = activeRowIdsByProject?.[project.id];
    const active = activeRowIds ? new Set(activeRowIds) : null;
    return project.rows
      .filter((row) => selected.has(row.id) && (!active || active.has(row.id)))
      .map((row) => ({
        project,
        row,
        targetFileName: buildTargetFileName(row, project.profile),
        validationMessage: validateRow(row, project.profile),
      }));
  });
}

export function getBatchDuplicateMessages(projects: SessionProject[], activeRowIdsByProject?: Record<string, string[]>) {
  const selectedRows = getSelectedRows(projects, activeRowIdsByProject).filter((item) => item.targetFileName);
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const item of selectedRows) {
    const key = [
      item.project.profile.projectNumber,
      item.row.bucket,
      item.targetFileName.toLocaleLowerCase("pl"),
    ].join("|");
    const label = `${getProjectTitle(item.project.profile)} / ${item.row.bucket} / ${item.targetFileName}`;
    if (seen.has(key)) {
      duplicates.add(label);
      duplicates.add(seen.get(key) ?? label);
    } else {
      seen.set(key, label);
    }
  }

  return Array.from(duplicates).sort((left, right) => left.localeCompare(right, "pl"));
}

export function buildExportItems(projects: SessionProject[], activeRowIdsByProject?: Record<string, string[]>): ExportItem[] {
  return getSelectedRows(projects, activeRowIdsByProject)
    .filter((item) => item.targetFileName && !item.validationMessage)
    .map((item) => ({
      projectNumber: item.project.profile.projectNumber,
      projectName: item.project.profile.projectName,
      bucket: item.row.bucket,
      sourcePath: item.row.sourcePath,
      targetFileName: item.targetFileName,
    }));
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
