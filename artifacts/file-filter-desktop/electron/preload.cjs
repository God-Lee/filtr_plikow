const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fileFilterApi", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  chooseProjectsRoot: () => ipcRenderer.invoke("settings:chooseRoot"),
  updateFavoriteProjects: (favoriteProjects) => ipcRenderer.invoke("settings:updateFavorites", favoriteProjects),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  scanProject: (projectName) => ipcRenderer.invoke("projects:scan", projectName),
  openFile: (targetPath) => ipcRenderer.invoke("shell:openFile", targetPath),
  openFolder: (targetPath) => ipcRenderer.invoke("shell:openFolder", targetPath),
});
