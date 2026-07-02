import fs from "node:fs";
import path from "node:path";

export const projectSettingsFileName = "project-settings.json";

export function projectSettingsPath(projectRoot) {
  return path.join(path.resolve(requiredProjectRoot(projectRoot)), ".dzui", projectSettingsFileName);
}

export function createDefaultProjectSettings(projectRoot, overrides = {}) {
  return normalizeProjectSettings({
    kind: "DzuiProjectSettings",
    version: 1,
    projectRoot: path.resolve(requiredProjectRoot(projectRoot)),
    layoutPath: null,
    preview: {
      width: 1280,
      height: 720,
      language: "English",
      state: "normal",
    },
    recent: {
      projectRoots: [],
      layoutPaths: [],
    },
    ...overrides,
  }, { projectRoot });
}

export function readProjectSettings(projectRoot) {
  const filePath = projectSettingsPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return {
      filePath,
      exists: false,
      settings: createDefaultProjectSettings(projectRoot),
    };
  }

  const source = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(source);
  return {
    filePath,
    exists: true,
    settings: normalizeProjectSettings(parsed, { projectRoot }),
  };
}

export function writeProjectSettings(projectRoot, patch = {}) {
  const current = readProjectSettings(projectRoot);
  const settings = normalizeProjectSettings(deepMerge(current.settings, patch), { projectRoot });
  fs.mkdirSync(path.dirname(current.filePath), { recursive: true });
  fs.writeFileSync(current.filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return {
    filePath: current.filePath,
    exists: true,
    written: true,
    settings,
  };
}

export function normalizeProjectSettings(input = {}, context = {}) {
  const projectRoot = path.resolve(requiredProjectRoot(context.projectRoot ?? input.projectRoot));
  const layoutPath = optionalString(input.layoutPath);
  const preview = input.preview ?? {};
  const recent = input.recent ?? {};
  const recentProjectRoots = uniqueRecent([
    projectRoot,
    ...arrayOfStrings(recent.projectRoots),
  ]);
  const recentLayoutPaths = uniqueRecent([
    layoutPath,
    ...arrayOfStrings(recent.layoutPaths),
  ]);

  return {
    kind: "DzuiProjectSettings",
    version: 1,
    projectRoot,
    layoutPath,
    preview: {
      width: positiveNumber(preview.width, 1280),
      height: positiveNumber(preview.height, 720),
      language: optionalString(preview.language) ?? "English",
      state: normalizePreviewState(preview.state ?? preview.previewState),
    },
    recent: {
      projectRoots: recentProjectRoots,
      layoutPaths: recentLayoutPaths,
    },
  };
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = deepMerge(base?.[key] ?? {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function uniqueRecent(values, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = optionalString(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map(optionalString).filter(Boolean) : [];
}

function optionalString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizePreviewState(value) {
  const normalized = optionalString(value)?.toLowerCase();
  return ["normal", "hover", "selected", "disabled"].includes(normalized) ? normalized : "normal";
}

function requiredProjectRoot(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("projectRoot is required.");
  return value;
}
