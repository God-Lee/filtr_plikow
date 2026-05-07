import { useSyncExternalStore } from "react";
import bundledNamingStandards from "../../shared/naming-standards.json";
import { fileFilterApi } from "./api";
import type {
  NamingStandardConfig,
  NamingStandardEditableSection,
  NamingStandardEntry,
  NamingStandardsData,
  NamingStandardRuntimeValues,
} from "./types";

const listeners = new Set<() => void>();

function sanitizeRevisionSection(
  value: unknown,
  fallback: Record<string, string>,
): Record<string, string> {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const entries = Object.entries(value)
    .filter(([code, label]) => typeof code === "string" && typeof label === "string")
    .map(([code, label]) => [code.trim().toUpperCase(), label.trim()]);

  if (entries.length === 0) {
    return { ...fallback };
  }

  return Object.fromEntries(entries);
}

function sanitizeEditableSection(
  value: unknown,
  fallback: Record<string, string>,
): NamingStandardEditableSection {
  if (!value || typeof value !== "object") {
    return Object.fromEntries(
      Object.entries(fallback).map(([code, label]) => [code, { label, active: true }]),
    );
  }

  const entries = Object.entries(value)
    .map(([rawCode, rawValue]) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) {
        return null;
      }

      if (typeof rawValue === "string") {
        const label = rawValue.trim();
        return label ? [code, { label, active: true } satisfies NamingStandardEntry] : null;
      }

      if (!rawValue || typeof rawValue !== "object") {
        return null;
      }

      const label = typeof rawValue.label === "string" ? rawValue.label.trim() : "";
      if (!label) {
        return null;
      }

      return [
        code,
        {
          label,
          active: rawValue.active !== false,
        } satisfies NamingStandardEntry,
      ];
    })
    .filter(Boolean) as Array<[string, NamingStandardEntry]>;

  if (entries.length === 0) {
    return Object.fromEntries(
      Object.entries(fallback).map(([code, label]) => [code, { label, active: true }]),
    );
  }

  return Object.fromEntries(entries);
}

export function sanitizeNamingStandardData(value: unknown): NamingStandardsData {
  const source = value && typeof value === "object" ? value : {};

  return {
    phases: sanitizeEditableSection((source as NamingStandardsData).phases, bundledNamingStandards.phases),
    disciplines: sanitizeEditableSection(
      (source as NamingStandardsData).disciplines,
      bundledNamingStandards.disciplines,
    ),
    documentTypes: sanitizeEditableSection(
      (source as NamingStandardsData).documentTypes,
      bundledNamingStandards.documentTypes,
    ),
    levels: sanitizeEditableSection((source as NamingStandardsData).levels, bundledNamingStandards.levels),
    revisions: sanitizeRevisionSection((source as NamingStandardsData).revisions, bundledNamingStandards.revisions),
    statuses: sanitizeEditableSection((source as NamingStandardsData).statuses, bundledNamingStandards.statuses),
  };
}

function projectEditableSection(section: NamingStandardEditableSection, mode: "active" | "all") {
  return Object.fromEntries(
    Object.entries(section)
      .filter(([, entry]) => mode === "all" || entry.active)
      .map(([code, entry]) => [code, entry.label]),
  );
}

export function projectNamingStandardValues(
  data: NamingStandardsData,
  mode: "active" | "all",
): NamingStandardRuntimeValues {
  return {
    phases: projectEditableSection(data.phases, mode),
    disciplines: projectEditableSection(data.disciplines, mode),
    documentTypes: projectEditableSection(data.documentTypes, mode),
    levels: projectEditableSection(data.levels, mode),
    revisions: { ...data.revisions },
    statuses: projectEditableSection(data.statuses, mode),
  };
}

function createConfig(
  source: NamingStandardConfig["source"],
  values: unknown,
  path = "",
  backupsPath = "",
  lastReportPath = "",
): NamingStandardConfig {
  const sanitizedValues = sanitizeNamingStandardData(values);

  return {
    path,
    backupsPath,
    lastReportPath,
    source,
    values: sanitizedValues,
    activeValues: projectNamingStandardValues(sanitizedValues, "active"),
    allValues: projectNamingStandardValues(sanitizedValues, "all"),
  };
}

let currentConfig: NamingStandardConfig = createConfig("bundled", bundledNamingStandards);
let currentVersion = 0;

function emitChange() {
  currentVersion += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeNamingStandard(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNamingStandardConfigSnapshot() {
  return currentConfig;
}

export function getNamingStandardSnapshot() {
  return currentConfig.activeValues;
}

export function getNamingStandardAllValuesSnapshot() {
  return currentConfig.allValues;
}

export function getNamingStandardVersionSnapshot() {
  return currentVersion;
}

export function useNamingStandardVersion() {
  return useSyncExternalStore(
    subscribeNamingStandard,
    getNamingStandardVersionSnapshot,
    getNamingStandardVersionSnapshot,
  );
}

export function setNamingStandardConfig(nextConfig: NamingStandardConfig) {
  currentConfig = createConfig(
    nextConfig.source === "userData" ? "userData" : "bundled",
    nextConfig.values,
    typeof nextConfig.path === "string" ? nextConfig.path : "",
    typeof nextConfig.backupsPath === "string" ? nextConfig.backupsPath : "",
    typeof nextConfig.lastReportPath === "string" ? nextConfig.lastReportPath : "",
  );
  emitChange();
}

export async function loadRuntimeNamingStandard() {
  const nextConfig = await fileFilterApi.getNamingStandard();
  setNamingStandardConfig(nextConfig);
  return nextConfig;
}

export async function saveRuntimeNamingStandard(values: NamingStandardsData) {
  const nextConfig = await fileFilterApi.saveNamingStandard(values);
  setNamingStandardConfig(nextConfig);
  return nextConfig;
}
