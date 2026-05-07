const { dialog, ipcMain, shell } = require("electron");
const { copyNamingFiles, listNamingFiles } = require("./naming.cjs");
const { loadDecodingDictionary } = require("./decoding-config.cjs");
const { listProjects, scanProject } = require("./projects.cjs");
const { chooseDirectory, exportInvalidFilesReport } = require("./report.cjs");
const { loadSettings, saveSettings } = require("./settings.cjs");
const { loadNamingStandard, saveNamingStandard } = require("./standard-config.cjs");

async function chooseProjectsRoot() {
  const selected = await dialog.showOpenDialog({
    title: "Wybierz folder ESP - Realizacje",
    properties: ["openDirectory"],
  });

  if (selected.canceled || selected.filePaths.length === 0) {
    return loadSettings();
  }

  const currentSettings = await loadSettings();
  return saveSettings({
    projectsRoot: selected.filePaths[0],
    favoriteProjects: currentSettings.favoriteProjects,
    namingViewDraft: currentSettings.namingViewDraft,
    decodingTemplates: currentSettings.decodingTemplates,
  });
}

function registerIpcHandlers() {
  ipcMain.handle("settings:get", async () => loadSettings());
  ipcMain.handle("standard:get", async () => loadNamingStandard());
  ipcMain.handle("standard:save", async (_event, values) => saveNamingStandard(values));
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
  ipcMain.handle("settings:updateDecodingTemplates", async (_event, decodingTemplates) => {
    const currentSettings = await loadSettings();
    const normalizedTemplates = JSON.parse(JSON.stringify(decodingTemplates ?? []));
    return saveSettings({
      ...currentSettings,
      decodingTemplates: normalizedTemplates,
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
  ipcMain.handle("decoding:getDictionary", async () => loadDecodingDictionary());
  ipcMain.handle("dialog:chooseDirectory", async (_event, title) => chooseDirectory(title));
  ipcMain.handle("report:exportInvalidFiles", async (_event, files) => exportInvalidFilesReport(files));
  ipcMain.handle("naming:listFiles", async (_event, folderPath) => listNamingFiles(folderPath));
  ipcMain.handle("naming:copyFiles", async (_event, items) => copyNamingFiles(items));
  ipcMain.handle("shell:openFile", async (_event, targetPath) => shell.openPath(targetPath));
  ipcMain.handle("shell:openFolder", async (_event, targetPath) => shell.openPath(targetPath));
}

module.exports = {
  registerIpcHandlers,
};
