const { dialog } = require("electron");
const fs = require("node:fs/promises");

const SECTION_KEYS = ["phases", "disciplines", "documentTypes", "levels", "statuses"];

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeLabel(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeOptionList(value, sectionLabel) {
  if (!Array.isArray(value)) {
    throw new Error(`Profil ma niepoprawną sekcję "${sectionLabel}".`);
  }

  const seenCodes = new Set();
  const options = [];

  for (const item of value) {
    const code = normalizeCode(item?.code);
    const label = normalizeLabel(item?.label);
    if (!code || !label || seenCodes.has(code)) {
      continue;
    }

    seenCodes.add(code);
    options.push({ code, label });
  }

  if (options.length === 0) {
    throw new Error(`Profil nie zawiera dostępnych wartości w sekcji "${sectionLabel}".`);
  }

  return options;
}

function sanitizeBuildings(value, namingStandardVersion) {
  if (namingStandardVersion === 3) {
    return [];
  }

  const rawBuildings = Array.isArray(value) && value.length > 0
    ? value
    : Array.from("ABCDEFGHI", (code) => ({
        code,
        label: code === "A" ? "Budynek domyślny" : `Budynek ${code}`,
      }));

  return sanitizeOptionList(rawBuildings, "buildings").filter((option) => /^(?:[A-I]|X)$/.test(option.code));
}

function sanitizeDefaults(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    phase: normalizeCode(source.phase),
    discipline: normalizeCode(source.discipline),
    documentType: normalizeCode(source.documentType),
    building: normalizeCode(source.building),
    level: normalizeCode(source.level),
    revision: normalizeCode(source.revision),
    status: normalizeCode(source.status),
  };
}

function sanitizeProfile(value, sourcePath) {
  if (!value || typeof value !== "object") {
    throw new Error("Wybrany plik nie jest poprawnym profilem projektu.");
  }

  const projectNumber = normalizeCode(value.projectNumber);
  const projectName = normalizeLabel(value.projectName);
  const namingStandardVersion = Number(value.namingStandardVersion);

  if (!/^\d{5}$/.test(projectNumber)) {
    throw new Error("Profil musi zawierać pięciocyfrowy numer projektu.");
  }

  if (namingStandardVersion !== 3 && namingStandardVersion !== 4) {
    throw new Error("Profil musi wskazywać wersję standardu: 3 albo 4.");
  }

  const allowedValues = {};
  const sourceAllowedValues = value.allowedValues && typeof value.allowedValues === "object" ? value.allowedValues : {};
  for (const sectionKey of SECTION_KEYS) {
    allowedValues[sectionKey] = sanitizeOptionList(sourceAllowedValues[sectionKey], sectionKey);
  }

  allowedValues.buildings = sanitizeBuildings(sourceAllowedValues.buildings, namingStandardVersion);

  return {
    schemaVersion: 1,
    profileId: normalizeLabel(value.profileId) || projectNumber,
    projectNumber,
    projectName: projectName || projectNumber,
    namingStandardVersion,
    allowedValues,
    defaults: sanitizeDefaults(value.defaults),
    sourcePath,
    importedAt: new Date().toISOString(),
  };
}

async function importProjectProfile() {
  const selected = await dialog.showOpenDialog({
    title: "Wybierz profil projektu JSON",
    filters: [{ name: "Profile projektu", extensions: ["json"] }],
    properties: ["openFile"],
  });

  if (selected.canceled || selected.filePaths.length === 0) {
    return null;
  }

  const profilePath = selected.filePaths[0];
  const raw = await fs.readFile(profilePath, "utf8");
  return sanitizeProfile(JSON.parse(raw), profilePath);
}

module.exports = {
  importProjectProfile,
};
