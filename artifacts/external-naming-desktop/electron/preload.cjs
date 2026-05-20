const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("externalNamingApi", {
  importProjectProfile: () => ipcRenderer.invoke("profile:import"),
  chooseDirectory: (title) => ipcRenderer.invoke("dialog:chooseDirectory", title),
  listWorkspaceFiles: (folderPath) => ipcRenderer.invoke("files:listWorkspace", folderPath),
  checkExportTargets: (outputRoot, items) => ipcRenderer.invoke("files:checkExportTargets", outputRoot, items),
  exportFiles: (outputRoot, items, overwriteExisting) =>
    ipcRenderer.invoke("files:export", outputRoot, items, overwriteExisting),
  loadSession: () => ipcRenderer.invoke("session:load"),
  saveSession: (session) => ipcRenderer.invoke("session:save", session),
  clearSession: () => ipcRenderer.invoke("session:clear"),
  onSaveSessionBeforeClose: (callback) => {
    const listener = async (_event, requestId) => {
      let saved = false;
      try {
        saved = Boolean(await callback());
      } catch {
        saved = false;
      }

      await ipcRenderer.invoke("session:closeResponse", requestId, saved);
    };

    ipcRenderer.on("session:save-before-close", listener);
    return () => ipcRenderer.removeListener("session:save-before-close", listener);
  },
});
