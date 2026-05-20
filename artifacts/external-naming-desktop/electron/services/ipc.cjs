const { ipcMain } = require("electron");
const { checkExportTargets, chooseDirectory, exportFiles, listWorkspaceFiles } = require("./files.cjs");
const { importProjectProfile } = require("./profile.cjs");
const { clearSession, loadSession, saveSession } = require("./session.cjs");

function registerIpcHandlers() {
  ipcMain.handle("profile:import", async () => importProjectProfile());
  ipcMain.handle("dialog:chooseDirectory", async (_event, title) => chooseDirectory(title));
  ipcMain.handle("files:listWorkspace", async (_event, folderPath) => listWorkspaceFiles(folderPath));
  ipcMain.handle("files:checkExportTargets", async (_event, outputRoot, items) =>
    checkExportTargets(outputRoot, items),
  );
  ipcMain.handle("files:export", async (_event, outputRoot, items, overwriteExisting) =>
    exportFiles(outputRoot, items, overwriteExisting),
  );
  ipcMain.handle("session:load", async () => loadSession());
  ipcMain.handle("session:save", async (_event, session) => saveSession(session));
  ipcMain.handle("session:clear", async () => clearSession());
}

module.exports = {
  registerIpcHandlers,
};
