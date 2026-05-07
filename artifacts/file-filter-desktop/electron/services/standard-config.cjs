const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const bundledNamingStandards = require("../../shared/naming-standards.json");

const SECTION_KEYS = [
  "phases",
  "disciplines",
  "documentTypes",
  "levels",
  "revisions",
  "statuses",
];

const EDITABLE_SECTION_KEYS = [
  "phases",
  "disciplines",
  "documentTypes",
  "levels",
  "statuses",
];

const SECTION_LABELS = {
  phases: "Faza",
  disciplines: "Branża",
  documentTypes: "Typ",
  levels: "Poziom",
  revisions: "Rewizja",
  statuses: "Status",
};

const CODE_PATTERNS = {
  phases: /^[A-Z0-9]{2,4}$/,
  disciplines: /^[A-Z0-9]{2,4}$/,
  documentTypes: /^[A-Z0-9]{2,4}$/,
  levels: /^[A-Z0-9]{2,4}$/,
  revisions: /^[A-Z0-9]{3,4}$/,
  statuses: /^[A-Z0-9]{2,4}$/,
};

function getNamingStandardPath() {
  return path.join(app.getPath("userData"), "naming-standard.json");
}

function getNamingStandardBackupsPath() {
  return path.join(app.getPath("userData"), "naming-standard-history");
}

function normalizeLabel(label) {
  return String(label ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(code) {
  return String(code ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function sanitizeRevisionSection(value, fallback) {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const entries = Object.entries(value)
    .filter(([code, label]) => typeof code === "string" && typeof label === "string")
    .map(([code, label]) => [normalizeCode(code), normalizeLabel(label)])
    .filter(([code, label]) => code && label);

  if (entries.length === 0) {
    return { ...fallback };
  }

  return Object.fromEntries(entries);
}

function sanitizeEditableSection(value, fallback) {
  if (!value || typeof value !== "object") {
    return Object.fromEntries(
      Object.entries(fallback).map(([code, label]) => [code, { label, active: true }]),
    );
  }

  const entries = Object.entries(value)
    .map(([rawCode, rawValue]) => {
      const code = normalizeCode(rawCode);
      if (!code) {
        return null;
      }

      if (typeof rawValue === "string") {
        const label = normalizeLabel(rawValue);
        return label ? [code, { label, active: true }] : null;
      }

      if (!rawValue || typeof rawValue !== "object") {
        return null;
      }

      const label = normalizeLabel(rawValue.label);
      if (!label) {
        return null;
      }

      return [
        code,
        {
          label,
          active: rawValue.active !== false,
        },
      ];
    })
    .filter(Boolean);

  if (entries.length === 0) {
    return Object.fromEntries(
      Object.entries(fallback).map(([code, label]) => [code, { label, active: true }]),
    );
  }

  return Object.fromEntries(entries);
}

function sanitizeNamingStandardData(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    phases: sanitizeEditableSection(source.phases, bundledNamingStandards.phases),
    disciplines: sanitizeEditableSection(source.disciplines, bundledNamingStandards.disciplines),
    documentTypes: sanitizeEditableSection(source.documentTypes, bundledNamingStandards.documentTypes),
    levels: sanitizeEditableSection(source.levels, bundledNamingStandards.levels),
    revisions: sanitizeRevisionSection(source.revisions, bundledNamingStandards.revisions),
    statuses: sanitizeEditableSection(source.statuses, bundledNamingStandards.statuses),
  };
}

function projectEditableSection(section, mode) {
  return Object.fromEntries(
    Object.entries(section)
      .filter(([, entry]) => mode === "all" || entry.active)
      .map(([code, entry]) => [code, entry.label]),
  );
}

function buildProjectedValues(value, mode) {
  return {
    phases: projectEditableSection(value.phases, mode),
    disciplines: projectEditableSection(value.disciplines, mode),
    documentTypes: projectEditableSection(value.documentTypes, mode),
    levels: projectEditableSection(value.levels, mode),
    revisions: { ...value.revisions },
    statuses: projectEditableSection(value.statuses, mode),
  };
}

function buildConfig(source, values, targetPath = "", backupsPath = "") {
  const sanitizedValues = sanitizeNamingStandardData(values);

  return {
    path: targetPath,
    backupsPath,
    lastReportPath: "",
    source,
    values: sanitizedValues,
    activeValues: buildProjectedValues(sanitizedValues, "active"),
    allValues: buildProjectedValues(sanitizedValues, "all"),
  };
}

function getBundledNamingStandard() {
  return sanitizeNamingStandardData(bundledNamingStandards);
}

async function ensureNamingStandardFile() {
  const targetPath = getNamingStandardPath();
  const backupsPath = getNamingStandardBackupsPath();
  await fs.mkdir(backupsPath, { recursive: true });

  try {
    await fs.access(targetPath);
  } catch {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(getBundledNamingStandard(), null, 2), "utf8");
  }

  return targetPath;
}

function validateNamingStandardData(value) {
  const errors = [];

  for (const sectionKey of SECTION_KEYS) {
    const section = value[sectionKey] ?? {};
    const entries =
      sectionKey === "revisions"
        ? Object.entries(section)
        : Object.entries(section);

    if (
      EDITABLE_SECTION_KEYS.includes(sectionKey) &&
      entries.filter(([, entry]) => entry && typeof entry === "object" && entry.active).length === 0
    ) {
      errors.push(`${SECTION_LABELS[sectionKey]}: musi zostać przynajmniej jeden aktywny kod.`);
      continue;
    }

    for (const [code, entry] of entries) {
      if (!code) {
        errors.push(`${SECTION_LABELS[sectionKey]}: kod nie może być pusty.`);
        continue;
      }

      if (!CODE_PATTERNS[sectionKey].test(code)) {
        errors.push(`${SECTION_LABELS[sectionKey]}: kod "${code}" musi mieć 2-4 znaki alfanumeryczne.`);
      }

      if (sectionKey === "revisions") {
        if (!normalizeLabel(entry)) {
          errors.push(`${SECTION_LABELS[sectionKey]}: kod "${code}" musi mieć nazwę.`);
        }
        continue;
      }

      const label = normalizeLabel(entry?.label);
      if (!label) {
        errors.push(`${SECTION_LABELS[sectionKey]}: kod "${code}" musi mieć nazwę.`);
      }
    }
  }

  return errors;
}

function getBackupFileName() {
  const now = new Date();
  const timestamp = formatTimestampForFileName(now);

  return `naming-standard-${timestamp}.json`;
}

function getReportFileName(timestamp) {
  return `naming-standard-report-${timestamp}.txt`;
}

function formatTimestampForFileName(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "-",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
    "-",
    String(date.getMilliseconds()).padStart(3, "0"),
  ].join("");
}

function formatTimestampForReport(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-") + ` ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

async function writeBackupSnapshot(currentRaw, timestamp) {
  const backupsPath = getNamingStandardBackupsPath();
  await fs.mkdir(backupsPath, { recursive: true });
  const backupPath = path.join(backupsPath, `naming-standard-${timestamp}.json`);
  await fs.writeFile(backupPath, currentRaw, "utf8");
  return backupsPath;
}

function stripCodePrefix(label) {
  return String(label ?? "").replace(/^[A-Z0-9]+\s*-\s*/, "").trim();
}

function pushDetail(sectionGroups, sectionKey, message) {
  if (!sectionGroups.has(sectionKey)) {
    sectionGroups.set(sectionKey, []);
  }

  sectionGroups.get(sectionKey).push(message);
}

function buildChangeReport(previousValues, nextValues, targetPath, backupsPath, timestampDate) {
  const summary = {
    added: 0,
    changed: 0,
    deactivated: 0,
    restored: 0,
    removed: 0,
  };
  const sectionGroups = new Map();

  for (const sectionKey of SECTION_KEYS) {
    const previousSection = previousValues[sectionKey] ?? {};
    const nextSection = nextValues[sectionKey] ?? {};
    const codes = Array.from(new Set([...Object.keys(previousSection), ...Object.keys(nextSection)])).sort((left, right) =>
      left.localeCompare(right, "pl"),
    );

    for (const code of codes) {
      if (sectionKey === "revisions") {
        const previousLabel = previousSection[code];
        const nextLabel = nextSection[code];

        if (!previousLabel && nextLabel) {
          summary.added += 1;
          pushDetail(sectionGroups, sectionKey, `Dodano kod ${code}: ${stripCodePrefix(nextLabel)}.`);
        } else if (previousLabel && !nextLabel) {
          summary.removed += 1;
          pushDetail(sectionGroups, sectionKey, `Usunięto kod ${code}: ${stripCodePrefix(previousLabel)}.`);
        } else if (previousLabel && nextLabel && previousLabel !== nextLabel) {
          summary.changed += 1;
          pushDetail(
            sectionGroups,
            sectionKey,
            `Zmieniono nazwę kodu ${code}: "${stripCodePrefix(previousLabel)}" -> "${stripCodePrefix(nextLabel)}".`,
          );
        }

        continue;
      }

      const previousEntry = previousSection[code];
      const nextEntry = nextSection[code];

      if (!previousEntry && nextEntry) {
        summary.added += 1;
        pushDetail(
          sectionGroups,
          sectionKey,
          `Dodano kod ${code}: ${stripCodePrefix(nextEntry.label)}${nextEntry.active ? "." : " (nieaktywny)."}`,
        );
        continue;
      }

      if (previousEntry && !nextEntry) {
        summary.removed += 1;
        pushDetail(sectionGroups, sectionKey, `Usunięto kod ${code}: ${stripCodePrefix(previousEntry.label)}.`);
        continue;
      }

      if (!previousEntry || !nextEntry) {
        continue;
      }

      if (previousEntry.label !== nextEntry.label) {
        summary.changed += 1;
        pushDetail(
          sectionGroups,
          sectionKey,
          `Zmieniono nazwę kodu ${code}: "${stripCodePrefix(previousEntry.label)}" -> "${stripCodePrefix(nextEntry.label)}".`,
        );
      }

      if (previousEntry.active && !nextEntry.active) {
        summary.deactivated += 1;
        pushDetail(sectionGroups, sectionKey, `Dezaktywowano kod ${code}: ${stripCodePrefix(nextEntry.label)}.`);
      } else if (!previousEntry.active && nextEntry.active) {
        summary.restored += 1;
        pushDetail(sectionGroups, sectionKey, `Przywrócono kod ${code}: ${stripCodePrefix(nextEntry.label)}.`);
      }
    }
  }

  const detailLines = Array.from(sectionGroups.entries()).flatMap(([sectionKey, messages]) => [
    "",
    `[${SECTION_LABELS[sectionKey]}]`,
    ...messages.map((message) => `- ${message}`),
  ]);

  if (detailLines.length === 0) {
    detailLines.push("", "[Zmiany]", "- Brak różnic do zapisania.");
  }

  return [
    "Raport zmian standardu nazewnictwa",
    `Data zapisu: ${formatTimestampForReport(timestampDate)}`,
    `Plik standardu: ${targetPath}`,
    `Folder historii: ${backupsPath}`,
    "",
    "Podsumowanie:",
    `- Dodano: ${summary.added}`,
    `- Zmieniono: ${summary.changed}`,
    `- Dezaktywowano: ${summary.deactivated}`,
    `- Przywrócono: ${summary.restored}`,
    `- Usunięto: ${summary.removed}`,
    ...detailLines,
    "",
  ].join("\n");
}

async function writeChangeReport(reportContent, timestamp) {
  const backupsPath = getNamingStandardBackupsPath();
  await fs.mkdir(backupsPath, { recursive: true });
  const reportPath = path.join(backupsPath, getReportFileName(timestamp));
  await fs.writeFile(reportPath, reportContent, "utf8");
  return reportPath;
}

async function loadNamingStandard() {
  const targetPath = await ensureNamingStandardFile();
  const backupsPath = getNamingStandardBackupsPath();

  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return buildConfig("userData", JSON.parse(raw), targetPath, backupsPath);
  } catch {
    return buildConfig("bundled", getBundledNamingStandard(), targetPath, backupsPath);
  }
}

async function saveNamingStandard(nextValues) {
  const targetPath = await ensureNamingStandardFile();
  const backupsPath = getNamingStandardBackupsPath();
  const preparedValues = sanitizeNamingStandardData(nextValues);
  const validationErrors = validateNamingStandardData(preparedValues);

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join("\n"));
  }

  const currentRaw = await fs.readFile(targetPath, "utf8");
  const timestampDate = new Date();
  const timestamp = formatTimestampForFileName(timestampDate);
  let previousValues = getBundledNamingStandard();

  try {
    previousValues = sanitizeNamingStandardData(JSON.parse(currentRaw));
  } catch {
    previousValues = getBundledNamingStandard();
  }

  const reportContent = buildChangeReport(previousValues, preparedValues, targetPath, backupsPath, timestampDate);
  await writeBackupSnapshot(currentRaw, timestamp);

  try {
    await fs.writeFile(targetPath, JSON.stringify(preparedValues, null, 2), "utf8");
    const reportPath = await writeChangeReport(reportContent, timestamp);
    return {
      ...buildConfig("userData", preparedValues, targetPath, backupsPath),
      lastReportPath: reportPath,
    };
  } catch (error) {
    await fs.writeFile(targetPath, currentRaw, "utf8").catch(() => undefined);
    throw error;
  }
}

module.exports = {
  EDITABLE_SECTION_KEYS,
  SECTION_KEYS,
  buildProjectedValues,
  ensureNamingStandardFile,
  getBundledNamingStandard,
  getNamingStandardBackupsPath,
  getNamingStandardPath,
  loadNamingStandard,
  saveNamingStandard,
  sanitizeNamingStandardData,
};
