const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

function getSessionPath() {
  return path.join(app.getPath("userData"), "session.json");
}

async function loadSession() {
  try {
    const raw = await fs.readFile(getSessionPath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function saveSession(session) {
  await fs.mkdir(path.dirname(getSessionPath()), { recursive: true });
  await fs.writeFile(getSessionPath(), JSON.stringify(session ?? null, null, 2), "utf8");
  return true;
}

async function clearSession() {
  await fs.rm(getSessionPath(), { force: true });
  return true;
}

module.exports = {
  clearSession,
  loadSession,
  saveSession,
};
