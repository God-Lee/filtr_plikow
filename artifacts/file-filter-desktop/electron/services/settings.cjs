const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const LEGACY_TEMPLATE_FIELD_KEYS = new Set([
  "alias",
  "project",
  "projectNumber",
  "phase",
  "discipline",
  "type",
  "level",
  "number",
  "revision",
  "status",
]);

const SYSTEM_TEMPLATE_FIELD_KEYS = new Set([
  "project",
  "projectNumber",
  "phase",
  "discipline",
  "type",
  "level",
  "number",
  "revision",
  "status",
]);

const MAX_FAVORITE_PROJECTS = 10;

function createTemplateFieldId() {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeTemplateField(field, aliasValue) {
  if (typeof field === "string") {
    if (!LEGACY_TEMPLATE_FIELD_KEYS.has(field)) {
      return null;
    }

    if (field === "alias") {
      const value = typeof aliasValue === "string" ? aliasValue.trim() : "";
      if (!value) {
        return null;
      }

      return {
        id: createTemplateFieldId(),
        kind: "custom",
        label: "Alias",
        value,
      };
    }

    return {
      id: createTemplateFieldId(),
      kind: "system",
      key: field,
    };
  }

  if (!field || typeof field !== "object") {
    return null;
  }

  if (field.kind === "system" && typeof field.key === "string" && SYSTEM_TEMPLATE_FIELD_KEYS.has(field.key)) {
    const id =
      typeof field.id === "string" && field.id.trim().length > 0 ? field.id.trim() : createTemplateFieldId();

    return {
      id,
      kind: "system",
      key: field.key,
    };
  }

  if (field.kind === "custom") {
    const label = typeof field.label === "string" ? field.label.trim() : "";
    const value = typeof field.value === "string" ? field.value : "";
    if (!label || !value.trim()) {
      return null;
    }

    const id =
      typeof field.id === "string" && field.id.trim().length > 0 ? field.id.trim() : createTemplateFieldId();

    return {
      id,
      kind: "custom",
      label,
      value,
    };
  }

  return null;
}

function getDefaultNamingViewDraft() {
  return {
    projectNumber: "",
    phaseInput: "",
    disciplineInput: "",
    defaultRevision: "",
    defaultRevisionInput: "",
    defaultStatus: "",
    workingFolder: "",
    targetFolder: "",
    ignoredSourcePathsByFolder: {},
  };
}

function sanitizeDecodingTemplates(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set();

  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const idSource = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `template-${index}`;
      const id = seenIds.has(idSource) ? `${idSource}-${index}` : idSource;
      seenIds.add(id);

      const fields = Array.isArray(item.fields)
        ? item.fields
            .map((field) => sanitizeTemplateField(field, item.alias))
            .filter(Boolean)
        : [];

      return {
        id,
        name: typeof item.name === "string" ? item.name.trim() : "",
        prefix: typeof item.prefix === "string" ? item.prefix : "",
        suffix: typeof item.suffix === "string" ? item.suffix : "",
        separator: typeof item.separator === "string" ? item.separator.slice(0, 1) : "",
        fields,
      };
    })
    .filter((item) => item.name && item.fields.length > 0);
}

function sanitizeNamingViewDraft(value) {
  if (!value || typeof value !== "object") {
    return getDefaultNamingViewDraft();
  }

  const ignoredSourcePathsByFolder =
    value.ignoredSourcePathsByFolder && typeof value.ignoredSourcePathsByFolder === "object"
      ? Object.fromEntries(
          Object.entries(value.ignoredSourcePathsByFolder)
            .filter(([folderPath, paths]) => typeof folderPath === "string" && Array.isArray(paths))
            .map(([folderPath, paths]) => [
              folderPath,
              Array.from(
                new Set(
                  paths.filter((targetPath) => typeof targetPath === "string" && targetPath.trim().length > 0),
                ),
              ),
            ]),
        )
      : {};

  return {
    projectNumber: typeof value.projectNumber === "string" ? value.projectNumber : "",
    phaseInput: typeof value.phaseInput === "string" ? value.phaseInput : "",
    disciplineInput: typeof value.disciplineInput === "string" ? value.disciplineInput : "",
    defaultRevision: typeof value.defaultRevision === "string" ? value.defaultRevision : "",
    defaultRevisionInput: typeof value.defaultRevisionInput === "string" ? value.defaultRevisionInput : "",
    defaultStatus: typeof value.defaultStatus === "string" ? value.defaultStatus : "",
    workingFolder: typeof value.workingFolder === "string" ? value.workingFolder : "",
    targetFolder: typeof value.targetFolder === "string" ? value.targetFolder : "",
    ignoredSourcePathsByFolder,
  };
}

function sanitizeFavoriteProjects(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((projectName) => typeof projectName === "string" && projectName.trim().length > 0)),
  ).slice(0, MAX_FAVORITE_PROJECTS);
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      projectsRoot: typeof parsed.projectsRoot === "string" ? parsed.projectsRoot : "",
      favoriteProjects: sanitizeFavoriteProjects(parsed.favoriteProjects),
      namingViewDraft: sanitizeNamingViewDraft(parsed.namingViewDraft),
      decodingTemplates: sanitizeDecodingTemplates(parsed.decodingTemplates),
    };
  } catch {
    return {
      projectsRoot: "",
      favoriteProjects: [],
      namingViewDraft: getDefaultNamingViewDraft(),
      decodingTemplates: [],
    };
  }
}

async function saveSettings(settings) {
  const nextSettings = {
    projectsRoot: typeof settings.projectsRoot === "string" ? settings.projectsRoot : "",
    favoriteProjects: sanitizeFavoriteProjects(settings.favoriteProjects),
    namingViewDraft: sanitizeNamingViewDraft(settings.namingViewDraft),
    decodingTemplates: sanitizeDecodingTemplates(settings.decodingTemplates),
  };

  await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(nextSettings, null, 2), "utf8");
  return nextSettings;
}

module.exports = {
  loadSettings,
  saveSettings,
  sanitizeFavoriteProjects,
  sanitizeNamingViewDraft,
  sanitizeDecodingTemplates,
};
