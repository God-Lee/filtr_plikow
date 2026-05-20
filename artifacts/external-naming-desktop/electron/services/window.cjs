const { BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");

const closeRequests = new Map();
let closeRequestCounter = 0;

function waitForCloseResponse(mainWindow, requestId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      closeRequests.delete(requestId);
      resolve(false);
    }, 5000);

    closeRequests.set(requestId, (saved) => {
      clearTimeout(timeout);
      resolve(saved);
    });

    mainWindow.webContents.send("session:save-before-close", requestId);
  });
}

function registerCloseResponseHandler() {
  ipcMain.handle("session:closeResponse", async (_event, requestId, saved) => {
    const resolver = closeRequests.get(requestId);
    if (!resolver) {
      return false;
    }

    closeRequests.delete(requestId);
    resolver(Boolean(saved));
    return true;
  });
}

let closeResponseHandlerRegistered = false;

function getAppIconPath() {
  return path.join(__dirname, "..", "..", "assets", "app.ico");
}

function createWindow() {
  if (!closeResponseHandlerRegistered) {
    registerCloseResponseHandler();
    closeResponseHandlerRegistered = true;
  }

  const mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    icon: getAppIconPath(),
    backgroundColor: "#f6f7f9",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  let allowClose = false;
  mainWindow.on("close", async (event) => {
    if (allowClose) {
      return;
    }

    event.preventDefault();
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Zapisz i zamknij", "Zamknij bez zapisu", "Anuluj"],
      defaultId: 0,
      cancelId: 2,
      title: "Zamknąć aplikację?",
      message: "Czy zapisać bieżącą sesję przed zamknięciem?",
      detail: "Sesja zawiera importowane profile, foldery robocze, zaznaczenia i uzupełnione dane plików.",
    });

    if (result.response === 2) {
      return;
    }

    if (result.response === 0) {
      const requestId = `close-${Date.now()}-${closeRequestCounter}`;
      closeRequestCounter += 1;
      await waitForCloseResponse(mainWindow, requestId);
    }

    allowClose = true;
    mainWindow.close();
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
