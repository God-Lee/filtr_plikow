const { app } = require("electron");
const { registerIpcHandlers } = require("./services/ipc.cjs");
const { createWindow } = require("./services/window.cjs");

registerIpcHandlers();

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    const { BrowserWindow } = require("electron");
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
