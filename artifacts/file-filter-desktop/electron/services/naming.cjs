const fs = require("node:fs/promises");
const path = require("node:path");
const { directoryExists, pathExists } = require("./fs-utils.cjs");

const NAMING_SUPPORTED_EXTENSIONS = new Set([".doc", ".docx", ".dwg", ".pdf", ".xls", ".xlsx"]);

async function listDirectoryFiles(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(folderPath, entry.name);
    if (!entry.isFile()) {
      continue;
    }

    files.push({
      fileName: entry.name,
      absolutePath,
      folderPath,
      relativePath: entry.name,
      extension: path.extname(entry.name).toLowerCase(),
      baseName: path.basename(entry.name, path.extname(entry.name)),
    });
  }

  return files;
}

async function listNamingFiles(folderPath) {
  if (!folderPath) {
    return { files: [], ignoredCount: 0, totalCount: 0 };
  }

  if (!(await directoryExists(folderPath))) {
    throw new Error("Wybrany folder nie istnieje.");
  }

  const allFiles = await listDirectoryFiles(folderPath);
  const supportedFiles = allFiles
    .filter((file) => NAMING_SUPPORTED_EXTENSIONS.has(file.extension))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, "pl", { numeric: true }));

  return {
    files: supportedFiles.map((file) => ({
      id: file.absolutePath,
      ...file,
    })),
    ignoredCount: allFiles.length - supportedFiles.length,
    totalCount: allFiles.length,
  };
}

async function copyNamingFiles(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { copiedCount: 0 };
  }

  for (const item of items) {
    if (
      !item ||
      typeof item.sourcePath !== "string" ||
      typeof item.targetPath !== "string" ||
      item.sourcePath.trim().length === 0 ||
      item.targetPath.trim().length === 0
    ) {
      throw new Error("Nieprawidłowe dane plików do skopiowania.");
    }
  }

  const seenTargets = new Set();
  for (const item of items) {
    if (seenTargets.has(item.targetPath)) {
      throw new Error(`W partii kopiowania występuje zduplikowany plik docelowy: ${item.targetPath}`);
    }

    seenTargets.add(item.targetPath);
  }

  for (const item of items) {
    if (!item.overwriteExisting && (await pathExists(item.targetPath))) {
      throw new Error(`Plik docelowy już istnieje: ${path.basename(item.targetPath)}`);
    }
  }

  for (const item of items) {
    await fs.mkdir(path.dirname(item.targetPath), { recursive: true });
    await fs.copyFile(item.sourcePath, item.targetPath);
  }

  return { copiedCount: items.length };
}

module.exports = {
  copyNamingFiles,
  listNamingFiles,
};
