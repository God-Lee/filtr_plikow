const { dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

async function chooseDirectory(title) {
  const selected = await dialog.showOpenDialog({
    title,
    properties: ["openDirectory"],
  });

  if (selected.canceled || selected.filePaths.length === 0) {
    return null;
  }

  return selected.filePaths[0];
}

function getBucketForFileName(fileName) {
  return path.extname(fileName).toLowerCase() === ".pdf" ? "PDF" : "EDT";
}

function sanitizeFolderSegment(value) {
  return String(value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function buildProjectFolderName(projectNumber, projectName) {
  const number = sanitizeFolderSegment(projectNumber);
  const name = sanitizeFolderSegment(projectName);
  return name && name !== number ? `${number} ${name}` : number;
}

async function walkWorkspace(rootPath, currentPath, files, skipped) {
  let entries = [];
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch {
    skipped.unreadable += 1;
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walkWorkspace(rootPath, absolutePath, files, skipped);
        return;
      }

      if (!entry.isFile()) {
        return;
      }

      let stats;
      try {
        stats = await fs.stat(absolutePath);
      } catch {
        skipped.unreadable += 1;
        return;
      }

      if (stats.size > MAX_FILE_SIZE_BYTES) {
        skipped.oversized += 1;
        return;
      }

      const relativePath = path.relative(rootPath, absolutePath) || entry.name;
      files.push({
        id: absolutePath,
        fileName: entry.name,
        absolutePath,
        relativePath,
        extension: path.extname(entry.name).toLowerCase(),
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        bucket: getBucketForFileName(entry.name),
      });
    }),
  );
}

async function listWorkspaceFiles(folderPath) {
  if (!folderPath) {
    return { files: [], skippedOversized: 0, skippedUnreadable: 0 };
  }

  let stats;
  try {
    stats = await fs.stat(folderPath);
  } catch {
    throw new Error("Wybrany folder roboczy nie istnieje.");
  }

  if (!stats.isDirectory()) {
    throw new Error("Wybrana ścieżka nie jest folderem.");
  }

  const files = [];
  const skipped = { oversized: 0, unreadable: 0 };
  await walkWorkspace(folderPath, folderPath, files, skipped);

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "pl", { numeric: true }));

  return {
    files,
    skippedOversized: skipped.oversized,
    skippedUnreadable: skipped.unreadable,
  };
}

function buildTargetPath(outputRoot, item) {
  const projectFolder = buildProjectFolderName(item.projectNumber, item.projectName);
  const bucketFolder = item.bucket === "PDF" ? "3. PDF" : "2. EDT";
  return path.join(outputRoot, projectFolder, bucketFolder, item.targetFileName);
}

function validateExportItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Brak plików zaznaczonych do eksportu.");
  }

  for (const item of items) {
    if (
      !item ||
      typeof item.sourcePath !== "string" ||
      typeof item.targetFileName !== "string" ||
      typeof item.projectNumber !== "string" ||
      typeof item.projectName !== "string" ||
      (item.bucket !== "PDF" && item.bucket !== "EDT")
    ) {
      throw new Error("Nieprawidłowe dane eksportu.");
    }
  }
}

async function checkExportTargets(outputRoot, items) {
  if (!outputRoot) {
    throw new Error("Najpierw wybierz folder docelowy.");
  }

  validateExportItems(items);

  const existingTargets = [];
  for (const item of items) {
    const targetPath = buildTargetPath(outputRoot, item);
    try {
      await fs.access(targetPath);
      existingTargets.push({
        targetPath,
        targetFileName: item.targetFileName,
        projectNumber: item.projectNumber,
        bucket: item.bucket,
      });
    } catch {
      // Plik nie istnieje, można eksportować bez nadpisania.
    }
  }

  return existingTargets;
}

async function exportFiles(outputRoot, items, overwriteExisting) {
  if (!outputRoot) {
    throw new Error("Najpierw wybierz folder docelowy.");
  }

  validateExportItems(items);

  const seenTargets = new Set();
  for (const item of items) {
    const targetPath = buildTargetPath(outputRoot, item);
    const targetKey = targetPath.toLocaleLowerCase("pl");
    if (seenTargets.has(targetKey)) {
      throw new Error(`W eksporcie występuje zduplikowana nazwa docelowa: ${item.targetFileName}`);
    }

    seenTargets.add(targetKey);
  }

  let copiedCount = 0;
  for (const item of items) {
    const targetPath = buildTargetPath(outputRoot, item);
    if (!overwriteExisting) {
      try {
        await fs.access(targetPath);
        throw new Error(`Plik docelowy już istnieje: ${targetPath}`);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(item.sourcePath, targetPath);
    copiedCount += 1;
  }

  return {
    copiedCount,
    outputRoot,
  };
}

module.exports = {
  checkExportTargets,
  chooseDirectory,
  exportFiles,
  listWorkspaceFiles,
};
