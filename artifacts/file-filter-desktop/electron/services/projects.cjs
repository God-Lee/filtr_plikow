const fs = require("node:fs/promises");
const path = require("node:path");
const { directoryExists } = require("./fs-utils.cjs");
const { loadNamingStandard } = require("./standard-config.cjs");

const SOURCE_FOLDERS = [
  { key: "PDF", folderName: "3. PDF", displayLabel: "PDF" },
  { key: "EDT", folderName: "2. EDT", displayLabel: "Pozostałe" },
];

const DISCIPLINE_FOLDERS = [
  "1. Architektura",
  "2. Sanitarna",
  "3. Elektryczna",
  "4. Konstrukcyjna",
  "5. Drogowa",
  "6. Koordynacja",
];

const IGNORED_EXTENSIONS = new Set([".bak", ".dwl", ".dwl2", ".log", ".pat", ".pcp"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

const SEGMENT_RULES = [
  /^\d{5}$/,
  /^[A-Z0-9]{2,4}$/,
  /^[A-Z0-9]{1,4}$/,
  /^[A-Z0-9]{2,5}$/,
  /^[A-Z0-9]{1,4}$/,
  /^[A-Z]\d{2}$/,
  /^[A-Z][A-Z0-9]{2,3}$/,
  /^[A-Z][A-Z0-9]{1,3}$/,
];

const SEGMENT_KEYS = [
  "projectNumber",
  "phase",
  "disciplineCode",
  "documentType",
  "level",
  "drawingNumber",
  "revision",
  "status",
];

const SEGMENT_DISPLAY_NAMES = {
  projectNumber: "Numer projektu",
  phase: "Faza",
  disciplineCode: "Branża",
  documentType: "Typ",
  level: "Poziom",
  drawingNumber: "Numer",
  revision: "Rewizja",
  status: "Status",
};

function buildAllowedSegmentValues(namingStandards) {
  return {
    phase: new Set(Object.keys(namingStandards.phases)),
    disciplineCode: new Set(Object.keys(namingStandards.disciplines)),
    documentType: new Set(Object.keys(namingStandards.documentTypes)),
    level: new Set(Object.keys(namingStandards.levels)),
    status: new Set(Object.keys(namingStandards.statuses)),
  };
}

async function listProjects(projectsRoot) {
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "pl"));
}

function getProjectNumber(projectName) {
  const match = /^(\d{5})/.exec(projectName);
  return match ? match[1] : null;
}

function isDrawingNumberValidForDiscipline(disciplineCode, drawingNumber) {
  const disciplinePrefix = disciplineCode?.[0];
  const drawingPrefix = drawingNumber?.[0];

  if (!disciplinePrefix || !drawingPrefix) {
    return false;
  }

  return drawingPrefix === "X" || drawingPrefix === disciplinePrefix;
}

function isRevisionCodeValid(revision) {
  return /^R\d{2}$/.test(revision ?? "") || (/^W\d{2}$/.test(revision ?? "") && revision !== "W00");
}

function buildParsedSegments(segments, invalidSegmentKey) {
  return Object.fromEntries(
    SEGMENT_KEYS.map((key, index) => [key, key === invalidSegmentKey ? null : (segments[index] ?? null)]),
  );
}

function summarizeSegmentIssues(segmentIssues) {
  return `Błędy w segmentach:\n${Array.from(segmentIssues.entries())
    .map(([segmentKey, issue]) => `- ${SEGMENT_DISPLAY_NAMES[segmentKey]} (${issue})`)
    .join("\n")}`;
}

function parseFileName(filename, projectNumber, allowedSegmentValues) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  const segments = baseName.split("-").map((segment) => segment.trim());
  const parsedSegments = buildParsedSegments(segments);

  if (segments.length !== SEGMENT_RULES.length) {
    return {
      isValid: false,
      invalidReason: `Oczekiwano ${SEGMENT_RULES.length} segmentów oddzielonych '-'`,
      baseName,
      extension,
      rawSegments: segments,
      parsedSegments,
    };
  }

  const segmentIssues = new Map();

  for (let index = 0; index < SEGMENT_RULES.length; index += 1) {
    const value = segments[index]?.trim() ?? "";
    if (!value || !SEGMENT_RULES[index].test(value)) {
      const segmentKey = SEGMENT_KEYS[index];
      segmentIssues.set(segmentKey, "ma nieprawidłowy format");
    }
  }

  if (projectNumber && segments[0] !== projectNumber) {
    segmentIssues.set("projectNumber", "nie zgadza się z wybranym projektem");
  }

  for (const [segmentKey, allowedValues] of Object.entries(allowedSegmentValues)) {
    if (segmentIssues.has(segmentKey)) {
      continue;
    }

    if (!allowedValues.has(parsedSegments[segmentKey])) {
      segmentIssues.set(segmentKey, "ma nieznaną wartość");
    }
  }

  if (!segmentIssues.has("revision") && !isRevisionCodeValid(parsedSegments.revision)) {
    segmentIssues.set("revision", "ma nieprawidłowy format");
  }

  if (
    !segmentIssues.has("disciplineCode") &&
    !segmentIssues.has("drawingNumber") &&
    !isDrawingNumberValidForDiscipline(parsedSegments.disciplineCode, parsedSegments.drawingNumber)
  ) {
    segmentIssues.set("drawingNumber", "musi zaczynać się od pierwszej litery branży albo od X");
  }

  if (segmentIssues.size === 1) {
    const [[segmentKey, issue]] = Array.from(segmentIssues.entries());
    return {
      isValid: false,
      invalidReason: `Segment „${SEGMENT_DISPLAY_NAMES[segmentKey]}” ${issue}`,
      baseName,
      extension,
      rawSegments: segments,
      parsedSegments: buildParsedSegments(segments, segmentKey),
    };
  }

  if (segmentIssues.size > 1) {
    return {
      isValid: false,
      invalidReason: summarizeSegmentIssues(segmentIssues),
      baseName,
      extension,
      rawSegments: segments,
      parsedSegments: null,
    };
  }

  return {
    isValid: true,
    invalidReason: null,
    baseName,
    extension,
    rawSegments: segments,
    parsedSegments,
  };
}

function buildMislocatedImageResult(filename) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);

  return {
    isValid: false,
    invalidReason: "Błędna lokalizacja",
    baseName,
    extension,
    rawSegments: [baseName],
    parsedSegments: null,
  };
}

function getFileCreatedAt(stats) {
  return stats.birthtimeMs > 0 ? stats.birthtime : stats.ctime;
}

async function scanProject(projectsRoot, projectName) {
  if (!projectsRoot) {
    throw new Error("Najpierw wybierz folder ESP - Realizacje.");
  }

  const projectPath = path.join(projectsRoot, projectName);
  const projectNumber = getProjectNumber(projectName);
  const projectDesignPath = path.join(projectPath, "4. Projektowanie");
  const namingStandardConfig = await loadNamingStandard();
  const allowedSegmentValues = buildAllowedSegmentValues(namingStandardConfig.activeValues);

  const results = [];
  const missingFolders = [];

  for (const source of SOURCE_FOLDERS) {
    for (const disciplineFolder of DISCIPLINE_FOLDERS) {
      const scanPath = path.join(projectDesignPath, source.folderName, disciplineFolder);

      if (!(await directoryExists(scanPath))) {
        missingFolders.push(scanPath);
        continue;
      }

      let entries = [];
      try {
        entries = await fs.readdir(scanPath, { withFileTypes: true });
      } catch {
        missingFolders.push(scanPath);
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        const absolutePath = path.join(scanPath, entry.name);
        const extension = path.extname(entry.name).toLowerCase();
        if (IGNORED_EXTENSIONS.has(extension)) {
          continue;
        }

        let fileStats;
        try {
          fileStats = await fs.stat(absolutePath);
        } catch {
          continue;
        }

        const parsed = IMAGE_EXTENSIONS.has(extension)
          ? buildMislocatedImageResult(entry.name)
          : parseFileName(entry.name, projectNumber, allowedSegmentValues);

        results.push({
          id: absolutePath,
          fileName: entry.name,
          absolutePath,
          folderPath: scanPath,
          createdAt: getFileCreatedAt(fileStats).toISOString(),
          modifiedAt: fileStats.mtime.toISOString(),
          projectName,
          projectNumber: projectNumber ?? "",
          sourceKey: source.key,
          sourceLabel: source.displayLabel,
          disciplineFolder,
          extension: parsed.extension.toLowerCase(),
          extensionLabel: parsed.extension || "(brak)",
          baseName: parsed.baseName,
          isValid: parsed.isValid,
          invalidReason: parsed.invalidReason,
          rawSegments: parsed.rawSegments,
          parsedSegments: parsed.parsedSegments ?? null,
        });
      }
    }
  }

  results.sort((left, right) => left.fileName.localeCompare(right.fileName, "pl"));

  return {
    projectName,
    projectPath,
    scannedAt: new Date().toISOString(),
    totalFiles: results.length,
    validCount: results.filter((file) => file.isValid).length,
    invalidCount: results.filter((file) => !file.isValid).length,
    missingFolders,
    files: results,
  };
}

module.exports = {
  listProjects,
  scanProject,
};
