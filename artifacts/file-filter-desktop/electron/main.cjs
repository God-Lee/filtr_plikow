const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const namingStandards = require("../shared/naming-standards.json");

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
    };
  } catch {
    return { projectsRoot: "", favoriteProjects: [] };
  }
}

async function saveSettings(settings) {
  const nextSettings = {
    projectsRoot: typeof settings.projectsRoot === "string" ? settings.projectsRoot : "",
    favoriteProjects: sanitizeFavoriteProjects(settings.favoriteProjects),
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
  return /^(?:[RW]\d{2}|W0X)$/.test(revision ?? "");
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
