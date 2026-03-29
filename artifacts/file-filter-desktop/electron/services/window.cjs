const { BrowserWindow } = require("electron");
const path = require("node:path");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f3efe5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return mainWindow;
  }

  mainWindow.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
  return mainWindow;
}

module.exports = {
  createWindow,
};
