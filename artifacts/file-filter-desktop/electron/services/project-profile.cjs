const { dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { loadNamingStandard } = require("./standard-config.cjs");

function toOptionList(values) {
  return Object.entries(values ?? {}).map(([code, label]) => ({
    code,
    label,
  }));
}

function getProjectDisplayName(projectName, projectNumber) {
  const [, labelFromUnderscore] = String(projectName ?? "").split("_");
  return labelFromUnderscore?.trim() || String(projectName ?? "").replace(projectNumber, "").replace(/^[_\s-]+/, "").trim() || projectNumber;
}

function buildDefaultValues(namingStandardVersion) {
  return {
    phase: "",
    discipline: "",
    documentType: "",
    building: namingStandardVersion === 4 ? "A" : "",
    level: "",
    revision: "R00",
    status: "",
  };
}

function buildBuildings(namingStandardVersion) {
  if (namingStandardVersion === 3) {
    return [];
  }

  return [
    ...Array.from("ABCDEFGHI", (code) => ({
      code,
      label: code === "A" ? "Budynek domyślny" : `Budynek ${code}`,
    })),
    {
      code: "X",
      label: "Wiele budynków",
    },
  ];
}

async function exportProjectProfile(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Brak danych projektu do profilu.");
  }

  const projectNumber = String(input.projectNumber ?? "").trim();
  const projectName = String(input.projectName ?? "").trim();
  const namingStandardVersion = Number(input.namingStandardVersion);

  if (!/^\d{5}$/.test(projectNumber)) {
    throw new Error("Projekt nie ma poprawnego pięciocyfrowego numeru.");
  }

  if (namingStandardVersion !== 3 && namingStandardVersion !== 4) {
    throw new Error("Projekt nie ma poprawnej wersji standardu v3/v4.");
  }

  const standardConfig = await loadNamingStandard();
  const values = standardConfig.activeValues;
  const profile = {
    schemaVersion: 1,
    profileId: `${projectNumber}-v${namingStandardVersion}`,
    projectNumber,
    projectName: getProjectDisplayName(projectName, projectNumber),
    namingStandardVersion,
    allowedValues: {
      phases: toOptionList(values.phases),
      disciplines: toOptionList(values.disciplines),
      documentTypes: toOptionList(values.documentTypes),
      levels: toOptionList(values.levels),
      statuses: toOptionList(values.statuses),
      buildings: buildBuildings(namingStandardVersion),
    },
    defaults: buildDefaultValues(namingStandardVersion),
    exportedAt: new Date().toISOString(),
  };

  const selected = await dialog.showSaveDialog({
    title: "Zapisz profil projektu dla Plikonazywacza",
    defaultPath: `${projectNumber}-profil-plikonazywacz.json`,
    filters: [{ name: "Profil projektu JSON", extensions: ["json"] }],
  });

  if (selected.canceled || !selected.filePath) {
    return { saved: false, profilePath: null };
  }

  await fs.mkdir(path.dirname(selected.filePath), { recursive: true });
  await fs.writeFile(selected.filePath, JSON.stringify(profile, null, 2), "utf8");

  return {
    saved: true,
    profilePath: selected.filePath,
  };
}

module.exports = {
  exportProjectProfile,
};
