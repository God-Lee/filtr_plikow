const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const SOURCE_FOLDERS = [
  { key: "EDT", folderName: "2. EDT" },
  { key: "PDF", folderName: "3. PDF" },
];

const DISCIPLINE_FOLDERS = [
  "1. Architektura",
  "2. Sanitarna",
  "3. Elektryczna",
  "4. Konstrukcyjna",
  "5. Drogowa",
  "6. Koordynacja",
];

const SEGMENT_RULES = [
  /^\d{5}$/,
  /^[A-Z0-9]{2,4}$/,
  /^[A-Z0-9]{1,4}$/,
  /^[A-Z0-9]{2,5}$/,
  /^[A-Z0-9]{1,4}$/,
  /^[A-Z0-9]{2,6}$/,
  /^R[A-Z0-9]{2,3}$/,
  /^S[A-Z0-9]{1,3}$/,
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

let mainWindow = null;

function getConfigPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      projectsRoot: typeof parsed.projectsRoot === "string" ? parsed.projectsRoot : "",
    };
  } catch {
    return { projectsRoot: "" };
  }
}

async function saveSettings(settings) {
  await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(settings, null, 2), "utf8");
  return settings;
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

function parseFileName(filename, projectNumber) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  const segments = baseName.split("-");

  if (segments.length !== SEGMENT_RULES.length) {
    return {
      isValid: false,
      invalidReason: `Oczekiwano ${SEGMENT_RULES.length} segmentów oddzielonych '-'`,
      baseName,
      extension,
      rawSegments: segments,
    };
  }

  for (let index = 0; index < SEGMENT_RULES.length; index += 1) {
    const value = segments[index]?.trim() ?? "";
    if (!value || !SEGMENT_RULES[index].test(value)) {
      return {
        isValid: false,
        invalidReason: `Segment ${index + 1} ma nieprawidłowy format`,
        baseName,
        extension,
        rawSegments: segments,
      };
    }
  }

  if (projectNumber && segments[0] !== projectNumber) {
    return {
      isValid: false,
      invalidReason: "Numer projektu w nazwie pliku nie zgadza się z wybranym projektem",
      baseName,
      extension,
      rawSegments: segments,
    };
  }

  return {
    isValid: true,
    invalidReason: null,
    baseName,
    extension,
    rawSegments: segments,
    parsedSegments: Object.fromEntries(
      SEGMENT_KEYS.map((key, index) => [key, segments[index]]),
    ),
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
        const parsed = parseFileName(entry.name, projectNumber);

        results.push({
          id: absolutePath,
          fileName: entry.name,
          absolutePath,
          folderPath: scanPath,
          projectName,
          projectNumber: projectNumber ?? "",
          sourceKey: source.key,
          sourceLabel: source.folderName,
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

  const settings = {
    projectsRoot: selected.filePaths[0],
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
