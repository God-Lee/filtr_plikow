const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const { constants: fsConstants } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const namingStandards = require("../shared/naming-standards.json");

const execFileAsync = promisify(execFile);

const SOURCE_FOLDERS = [
  { key: "PDF", folderName: "3. PDF", displayLabel: "PDF" },
  { key: "EDT", folderName: "2. EDT", displayLabel: "Pozostałe" },
];

const DISCIPLINE_FOLDERS = [
  "1. Architektura",
  "2. Sanitarna",
  "3. Elektryczna",
  "4. Konstrukcyjna",
  "5. Drogowa",
  "6. Koordynacja",
];

const IGNORED_EXTENSIONS = new Set([".bak", ".dwl", ".dwl2", ".pcp", ".log", ".pat"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const NAMING_SUPPORTED_EXTENSIONS = new Set([".doc", ".docx", ".pdf", ".xls", ".xlsx", ".dwg"]);

const SEGMENT_RULES = [
  /^\d{5}$/,
  /^[A-Z0-9]{2,4}$/,
  /^[A-Z0-9]{1,4}$/,
  /^[A-Z0-9]{2,5}$/,
  /^[A-Z0-9]{1,4}$/,
  /^[A-Z]\d{2}$/,
  /^[A-Z][A-Z0-9]{2,3}$/,
  /^[A-Z][A-Z0-9]{1,3}$/,
];

const SEGMENT_KEYS = [
  "projectNumber",
  "phase",
  "disciplineCode",
  "documentType",
  "level",
  "drawingNumber",
  "revision",
  "status",
];

const SEGMENT_DISPLAY_NAMES = {
  projectNumber: "Numer projektu",
  phase: "Faza",
  disciplineCode: "Branża",
  documentType: "Typ",
  level: "Poziom",
  drawingNumber: "Numer",
  revision: "Rewizja",
  status: "Status",
};

const ALLOWED_SEGMENT_VALUES = {
  phase: new Set(Object.keys(namingStandards.phases)),
  disciplineCode: new Set(Object.keys(namingStandards.disciplines)),
  documentType: new Set(Object.keys(namingStandards.documentTypes)),
  level: new Set(Object.keys(namingStandards.levels)),
  status: new Set(Object.keys(namingStandards.statuses)),
};

let mainWindow = null;

function sanitizeNamingViewDraft(value) {
  if (!value || typeof value !== "object") {
    return {
      projectNumber: "",
      phaseInput: "",
      disciplineInput: "",
      defaultRevision: "",
      defaultRevisionInput: "",
      defaultStatus: "",
      workingFolder: "",
      targetFolder: "",
      ignoredSourcePathsByFolder: {},
    };
  }

  const ignoredSourcePathsByFolder =
    value.ignoredSourcePathsByFolder && typeof value.ignoredSourcePathsByFolder === "object"
      ? Object.fromEntries(
          Object.entries(value.ignoredSourcePathsByFolder)
            .filter(([folderPath, paths]) => typeof folderPath === "string" && Array.isArray(paths))
            .map(([folderPath, paths]) => [
              folderPath,
              Array.from(
                new Set(
                  paths.filter((targetPath) => typeof targetPath === "string" && targetPath.trim().length > 0),
                ),
              ),
            ]),
        )
      : {};

  return {
    projectNumber: typeof value.projectNumber === "string" ? value.projectNumber : "",
    phaseInput: typeof value.phaseInput === "string" ? value.phaseInput : "",
    disciplineInput: typeof value.disciplineInput === "string" ? value.disciplineInput : "",
    defaultRevision: typeof value.defaultRevision === "string" ? value.defaultRevision : "",
    defaultRevisionInput: typeof value.defaultRevisionInput === "string" ? value.defaultRevisionInput : "",
    defaultStatus: typeof value.defaultStatus === "string" ? value.defaultStatus : "",
    workingFolder: typeof value.workingFolder === "string" ? value.workingFolder : "",
    targetFolder: typeof value.targetFolder === "string" ? value.targetFolder : "",
    ignoredSourcePathsByFolder,
  };
}

function sanitizeFavoriteProjects(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((projectName) => typeof projectName === "string" && projectName.trim().length > 0)),
  ).slice(0, 5);
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      projectsRoot: typeof parsed.projectsRoot === "string" ? parsed.projectsRoot : "",
      favoriteProjects: sanitizeFavoriteProjects(parsed.favoriteProjects),
      namingViewDraft: sanitizeNamingViewDraft(parsed.namingViewDraft),
    };
  } catch {
    return {
      projectsRoot: "",
      favoriteProjects: [],
      namingViewDraft: sanitizeNamingViewDraft(null),
    };
  }
}

async function saveSettings(settings) {
  const nextSettings = {
    projectsRoot: typeof settings.projectsRoot === "string" ? settings.projectsRoot : "",
    favoriteProjects: sanitizeFavoriteProjects(settings.favoriteProjects),
    namingViewDraft: sanitizeNamingViewDraft(settings.namingViewDraft),
  };

  await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(nextSettings, null, 2), "utf8");
  return nextSettings;
}

async function directoryExists(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listProjects(projectsRoot) {
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "pl"));
}

function getProjectNumber(projectName) {
  const match = /^(\d{5})/.exec(projectName);
  return match ? match[1] : null;
}

function isDrawingNumberValidForDiscipline(disciplineCode, drawingNumber) {
  const disciplinePrefix = disciplineCode?.[0];
  const drawingPrefix = drawingNumber?.[0];

  if (!disciplinePrefix || !drawingPrefix) {
    return false;
  }

  return drawingPrefix === "X" || drawingPrefix === disciplinePrefix;
}

function isRevisionCodeValid(revision) {
  return /^R\d{2}$/.test(revision ?? "") || (/^W\d{2}$/.test(revision ?? "") && revision !== "W00");
}

function buildParsedSegments(segments, invalidSegmentKey) {
  return Object.fromEntries(
    SEGMENT_KEYS.map((key, index) => [
      key,
      key === invalidSegmentKey ? null : (segments[index] ?? null),
    ]),
  );
}

function summarizeSegmentIssues(segmentIssues) {
  return `Błędy w segmentach:\n${Array.from(segmentIssues.entries())
    .map(([segmentKey, issue]) => `- ${SEGMENT_DISPLAY_NAMES[segmentKey]} (${issue})`)
    .join("\n")}`;
}

function parseFileName(filename, projectNumber) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  const segments = baseName.split("-").map((segment) => segment.trim());
  const parsedSegments = buildParsedSegments(segments);

  if (segments.length !== SEGMENT_RULES.length) {
    return {
      isValid: false,
      invalidReason: `Oczekiwano ${SEGMENT_RULES.length} segmentów oddzielonych '-'`,
      baseName,
      extension,
      rawSegments: segments,
      parsedSegments,
    };
  }

  const segmentIssues = new Map();

  for (let index = 0; index < SEGMENT_RULES.length; index += 1) {
    const value = segments[index]?.trim() ?? "";
    if (!value || !SEGMENT_RULES[index].test(value)) {
      const segmentKey = SEGMENT_KEYS[index];
      segmentIssues.set(segmentKey, "ma nieprawidłowy format");
    }
  }

  if (projectNumber && segments[0] !== projectNumber) {
    segmentIssues.set("projectNumber", "nie zgadza się z wybranym projektem");
  }

  for (const [segmentKey, allowedValues] of Object.entries(ALLOWED_SEGMENT_VALUES)) {
    if (segmentIssues.has(segmentKey)) {
      continue;
    }

    if (allowedValues.has(parsedSegments[segmentKey])) {
      continue;
    }

    segmentIssues.set(segmentKey, "ma nieznaną wartość");
  }

  if (!segmentIssues.has("revision") && !isRevisionCodeValid(parsedSegments.revision)) {
    segmentIssues.set("revision", "ma nieprawidłowy format");
  }

  if (
    !segmentIssues.has("disciplineCode") &&
    !segmentIssues.has("drawingNumber") &&
    !isDrawingNumberValidForDiscipline(parsedSegments.disciplineCode, parsedSegments.drawingNumber)
  ) {
    segmentIssues.set("drawingNumber", "musi zaczynać się od pierwszej litery branży albo od X");
  }

  if (segmentIssues.size === 1) {
    const [[segmentKey, issue]] = Array.from(segmentIssues.entries());
    return {
      isValid: false,
      invalidReason: `Segment „${SEGMENT_DISPLAY_NAMES[segmentKey]}” ${issue}`,
      baseName,
      extension,
      rawSegments: segments,
      parsedSegments: buildParsedSegments(segments, segmentKey),
    };
  }

  if (segmentIssues.size > 1) {
    return {
      isValid: false,
      invalidReason: summarizeSegmentIssues(segmentIssues),
      baseName,
      extension,
      rawSegments: segments,
      parsedSegments: null,
    };
  }

  return {
    isValid: true,
    invalidReason: null,
    baseName,
    extension,
    rawSegments: segments,
    parsedSegments,
  };
}

function buildMislocatedImageResult(filename) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);

  return {
    isValid: false,
    invalidReason: "Błędna lokalizacja",
    baseName,
    extension,
    rawSegments: [baseName],
    parsedSegments: null,
  };
}

async function scanProject(projectsRoot, projectName) {
  if (!projectsRoot) {
    throw new Error("Najpierw wybierz folder ESP - Realizacje.");
  }

  const projectPath = path.join(projectsRoot, projectName);
  const projectNumber = getProjectNumber(projectName);
  const projectDesignPath = path.join(projectPath, "4. Projektowanie");

  const results = [];
  const missingFolders = [];

  for (const source of SOURCE_FOLDERS) {
    for (const disciplineFolder of DISCIPLINE_FOLDERS) {
      const scanPath = path.join(projectDesignPath, source.folderName, disciplineFolder);

      if (!(await directoryExists(scanPath))) {
        missingFolders.push(scanPath);
        continue;
      }

      let entries = [];
      try {
        entries = await fs.readdir(scanPath, { withFileTypes: true });
      } catch {
        missingFolders.push(scanPath);
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        const absolutePath = path.join(scanPath, entry.name);
        const extension = path.extname(entry.name).toLowerCase();
        if (IGNORED_EXTENSIONS.has(extension)) {
          continue;
        }

        const parsed = IMAGE_EXTENSIONS.has(extension)
          ? buildMislocatedImageResult(entry.name)
          : parseFileName(entry.name, projectNumber);

        results.push({
          id: absolutePath,
          fileName: entry.name,
          absolutePath,
          folderPath: scanPath,
          projectName,
          projectNumber: projectNumber ?? "",
          sourceKey: source.key,
          sourceLabel: source.displayLabel,
          disciplineFolder,
          extension: parsed.extension.toLowerCase(),
          extensionLabel: parsed.extension || "(brak)",
          baseName: parsed.baseName,
          isValid: parsed.isValid,
          invalidReason: parsed.invalidReason,
          rawSegments: parsed.rawSegments,
          parsedSegments: parsed.parsedSegments ?? null,
        });
      }
    }
  }

  results.sort((left, right) => left.fileName.localeCompare(right.fileName, "pl"));

  return {
    projectName,
    projectPath,
    scannedAt: new Date().toISOString(),
    totalFiles: results.length,
    validCount: results.filter((file) => file.isValid).length,
    invalidCount: results.filter((file) => !file.isValid).length,
    missingFolders,
    files: results,
  };
}

async function chooseProjectsRoot() {
  const selected = await dialog.showOpenDialog({
    title: "Wybierz folder ESP - Realizacje",
    properties: ["openDirectory"],
  });

  if (selected.canceled || selected.filePaths.length === 0) {
    return loadSettings();
  }

  const currentSettings = await loadSettings();
  const settings = {
    projectsRoot: selected.filePaths[0],
    favoriteProjects: currentSettings.favoriteProjects,
  };

  return saveSettings(settings);
}

async function chooseDirectory(title) {
  const selected = await dialog.showOpenDialog({
    title,
    properties: ["openDirectory"],
  });

  if (selected.canceled || selected.filePaths.length === 0) {
    return null;
  }

  return selected.filePaths[0];
}

async function listDirectoryFiles(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(folderPath, entry.name);

    if (!entry.isFile()) {
      continue;
    }

    files.push({
      fileName: entry.name,
      absolutePath,
      folderPath,
      relativePath: entry.name,
      extension: path.extname(entry.name).toLowerCase(),
      baseName: path.basename(entry.name, path.extname(entry.name)),
    });
  }

  return files;
}

async function listNamingFiles(folderPath) {
  if (!folderPath) {
    return { files: [], ignoredCount: 0, totalCount: 0 };
  }

  if (!(await directoryExists(folderPath))) {
    throw new Error("Wybrany folder nie istnieje.");
  }

  const allFiles = await listDirectoryFiles(folderPath);
  const supportedFiles = allFiles
    .filter((file) => NAMING_SUPPORTED_EXTENSIONS.has(file.extension))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, "pl", { numeric: true }));

  return {
    files: supportedFiles.map((file) => ({
      id: file.absolutePath,
      ...file,
    })),
    ignoredCount: allFiles.length - supportedFiles.length,
    totalCount: allFiles.length,
  };
}

async function copyNamingFiles(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { copiedCount: 0 };
  }

  for (const item of items) {
    if (
      !item ||
      typeof item.sourcePath !== "string" ||
      typeof item.targetPath !== "string" ||
      item.sourcePath.trim().length === 0 ||
      item.targetPath.trim().length === 0
    ) {
      throw new Error("Nieprawidłowe dane plików do skopiowania.");
    }
  }

  const seenTargets = new Set();
  for (const item of items) {
    if (seenTargets.has(item.targetPath)) {
      throw new Error(`W partii kopiowania występuje zduplikowany plik docelowy: ${item.targetPath}`);
    }

    seenTargets.add(item.targetPath);
  }

  for (const item of items) {
    if (!item.overwriteExisting && (await pathExists(item.targetPath))) {
      throw new Error(`Plik docelowy już istnieje: ${path.basename(item.targetPath)}`);
    }
  }

  for (const item of items) {
    await fs.mkdir(path.dirname(item.targetPath), { recursive: true });
    await fs.copyFile(item.sourcePath, item.targetPath);
  }

  return { copiedCount: items.length };
}

function getDisciplineFolderLabel(folderName) {
  return String(folderName ?? "").replace(/^\d+\.\s*/, "");
}

async function getAvailableReportPath(folderPath, baseFileName) {
  const extension = path.extname(baseFileName);
  const baseName = path.basename(baseFileName, extension);
  let counter = 0;

  while (true) {
    const suffix = counter === 0 ? "" : ` (${counter})`;
    const candidatePath = path.join(folderPath, `${baseName}${suffix}${extension}`);
    if (!(await pathExists(candidatePath))) {
      return candidatePath;
    }

    counter += 1;
  }
}

async function exportInvalidFilesReport(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Brak błędnych plików do wyeksportowania.");
  }

  const targetFolder = await chooseDirectory("Gdzie chcesz zapisać raport?");
  if (!targetFolder) {
    return { saved: false, reportPath: null };
  }

  const reportRows = files
    .map((file) => {
      if (!file || typeof file.fileName !== "string" || typeof file.disciplineFolder !== "string") {
        throw new Error("Nieprawidłowe dane raportu.");
      }

      return {
        fileName: file.fileName,
        discipline: getDisciplineFolderLabel(file.disciplineFolder),
      };
    })
    .sort((left, right) => {
      const disciplineCompare = left.discipline.localeCompare(right.discipline, "pl");
      if (disciplineCompare !== 0) {
        return disciplineCompare;
      }

      return left.fileName.localeCompare(right.fileName, "pl");
    });

  const outputPath = await getAvailableReportPath(targetFolder, "Raport błędnych plików.xlsx");
  const tempDataPath = path.join(app.getPath("temp"), `invalid-files-report-${Date.now()}.json`);
  const scriptPath = path.join(__dirname, "..", "scripts", "export-invalid-files-report.ps1");

  await fs.writeFile(tempDataPath, JSON.stringify(reportRows, null, 2), "utf8");

  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-OutputPath",
      outputPath,
      "-DataPath",
      tempDataPath,
    ]);
  } finally {
    await fs.rm(tempDataPath, { force: true });
  }

  return {
    saved: true,
    reportPath: outputPath,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f3efe5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

ipcMain.handle("settings:get", async () => loadSettings());
ipcMain.handle("settings:chooseRoot", async () => chooseProjectsRoot());
ipcMain.handle("settings:updateFavorites", async (_event, favoriteProjects) => {
  const currentSettings = await loadSettings();
  return saveSettings({
    ...currentSettings,
    favoriteProjects,
  });
});
ipcMain.handle("settings:updateNamingViewDraft", async (_event, namingViewDraft) => {
  const currentSettings = await loadSettings();
  return saveSettings({
    ...currentSettings,
    namingViewDraft,
  });
});
ipcMain.handle("projects:list", async () => {
  const settings = await loadSettings();
  if (!settings.projectsRoot) {
    return [];
  }

  return listProjects(settings.projectsRoot);
});
ipcMain.handle("projects:scan", async (_event, projectName) => {
  const settings = await loadSettings();
  return scanProject(settings.projectsRoot, projectName);
});
ipcMain.handle("dialog:chooseDirectory", async (_event, title) => chooseDirectory(title));
ipcMain.handle("report:exportInvalidFiles", async (_event, files) => exportInvalidFilesReport(files));
ipcMain.handle("naming:listFiles", async (_event, folderPath) => listNamingFiles(folderPath));
ipcMain.handle("naming:copyFiles", async (_event, items) => copyNamingFiles(items));
ipcMain.handle("shell:openFile", async (_event, targetPath) => shell.openPath(targetPath));
ipcMain.handle("shell:openFolder", async (_event, targetPath) => shell.openPath(targetPath));

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
