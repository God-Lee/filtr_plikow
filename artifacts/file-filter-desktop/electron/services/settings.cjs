const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

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
  ).slice(0, 5);
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
    };
  } catch {
    return {
      projectsRoot: "",
      favoriteProjects: [],
      namingViewDraft: getDefaultNamingViewDraft(),
    };
  }
}

async function saveSettings(settings) {
  const nextSettings = {
    projectsRoot: typeof settings.projectsRoot === "string" ? settings.projectsRoot : "",
    favoriteProjects: sanitizeFavoriteProjects(settings.favoriteProjects),
    namingViewDraft: sanitizeNamingViewDraft(settings.namingViewDraft),
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
};
