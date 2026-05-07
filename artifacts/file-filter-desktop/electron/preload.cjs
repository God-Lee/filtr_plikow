const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("fileFilterApi", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  getNamingStandard: () => ipcRenderer.invoke("standard:get"),
  saveNamingStandard: (values) => ipcRenderer.invoke("standard:save", values),
  chooseProjectsRoot: () => ipcRenderer.invoke("settings:chooseRoot"),
  updateFavoriteProjects: (favoriteProjects) => ipcRenderer.invoke("settings:updateFavorites", favoriteProjects),
  updateNamingViewDraft: (namingViewDraft) => ipcRenderer.invoke("settings:updateNamingViewDraft", namingViewDraft),
  updateDecodingTemplates: (decodingTemplates) => ipcRenderer.invoke("settings:updateDecodingTemplates", decodingTemplates),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  scanProject: (projectName) => ipcRenderer.invoke("projects:scan", projectName),
  getDecodingDictionary: () => ipcRenderer.invoke("decoding:getDictionary"),
  chooseDirectory: (title) => ipcRenderer.invoke("dialog:chooseDirectory", title),
  exportInvalidFilesReport: (files) => ipcRenderer.invoke("report:exportInvalidFiles", files),
  listNamingFiles: (folderPath) => ipcRenderer.invoke("naming:listFiles", folderPath),
  copyNamingFiles: (items) => ipcRenderer.invoke("naming:copyFiles", items),
  openFile: (targetPath) => ipcRenderer.invoke("shell:openFile", targetPath),
  openFolder: (targetPath) => ipcRenderer.invoke("shell:openFolder", targetPath),
  getPathForDroppedFile: (file) => webUtils.getPathForFile(file),
});
