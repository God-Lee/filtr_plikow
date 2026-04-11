const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const namingStandards = require("../../shared/naming-standards.json");

const SECTION_KEYS = ["projects", "phases", "disciplines", "documentTypes", "levels", "statuses"];

const LEVEL_DEFAULTS = {
  P0: "parteru",
  P1: "1 piętra",
  P2: "2 piętra",
  M0: "półpiętra nad parterem",
  M1: "półpiętra nad 1 piętrem",
  D0: "dachu",
  B1: "poziomu -1",
  B2: "poziomu -2",
  XX: "",
};

const DOCUMENT_TYPE_DEFAULTS = {
  CSE: "przekrój",
  DET: "detal",
  ELE: "elewacja",
  MAP: "mapa",
  OPP: "opis projektu",
  OPZ: "opis PZT",
  PZT: "PZT",
  RFU: "rzut fundamentów",
  ROG: "rzut",
  RPO: "rzut posadzek",
  RSU: "rzut sufitów",
  SCH: "schemat",
  VIS: "wizualizacja",
  ZSD: "zestawienie drzwi",
  ZSO: "zestawienie okien",
  ZST: "zestawienie",
  ZSW: "zestawienie witryn",
};

function stripCodePrefix(label) {
  return String(label ?? "").replace(/^[A-Z0-9]+\s*-\s*/, "").trim();
}

function getDecodingDictionaryPath() {
  return path.join(app.getPath("userData"), "odkodowanie-slownik.txt");
}

function buildSectionLines(title, values) {
  const lines = [`[${title}]`];
  for (const [code, label] of Object.entries(values)) {
    lines.push(`${code} = ${label}`);
  }

  lines.push("");
  return lines;
}

function buildDefaultDictionaryContent() {
  const phaseDefaults = Object.fromEntries(
    Object.entries(namingStandards.phases).map(([code, label]) => [code, stripCodePrefix(label)]),
  );
  const disciplineDefaults = Object.fromEntries(
    Object.entries(namingStandards.disciplines).map(([code, label]) => [code, stripCodePrefix(label)]),
  );
  const documentTypeDefaults = Object.fromEntries(
    Object.entries(namingStandards.documentTypes).map(([code, label]) => [
      code,
      DOCUMENT_TYPE_DEFAULTS[code] ?? stripCodePrefix(label).toLocaleLowerCase("pl"),
    ]),
  );
  const levelDefaults = Object.fromEntries(
    Object.entries(namingStandards.levels).map(([code, label]) => [
      code,
      Object.prototype.hasOwnProperty.call(LEVEL_DEFAULTS, code)
        ? LEVEL_DEFAULTS[code]
        : stripCodePrefix(label).toLocaleLowerCase("pl"),
    ]),
  );
  const statusDefaults = Object.fromEntries(
    Object.entries(namingStandards.statuses).map(([code, label]) => [code, stripCodePrefix(label)]),
  );

  return [
    "# Slownik tlumaczen dla modulu Odkodowanie",
    "#",
    "# Jak edytowac:",
    "# 1. Kazda sekcja ma format [nazwa]",
    "# 2. Kazda linia ponizej to: KOD = tlumaczenie",
    "# 3. Pusta wartosc po '=' oznacza: pomin ten element w nazwie",
    "# 4. Po zapisaniu zmian wroc do aplikacji i kliknij 'Odswiez slownik'",
    "#",
    ...buildSectionLines("projects", {
      "25147": "Reda",
    }),
    ...buildSectionLines("phases", phaseDefaults),
    ...buildSectionLines("disciplines", disciplineDefaults),
    ...buildSectionLines("documentTypes", documentTypeDefaults),
    ...buildSectionLines("levels", levelDefaults),
    ...buildSectionLines("statuses", statusDefaults),
  ].join("\n");
}

async function ensureDictionaryFile() {
  const targetPath = getDecodingDictionaryPath();

  try {
    await fs.access(targetPath);
  } catch {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, buildDefaultDictionaryContent(), "utf8");
  }

  return targetPath;
}

function getEmptyDictionary() {
  return {
    projects: {},
    phases: {},
    disciplines: {},
    documentTypes: {},
    levels: {},
    statuses: {},
  };
}

function parseDictionaryContent(content) {
  const dictionary = getEmptyDictionary();
  let currentSection = "";

  for (const rawLine of String(content ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = /^\[([a-zA-Z]+)\]$/.exec(line);
    if (sectionMatch) {
      const sectionKey = sectionMatch[1];
      currentSection = SECTION_KEYS.includes(sectionKey) ? sectionKey : "";
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const code = line.slice(0, separatorIndex).trim().toUpperCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (!code) {
      continue;
    }

    dictionary[currentSection][code] = value;
  }

  return dictionary;
}

async function loadDecodingDictionary() {
  const filePath = await ensureDictionaryFile();
  const raw = await fs.readFile(filePath, "utf8");

  return {
    path: filePath,
    values: parseDictionaryContent(raw),
  };
}

module.exports = {
  getDecodingDictionaryPath,
  loadDecodingDictionary,
};
