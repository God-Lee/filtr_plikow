const { app, dialog } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const { pathExists } = require("./fs-utils.cjs");

const execFileAsync = promisify(execFile);

function getDisciplineFolderLabel(folderName) {
  return String(folderName ?? "").replace(/^\d+\.\s*/, "");
}

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

async function getAvailableReportPath(folderPath, baseFileName) {
  const extension = path.extname(baseFileName);
  const baseName = path.basename(baseFileName, extension);
  let counter = 0;

  while (true) {
    const suffix = counter === 0 ? "" : ` (${counter})`;
    const candidatePath = path.join(folderPath, `${baseName}${suffix}${extension}`);
    if (!(await pathExists(candidatePath))) {
      return candidatePath;
    }

    counter += 1;
  }
}

async function exportInvalidFilesReport(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Brak błędnych plików do wyeksportowania.");
  }

  const targetFolder = await chooseDirectory("Gdzie chcesz zapisać raport?");
  if (!targetFolder) {
    return { saved: false, reportPath: null };
  }

  const reportRows = files
    .map((file) => {
      if (!file || typeof file.fileName !== "string" || typeof file.disciplineFolder !== "string") {
        throw new Error("Nieprawidłowe dane raportu.");
      }

      return {
        fileName: file.fileName,
        discipline: getDisciplineFolderLabel(file.disciplineFolder),
      };
    })
    .sort((left, right) => {
      const disciplineCompare = left.discipline.localeCompare(right.discipline, "pl");
      if (disciplineCompare !== 0) {
        return disciplineCompare;
      }

      return left.fileName.localeCompare(right.fileName, "pl");
    });

  const outputPath = await getAvailableReportPath(targetFolder, "Raport błędnych plików.xlsx");
  const tempDataPath = path.join(app.getPath("temp"), `invalid-files-report-${Date.now()}.json`);
  const scriptPath = path.join(__dirname, "..", "..", "scripts", "export-invalid-files-report.ps1");

  await fs.writeFile(tempDataPath, JSON.stringify(reportRows, null, 2), "utf8");

  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-OutputPath",
      outputPath,
      "-DataPath",
      tempDataPath,
    ]);
  } finally {
    await fs.rm(tempDataPath, { force: true });
  }

  return {
    saved: true,
    reportPath: outputPath,
  };
}

module.exports = {
  chooseDirectory,
  exportInvalidFilesReport,
};
