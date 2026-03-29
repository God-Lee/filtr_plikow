const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fileFilterApi", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  chooseProjectsRoot: () => ipcRenderer.invoke("settings:chooseRoot"),
  updateFavoriteProjects: (favoriteProjects) => ipcRenderer.invoke("settings:updateFavorites", favoriteProjects),
  updateNamingViewDraft: (namingViewDraft) => ipcRenderer.invoke("settings:updateNamingViewDraft", namingViewDraft),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  scanProject: (projectName) => ipcRenderer.invoke("projects:scan", projectName),
  chooseDirectory: (title) => ipcRenderer.invoke("dialog:chooseDirectory", title),
  exportInvalidFilesReport: (files) => ipcRenderer.invoke("report:exportInvalidFiles", files),
  listNamingFiles: (folderPath) => ipcRenderer.invoke("naming:listFiles", folderPath),
  copyNamingFiles: (items) => ipcRenderer.invoke("naming:copyFiles", items),
  openFile: (targetPath) => ipcRenderer.invoke("shell:openFile", targetPath),
  openFolder: (targetPath) => ipcRenderer.invoke("shell:openFolder", targetPath),
});
