const fs = require("node:fs/promises");
const { constants: fsConstants } = require("node:fs");

async function directoryExists(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  directoryExists,
  pathExists,
};
