#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyLayoutPatch,
  buildLayoutDiffReport,
  buildLayoutPreviewModel,
  buildLayoutTransformPatch,
  buildFontCoverageReport,
  buildPreviewData,
  buildPluginRuntimePackage,
  buildPluginRuntimeRegistry,
  buildPluginSdkReport,
  buildProjectAssetIndex,
  createEditTransaction,
  createWidget,
  deleteWidget,
  ensureDecodedPreviewAsset,
  fontRegistryToJson,
  generateControllerSkeleton,
  generateLayoutPatch,
  hashSource,
  importFontAsset,
  importImageAsset,
  installPluginRuntimeTrust,
  instantiateWidgetPreset,
  parseLayout,
  parseStringTableCsv,
  parseStyleFile,
  redoTransaction,
  readProjectSettings,
  readPluginTrustPolicy,
  reparentWidget,
  resolveLayoutPatchConflicts,
  listWidgetPalette,
  packImageAtlas,
  runPluginRuntimeCommand,
  styleFileToJson,
  stringTableToGrid,
  undoTransaction,
  upsertStyleProperty,
  updateWidgetProperty,
  updateStringTableCsv,
  validateLayoutDocument,
  validateProject,
  verifyPluginRuntimePackage,
  writePluginRuntimePackage,
  writeProjectSettings,
} from "../../../packages/core/src/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const args = parseArgs(process.argv.slice(2));
const defaultPort = Number(args.get("--port") ?? process.env.PORT ?? 5173);
const defaultHost = args.get("--host") ?? "127.0.0.1";
const browserImageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const nativeTextureExtensions = new Set([".edds", ".paa", ".tga", ".dds"]);
const imageAssetExtensions = new Set([...browserImageExtensions, ...nativeTextureExtensions]);
const projectBrowserSkipDirs = new Set([".git", ".dzui", "node_modules", "dist", "build", "out", "output", "temp", "tmp"]);
const appRoot = path.resolve(__dirname, "../../..");
const environmentConfigRoot = process.env.DZUI_CONFIG_ROOT
  ? path.resolve(process.env.DZUI_CONFIG_ROOT)
  : path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "DayZ IDE");
const environmentSettingsPath = path.join(environmentConfigRoot, ".dzui", "ide-environment.json");
const defaultDayzProjectsRoot = path.join(os.homedir(), "Documents", "DayZ Projects");
const mcpServerScript = path.resolve(__dirname, "../../../packages/mcp-server/src/server.mjs");
const mcpState = {
  child: null,
  host: "127.0.0.1",
  port: 8765,
  projectRoot: null,
  startedAt: null,
  exit: null,
  logs: [],
};

export function mcpChildEnvironment(baseEnv = process.env) {
  return {
    ...baseEnv,
    ELECTRON_RUN_AS_NODE: "1",
  };
}

export function createDesktopServer() {
  return http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/environment/")) {
      if (!requireReadyEnvironment(response)) return;
    }
    if (url.pathname === "/api/layout") {
      await handleLayout(url, response);
      return;
    }
    if (url.pathname === "/api/layout/property") {
      await handlePropertyUpdate(request, response);
      return;
    }
    if (url.pathname === "/api/layout/box") {
      await handleBoxUpdate(request, response);
      return;
    }
    if (url.pathname === "/api/layout/widget/create") {
      await handleWidgetCreate(request, response);
      return;
    }
    if (url.pathname === "/api/layout/widget/delete") {
      await handleWidgetDelete(request, response);
      return;
    }
    if (url.pathname === "/api/layout/widget/reparent") {
      await handleWidgetReparent(request, response);
      return;
    }
    if (url.pathname === "/api/layout/palette") {
      await handleLayoutPalette(url, response);
      return;
    }
    if (url.pathname === "/api/layout/source") {
      await handleLayoutSource(url, response);
      return;
    }
    if (url.pathname === "/api/layout/source/apply") {
      await handleLayoutSourceApply(request, response);
      return;
    }
    if (url.pathname === "/api/layout/history") {
      await handleLayoutHistory(url, response);
      return;
    }
    if (url.pathname === "/api/layout/history/restore") {
      await handleHistoryRestore(request, response);
      return;
    }
    if (url.pathname === "/api/layout/patch/apply") {
      await handleLayoutPatchApply(request, response);
      return;
    }
    if (url.pathname === "/api/layout/transform") {
      await handleLayoutTransform(request, response);
      return;
    }
    if (url.pathname === "/api/layout/patch/generate") {
      await handleLayoutPatchGenerate(url, response);
      return;
    }
    if (url.pathname === "/api/layout/patch/resolve") {
      await handleLayoutPatchResolve(request, response);
      return;
    }
    if (url.pathname === "/api/layout/diff") {
      await handleLayoutDiff(url, response);
      return;
    }
    if (url.pathname === "/api/project/validate") {
      await handleProjectValidate(url, response);
      return;
    }
    if (url.pathname === "/api/project/layouts") {
      await handleProjectLayouts(url, response);
      return;
    }
    if (url.pathname === "/api/project/files") {
      await handleProjectFiles(url, response);
      return;
    }
    if (url.pathname === "/api/project/plugins") {
      await handleProjectPlugins(url, response);
      return;
    }
    if (url.pathname === "/api/project/plugin-runtime") {
      await handleProjectPluginRuntime(url, response);
      return;
    }
    if (url.pathname === "/api/project/plugin-package") {
      await handleProjectPluginPackage(url, response);
      return;
    }
    if (url.pathname === "/api/project/plugin-package/save") {
      await handleProjectPluginPackageSave(request, response);
      return;
    }
    if (url.pathname === "/api/project/plugin-package/verify") {
      await handleProjectPluginPackageVerify(request, url, response);
      return;
    }
    if (url.pathname === "/api/project/plugin-trust") {
      await handleProjectPluginTrust(request, url, response);
      return;
    }
    if (url.pathname === "/api/project/plugin-command") {
      await handleProjectPluginCommand(request, response);
      return;
    }
    if (url.pathname === "/api/environment/status") {
      await handleEnvironmentStatus(response);
      return;
    }
    if (url.pathname === "/api/environment/save") {
      await handleEnvironmentSave(request, response);
      return;
    }
    if (url.pathname === "/api/environment/recent-projects") {
      await handleEnvironmentRecentProjectsSave(request, response);
      return;
    }
    if (url.pathname === "/api/mcp/status") {
      await handleMcpStatus(response);
      return;
    }
    if (url.pathname === "/api/mcp/start") {
      await handleMcpStart(request, response);
      return;
    }
    if (url.pathname === "/api/mcp/stop") {
      await handleMcpStop(request, response);
      return;
    }
    if (url.pathname === "/api/project/settings") {
      await handleProjectSettings(url, response);
      return;
    }
    if (url.pathname === "/api/project/settings/save") {
      await handleProjectSettingsSave(request, response);
      return;
    }
    if (url.pathname === "/api/script/controller") {
      await handleController(url, response);
      return;
    }
    if (url.pathname === "/api/stringtable") {
      await handleStringTable(url, response);
      return;
    }
    if (url.pathname === "/api/stringtable/update") {
      await handleStringTableUpdate(request, response);
      return;
    }
    if (url.pathname === "/api/styles") {
      await handleStyles(url, response);
      return;
    }
    if (url.pathname === "/api/styles/update") {
      await handleStyleUpdate(request, response);
      return;
    }
    if (url.pathname === "/api/fonts") {
      await handleFonts(url, response);
      return;
    }
    if (url.pathname === "/api/font/coverage") {
      await handleFontCoverage(url, response);
      return;
    }
    if (url.pathname === "/api/font/import") {
      await handleFontImport(request, response);
      return;
    }
    if (url.pathname === "/api/image/import") {
      await handleImageImport(request, response);
      return;
    }
    if (url.pathname === "/api/atlas/pack") {
      await handleAtlasPack(request, response);
      return;
    }
    if (url.pathname === "/api/assets/images") {
      await handleImageAssets(url, response);
      return;
    }
    if (url.pathname === "/api/asset") {
      await handleAsset(url, response);
      return;
    }
    if (url.pathname === "/api/texture/native") {
      await handleNativeTexture(url, response);
      return;
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  });
}

export function startDesktopServer(options = {}) {
  const host = options.host ?? defaultHost;
  const port = Number(options.port ?? defaultPort);
  const log = options.log !== false;
  const server = createDesktopServer();
  server.on("close", () => {
    if (mcpState.child && !mcpState.child.killed) {
      mcpState.child.kill();
    }
  });

  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const url = `http://${host}:${actualPort}/`;
      if (log) console.log(`DZUI shell running at ${url}`);
      resolve({ server, host, port: actualPort, url });
    });
  });
}

if (isDirectRun()) {
  await startDesktopServer();
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

async function handleLayout(url, response) {
  const filePath = url.searchParams.get("file");
  if (!filePath) {
    sendJson(response, 400, { error: "Missing file query parameter." });
    return;
  }

  const absoluteFilePath = path.resolve(filePath);
  if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${absoluteFilePath}` });
    return;
  }

  const projectRoot = url.searchParams.get("project");
  const width = Number(url.searchParams.get("width") ?? 1280);
  const height = Number(url.searchParams.get("height") ?? 720);
  const language = url.searchParams.get("language") ?? "English";
  const previewState = url.searchParams.get("previewState") ?? url.searchParams.get("state") ?? "normal";
  const source = fs.readFileSync(absoluteFilePath, "utf8");
  const data = buildLayoutData({
    filePath: absoluteFilePath,
    source,
    projectRoot: projectRoot ? path.resolve(projectRoot) : null,
    width,
    height,
    language,
    previewState,
  });
  sendJson(response, 200, data);
}

async function handleLayoutSource(url, response) {
  const filePath = resolveExistingFile(url.searchParams.get("file"));
  if (!filePath.ok) {
    sendJson(response, filePath.status, { error: filePath.error });
    return;
  }
  const source = fs.readFileSync(filePath.value, "utf8");
  sendJson(response, 200, {
    filePath: filePath.value,
    hash: hashSource(source),
    source,
  });
}

async function handleLayoutHistory(url, response) {
  const filePath = resolveExistingFile(url.searchParams.get("file"));
  if (!filePath.ok) {
    sendJson(response, filePath.status, { error: filePath.error });
    return;
  }
  const projectRoot = url.searchParams.get("project") ? path.resolve(url.searchParams.get("project")) : null;
  sendJson(response, 200, {
    filePath: filePath.value,
    historyRoot: historyRootFor(projectRoot),
    entries: readHistoryEntries(filePath.value, projectRoot),
  });
}

async function handleLayoutSourceApply(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for source apply." });
    return;
  }

  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const nextSource = requireBodyString(body.source, "source");
  const projectRoot = body.project ? path.resolve(body.project) : null;
  const width = Number(body.width ?? 1280);
  const height = Number(body.height ?? 720);
  const language = body.language ?? "English";
  const previewState = body.previewState ?? body.state ?? "normal";

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${filePath}` });
    return;
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const currentHash = hashSource(beforeSource);
  if (body.expectedHash && body.expectedHash !== currentHash) {
    sendJson(response, 409, {
      error: "Cannot apply source: current file hash changed.",
      currentHash,
      expectedHash: body.expectedHash,
    });
    return;
  }

  const candidate = parseLayout(nextSource, { filePath });
  if (candidate.diagnostics.length && body.allowDiagnostics !== true) {
    sendJson(response, 400, {
      error: "Cannot apply source with layout parser diagnostics.",
      diagnostics: candidate.diagnostics,
    });
    return;
  }

  const transaction = createEditTransaction({
    filePath,
    beforeSource,
    afterSource: nextSource,
    edit: {
      start: 0,
      end: beforeSource.length,
      oldText: beforeSource,
      newText: nextSource,
    },
    label: "Source apply",
  });
  writeHistoryTransaction(transaction, projectRoot);
  fs.writeFileSync(filePath, nextSource, "utf8");

  const data = buildLayoutData({
    filePath,
    source: nextSource,
    projectRoot,
    width,
    height,
    language,
    previewState,
  });
  sendJson(response, 200, {
    hash: transaction.after.hash,
    transaction: {
      id: transaction.id,
      beforeHash: transaction.before.hash,
      afterHash: transaction.after.hash,
      historyPath: transaction.historyPath,
    },
    preview: data,
    history: readHistoryEntries(filePath, projectRoot),
  });
}

async function handleLayoutDiff(url, response) {
  const beforePath = url.searchParams.get("before");
  const afterPath = url.searchParams.get("after");
  if (!beforePath) {
    sendJson(response, 400, { error: "Missing before query parameter." });
    return;
  }
  if (!afterPath) {
    sendJson(response, 400, { error: "Missing after query parameter." });
    return;
  }
  const before = path.resolve(beforePath);
  const after = path.resolve(afterPath);
  if (!fs.existsSync(before) || !fs.statSync(before).isFile()) {
    sendJson(response, 404, { error: `Before layout file does not exist: ${before}` });
    return;
  }
  if (!fs.existsSync(after) || !fs.statSync(after).isFile()) {
    sendJson(response, 404, { error: `After layout file does not exist: ${after}` });
    return;
  }
  const report = buildLayoutDiffReport(
    parseLayout(fs.readFileSync(before, "utf8"), { filePath: before }),
    parseLayout(fs.readFileSync(after, "utf8"), { filePath: after }),
    { includeUnchanged: url.searchParams.get("includeUnchanged") === "true" },
  );
  sendJson(response, 200, report);
}

async function handleLayoutPatchApply(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for layout patch apply." });
    return;
  }
  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const projectRoot = body.project ? path.resolve(body.project) : null;
  const width = Number(body.width ?? 1280);
  const height = Number(body.height ?? 720);
  const language = body.language ?? "English";
  const previewState = body.previewState ?? body.state ?? "normal";
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${filePath}` });
    return;
  }

  const patchFile = body.patchFile ? path.resolve(body.patchFile) : null;
  if (patchFile && (!fs.existsSync(patchFile) || !fs.statSync(patchFile).isFile())) {
    sendJson(response, 404, { error: `Layout patch file does not exist: ${patchFile}` });
    return;
  }
  const patch = body.patch ?? (patchFile ? JSON.parse(fs.readFileSync(patchFile, "utf8")) : null);
  if (!patch) {
    sendJson(response, 400, { error: "Patch object or patchFile is required." });
    return;
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const result = applyLayoutPatch(beforeSource, patch, {
    filePath,
    includeSource: true,
    allowHashMismatch: body.allowHashMismatch === true,
    allowDiagnostics: body.allowDiagnostics === true,
  });
  const payload = {
    written: false,
    filePath,
    patchFile,
    ...withoutSource(result),
  };

  if (result.ok && body.write === true) {
    const transaction = createEditTransaction({
      filePath,
      beforeSource,
      afterSource: result.source,
      edit: {
        type: "layout-patch",
        label: result.label,
        operations: result.operations,
      },
      label: result.label ?? "Layout patch",
    });
    writeHistoryTransaction(transaction, projectRoot);
    fs.writeFileSync(filePath, result.source, "utf8");
    payload.written = true;
    payload.transaction = {
      id: transaction.id,
      beforeHash: transaction.before.hash,
      afterHash: transaction.after.hash,
      historyPath: transaction.historyPath,
    };
    payload.preview = buildLayoutData({
      filePath,
      source: result.source,
      projectRoot,
      width,
      height,
      language,
      previewState,
    });
  }

  sendJson(response, result.ok ? 200 : 400, payload);
}

async function handleLayoutTransform(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for layout transforms." });
    return;
  }
  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const projectRoot = body.project ? path.resolve(body.project) : null;
  const width = Number(body.width ?? 1280);
  const height = Number(body.height ?? 720);
  const language = body.language ?? "English";
  const previewState = body.previewState ?? body.state ?? "normal";
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${filePath}` });
    return;
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const document = parseLayout(beforeSource, { filePath });
  const transformed = buildLayoutTransformPatch(document, {
    action: requireBodyString(body.action, "action"),
    widgetIds: Array.isArray(body.widgetIds) ? body.widgetIds : [],
    widgetNames: Array.isArray(body.widgetNames) ? body.widgetNames : [],
    width,
    height,
    delta: body.delta,
    deltaX: body.deltaX,
    deltaY: body.deltaY,
    targetBounds: body.targetBounds,
    targetWidth: body.targetWidth,
    targetHeight: body.targetHeight,
    label: body.label,
  });
  if (!transformed.ok) {
    sendJson(response, 400, transformed);
    return;
  }

  const result = applyLayoutPatch(beforeSource, transformed.patch, {
    filePath,
    includeSource: true,
    allowDiagnostics: body.allowDiagnostics === true,
  });
  const payload = {
    written: false,
    filePath,
    transform: transformed,
    ...withoutSource(result),
  };

  if (result.ok && body.write === true) {
    const transaction = createEditTransaction({
      filePath,
      beforeSource,
      afterSource: result.source,
      edit: {
        type: "layout-transform",
        action: transformed.action,
        operations: result.operations,
      },
      label: transformed.patch.label ?? `Layout ${transformed.action}`,
    });
    writeHistoryTransaction(transaction, projectRoot);
    fs.writeFileSync(filePath, result.source, "utf8");
    payload.written = true;
    payload.transaction = {
      id: transaction.id,
      beforeHash: transaction.before.hash,
      afterHash: transaction.after.hash,
      historyPath: transaction.historyPath,
    };
    payload.preview = buildLayoutData({
      filePath,
      source: result.source,
      projectRoot,
      width,
      height,
      language,
      previewState,
    });
  }

  sendJson(response, result.ok ? 200 : 400, payload);
}

async function handleLayoutPatchGenerate(url, response) {
  const beforePath = url.searchParams.get("before");
  const afterPath = url.searchParams.get("after");
  if (!beforePath) {
    sendJson(response, 400, { error: "Missing before query parameter." });
    return;
  }
  if (!afterPath) {
    sendJson(response, 400, { error: "Missing after query parameter." });
    return;
  }
  const before = path.resolve(beforePath);
  const after = path.resolve(afterPath);
  if (!fs.existsSync(before) || !fs.statSync(before).isFile()) {
    sendJson(response, 404, { error: `Before layout file does not exist: ${before}` });
    return;
  }
  if (!fs.existsSync(after) || !fs.statSync(after).isFile()) {
    sendJson(response, 404, { error: `After layout file does not exist: ${after}` });
    return;
  }

  const patch = generateLayoutPatch(
    parseLayout(fs.readFileSync(before, "utf8"), { filePath: before }),
    parseLayout(fs.readFileSync(after, "utf8"), { filePath: after }),
    {
      label: url.searchParams.get("label") || undefined,
      allowDeleteLastRoot: url.searchParams.get("allowDeleteLastRoot") === "true",
    },
  );
  const out = url.searchParams.get("out") ? path.resolve(url.searchParams.get("out")) : null;
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(patch, null, 2)}\n`, "utf8");
  }
  sendJson(response, 200, {
    ...patch,
    written: Boolean(out),
    out,
  });
}

async function handleLayoutPatchResolve(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for layout patch resolve." });
    return;
  }
  const body = await readJsonBody(request);
  const patchFile = body.patchFile ? path.resolve(body.patchFile) : null;
  if (patchFile && (!fs.existsSync(patchFile) || !fs.statSync(patchFile).isFile())) {
    sendJson(response, 404, { error: `Layout patch file does not exist: ${patchFile}` });
    return;
  }
  const patch = body.patch ?? (patchFile ? JSON.parse(fs.readFileSync(patchFile, "utf8")) : null);
  if (!patch) {
    sendJson(response, 400, { error: "Patch object or patchFile is required." });
    return;
  }
  const resolved = resolveLayoutPatchConflicts(patch, {
    defaultAction: body.defaultAction ?? "skip",
    decisions: Array.isArray(body.decisions) ? body.decisions : [],
    note: body.note,
  });
  const out = body.out ? path.resolve(body.out) : patchFile;
  const payload = {
    ...resolved,
    written: false,
    patchFile,
    out,
  };
  if (body.write === true) {
    if (!out) {
      sendJson(response, 400, { error: "out or patchFile is required when write=true." });
      return;
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
    payload.written = true;
  }
  sendJson(response, 200, payload);
}

async function handleProjectValidate(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  sendJson(response, 200, validateProject(root));
}

async function handleProjectLayouts(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }

  const query = String(url.searchParams.get("query") || "").trim().toLowerCase();
  const allLayouts = listProjectLayouts(root);
  const filteredLayouts = query
    ? allLayouts.filter((layout) => layout.relativePath.toLowerCase().includes(query))
    : allLayouts;
  const limit = 1000;
  sendJson(response, 200, {
    projectRoot: root,
    total: filteredLayouts.length,
    truncated: filteredLayouts.length > limit,
    layouts: filteredLayouts.slice(0, limit),
  });
}

function listProjectLayouts(root) {
  const layouts = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!projectBrowserSkipDirs.has(entry.name.toLowerCase())) stack.push(entryPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".layout") continue;
      const stat = fs.statSync(entryPath);
      layouts.push({
        name: entry.name,
        filePath: entryPath,
        relativePath: path.relative(root, entryPath).replaceAll("\\", "/"),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  }
  return layouts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function handleProjectFiles(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }

  const counters = {
    directoryCount: 0,
    fileCount: 0,
    layoutCount: 0,
    total: 0,
    truncated: false,
    limit: 5000,
  };
  const tree = buildProjectFileTree(root, root, counters);
  sendJson(response, 200, {
    projectRoot: root,
    directoryCount: counters.directoryCount,
    fileCount: counters.fileCount,
    layoutCount: counters.layoutCount,
    total: counters.total,
    truncated: counters.truncated,
    tree,
  });
}

function buildProjectFileTree(root, current, counters) {
  const relativePath = path.relative(root, current).replaceAll("\\", "/");
  const node = {
    type: "directory",
    name: relativePath ? path.basename(current) : path.basename(root),
    filePath: current,
    relativePath,
    children: [],
  };
  if (relativePath) counters.directoryCount += 1;

  let entries = [];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return node;
  }

  const directories = [];
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!projectBrowserSkipDirs.has(entry.name.toLowerCase())) directories.push(entry);
    } else if (entry.isFile()) {
      files.push(entry);
    }
  }

  directories.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of directories) {
    if (counters.truncated) break;
    node.children.push(buildProjectFileTree(root, path.join(current, entry.name), counters));
  }
  for (const entry of files) {
    if (counters.total >= counters.limit) {
      counters.truncated = true;
      break;
    }
    const filePath = path.join(current, entry.name);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    counters.total += 1;
    counters.fileCount += 1;
    if (ext === ".layout") counters.layoutCount += 1;
    node.children.push({
      type: "file",
      name: entry.name,
      filePath,
      relativePath: path.relative(root, filePath).replaceAll("\\", "/"),
      ext,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    });
  }
  return node;
}

async function handleProjectPlugins(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  sendJson(response, 200, buildPluginSdkReport(root));
}

async function handleProjectPluginRuntime(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  sendJson(response, 200, buildPluginRuntimeRegistry(root));
}

async function handleProjectPluginPackage(url, response) {
  const root = resolveProjectRootFromQuery(url, response);
  if (!root) return;
  sendJson(response, 200, buildPluginRuntimePackage(root));
}

async function handleProjectPluginPackageSave(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for plugin package manifest writes." });
    return;
  }
  const body = await readJsonBody(request);
  const projectRoot = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
    return;
  }
  sendJson(response, 200, writePluginRuntimePackage(projectRoot, {
    out: body.out || undefined,
    ...pluginPackageSigningOptions(body),
  }));
}

async function handleProjectPluginPackageVerify(request, url, response) {
  if (request.method === "POST") {
    const body = await readJsonBody(request);
    const projectRoot = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
    if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
      sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
      return;
    }
    sendJson(response, 200, verifyPluginRuntimePackage(projectRoot, body.manifest ?? body.packagePath, pluginTrustVerifyOptions(body)));
    return;
  }
  const root = resolveProjectRootFromQuery(url, response);
  if (!root) return;
  sendJson(response, 200, verifyPluginRuntimePackage(root, url.searchParams.get("package") || undefined, {
    requireSignature: url.searchParams.get("requireSignature") === "true",
    requireTrusted: url.searchParams.get("requireTrusted") === "true",
    trustPolicyPath: url.searchParams.get("trustPolicy") || undefined,
    trustedKeysPath: url.searchParams.get("trustedKeys") || undefined,
  }));
}

async function handleProjectPluginTrust(request, url, response) {
  if (request.method === "GET") {
    const root = resolveProjectRootFromQuery(url, response);
    if (!root) return;
    sendJson(response, 200, readPluginTrustPolicy(root, {
      trustPolicyPath: url.searchParams.get("trustPolicy") || undefined,
    }));
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use GET or POST for plugin trust policy." });
    return;
  }
  const body = await readJsonBody(request);
  const projectRoot = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
    return;
  }
  sendJson(response, 200, installPluginRuntimeTrust(projectRoot, body.manifest ?? body.packagePath, {
    trustPolicyPath: body.trustPolicyPath,
    write: body.write !== false,
  }));
}

async function handleProjectPluginCommand(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for plugin command plans/runs." });
    return;
  }
  const body = await readJsonBody(request);
  const projectRoot = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
    return;
  }
  sendJson(response, 200, await runPluginRuntimeCommand(projectRoot, {
    commandId: requireBodyString(body.commandId ?? body.command, "commandId"),
    args: body.args ?? {},
    packagePath: body.packagePath,
    manifest: body.manifest,
    execute: body.execute === true,
    allowUntrusted: body.allowUntrusted === true,
    ...pluginTrustVerifyOptions(body),
  }));
}

async function handleEnvironmentStatus(response) {
  sendJson(response, 200, readEnvironmentStatus());
}

async function handleEnvironmentSave(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for environment setup." });
    return;
  }
  const body = await readJsonBody(request);
  const current = readEnvironmentSettings();
  const settings = normalizeEnvironmentSettings({
    ...current,
    projectsRoot: body.projectsRoot,
    recentProjectRoots: body.recentProjectRoots ?? current.recentProjectRoots,
  });
  const status = buildEnvironmentStatus(settings);
  if (!status.ready) {
    sendJson(response, 400, status);
    return;
  }
  fs.mkdirSync(path.dirname(environmentSettingsPath), { recursive: true });
  fs.writeFileSync(environmentSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  sendJson(response, 200, readEnvironmentStatus());
}

async function handleEnvironmentRecentProjectsSave(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for recent projects." });
    return;
  }
  const body = await readJsonBody(request);
  const settings = normalizeEnvironmentSettings({
    ...readEnvironmentSettings(),
    recentProjectRoots: body.recentProjectRoots,
  });
  fs.mkdirSync(path.dirname(environmentSettingsPath), { recursive: true });
  fs.writeFileSync(environmentSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  sendJson(response, 200, readEnvironmentStatus());
}

function readEnvironmentStatus() {
  return buildEnvironmentStatus(readEnvironmentSettings(), fs.existsSync(environmentSettingsPath));
}

function readEnvironmentSettings() {
  if (!fs.existsSync(environmentSettingsPath)) {
    return normalizeEnvironmentSettings({});
  }
  try {
    return normalizeEnvironmentSettings(JSON.parse(fs.readFileSync(environmentSettingsPath, "utf8")));
  } catch {
    return normalizeEnvironmentSettings({});
  }
}

function normalizeEnvironmentSettings(input = {}) {
  return {
    ...input,
    kind: "DzuiIdeEnvironment",
    version: 1,
    projectsRoot: path.resolve(input.projectsRoot || defaultDayzProjectsRoot),
    recentProjectRoots: normalizeRecentProjectRoots(input.recentProjectRoots),
  };
}

function normalizeRecentProjectRoots(projectRoots, limit = 10) {
  const seen = new Set();
  const out = [];
  for (const projectRoot of Array.isArray(projectRoots) ? projectRoots : []) {
    if (typeof projectRoot !== "string" || !projectRoot.trim()) continue;
    const value = path.resolve(projectRoot.trim().replace(/[\\/]+$/, ""));
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function buildEnvironmentStatus(settings, initialized = true) {
  const projectsRootExists = fs.existsSync(settings.projectsRoot) && fs.statSync(settings.projectsRoot).isDirectory();
  const counts = projectsRootExists ? countVanillaProjectAssets(settings.projectsRoot) : {
    layouts: 0,
    styles: 0,
    imageSets: 0,
  };
  const missing = [];
  if (!initialized) missing.push(`IDE environment settings: ${environmentSettingsPath}`);
  if (!projectsRootExists) missing.push(`DayZ Projects root: ${settings.projectsRoot}`);

  return {
    kind: "DzuiIdeEnvironmentStatus",
    initialized,
    ready: initialized && missing.length === 0,
    settingsPath: environmentSettingsPath,
    defaults: {
      projectsRoot: defaultDayzProjectsRoot,
    },
    settings,
    checks: {
      projectsRootExists,
    },
    missing,
    counts,
  };
}

function countVanillaProjectAssets(root) {
  const counts = { layouts: 0, styles: 0, imageSets: 0 };
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".layout") counts.layouts += 1;
      if (ext === ".styles") counts.styles += 1;
      if (ext === ".imageset") counts.imageSets += 1;
    }
  }
  return counts;
}

function requireReadyEnvironment(response) {
  const status = readEnvironmentStatus();
  if (status.ready) return status;
  sendJson(response, 428, {
    error: "DayZ IDE environment is not initialized.",
    ...status,
  });
  return null;
}

function buildDesktopProjectAssetIndex(root) {
  const environment = readEnvironmentStatus();
  const vanillaRoots = environment.ready ? environment.settings.projectsRoot : process.env.DZUI_VANILLA_ASSETS;
  return buildProjectAssetIndex(root, { vanillaRoots });
}

async function handleMcpStatus(response) {
  sendJson(response, 200, mcpStatusPayload());
}

async function handleMcpStart(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST to start the MCP server." });
    return;
  }
  const body = await readJsonBody(request);
  if (mcpState.child && !mcpState.child.killed) {
    sendJson(response, 200, mcpStatusPayload());
    return;
  }

  const port = normalizePort(body.port ?? 8765);
  const projectRoot = typeof body.projectRoot === "string" && body.projectRoot.trim()
    ? path.resolve(body.projectRoot)
    : null;
  if (projectRoot && (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory())) {
    sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
    return;
  }

  const childArgs = [mcpServerScript, "--http", "--host", mcpState.host, "--port", String(port)];
  if (projectRoot) childArgs.push("--project", projectRoot);

  mcpState.port = port;
  mcpState.projectRoot = projectRoot;
  mcpState.startedAt = new Date().toISOString();
  mcpState.exit = null;
  mcpState.logs = [];
  mcpState.child = spawn(process.execPath, childArgs, {
    cwd: path.resolve(__dirname, "../../.."),
    env: mcpChildEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  appendMcpLog(`started: ${process.execPath} ${childArgs.join(" ")} (ELECTRON_RUN_AS_NODE=1)`);
  mcpState.child.stdout?.on("data", (chunk) => appendMcpLog(chunk.toString("utf8").trimEnd()));
  mcpState.child.stderr?.on("data", (chunk) => appendMcpLog(chunk.toString("utf8").trimEnd()));
  mcpState.child.on("exit", (code, signal) => {
    mcpState.exit = { code, signal, at: new Date().toISOString() };
    appendMcpLog(`exited: code=${code ?? "null"} signal=${signal ?? "null"}`);
    mcpState.child = null;
  });

  sendJson(response, 200, mcpStatusPayload());
}

async function handleMcpStop(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST to stop the MCP server." });
    return;
  }
  if (mcpState.child && !mcpState.child.killed) {
    appendMcpLog("stopping MCP server");
    mcpState.child.kill();
  }
  sendJson(response, 200, mcpStatusPayload());
}

function mcpStatusPayload() {
  const running = Boolean(mcpState.child && !mcpState.child.killed);
  const endpoint = `http://${mcpState.host}:${mcpState.port}/mcp`;
  return {
    running,
    pid: running ? mcpState.child.pid : null,
    host: mcpState.host,
    port: mcpState.port,
    endpoint,
    health: `http://${mcpState.host}:${mcpState.port}/health`,
    projectRoot: mcpState.projectRoot,
    startedAt: mcpState.startedAt,
    exit: mcpState.exit,
    logs: mcpState.logs.slice(-80),
  };
}

function appendMcpLog(line) {
  if (!line) return;
  for (const part of String(line).split(/\r?\n/)) {
    if (part) mcpState.logs.push(`[${new Date().toISOString()}] ${part}`);
  }
  if (mcpState.logs.length > 200) {
    mcpState.logs.splice(0, mcpState.logs.length - 200);
  }
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("port must be an integer between 1 and 65535.");
  }
  return port;
}

function pluginPackageSigningOptions(body) {
  return {
    signPrivateKeyPem: body.signPrivateKeyPem,
    signPrivateKeyPath: body.signPrivateKeyPath,
    signPublicKeyPem: body.signPublicKeyPem,
    signPublicKeyPath: body.signPublicKeyPath,
    signKeyId: body.signKeyId,
  };
}

function pluginTrustVerifyOptions(body) {
  return {
    requireSignature: body.requireSignature === true,
    requireTrusted: body.requireTrusted === true,
    trustPolicy: body.trustPolicy,
    trustPolicyPath: body.trustPolicyPath,
    trustedKeys: body.trustedKeys,
    trustedKeysPath: body.trustedKeysPath,
  };
}

async function handleProjectSettings(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  sendJson(response, 200, readProjectSettings(root));
}

function resolveProjectRootFromQuery(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return null;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return null;
  }
  return root;
}

async function handleProjectSettingsSave(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for project settings." });
    return;
  }
  const body = await readJsonBody(request);
  const root = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  sendJson(response, 200, writeProjectSettings(root, body.settings ?? {}));
}

async function handleController(url, response) {
  const filePath = url.searchParams.get("file");
  if (!filePath) {
    sendJson(response, 400, { error: "Missing file query parameter." });
    return;
  }
  const absoluteFilePath = path.resolve(filePath);
  if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${absoluteFilePath}` });
    return;
  }
  const document = parseLayout(fs.readFileSync(absoluteFilePath, "utf8"), { filePath: absoluteFilePath });
  const skeleton = generateControllerSkeleton(document, {
    className: url.searchParams.get("class") || undefined,
    layoutPath: url.searchParams.get("layout") || absoluteFilePath,
    baseClass: url.searchParams.get("base") || "UIScriptedMenu",
  });
  sendJson(response, 200, skeleton);
}

async function handleStringTable(url, response) {
  const projectRoot = url.searchParams.get("project");
  const explicitFile = url.searchParams.get("file");
  let filePath = explicitFile ? path.resolve(explicitFile) : null;

  if (!filePath) {
    if (!projectRoot) {
      sendJson(response, 400, { error: "Missing project or file query parameter." });
      return;
    }
    const root = path.resolve(projectRoot);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      sendJson(response, 404, { error: `Project root does not exist: ${root}` });
      return;
    }
    const projectIndex = buildDesktopProjectAssetIndex(root);
    filePath = projectIndex.stringTable.tables[0]?.filePath ?? path.join(root, "stringtable.csv");
  }

  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "Key,English\n";
  const table = parseStringTableCsv(source, { filePath });
  sendJson(response, 200, {
    ...stringTableToGrid(table),
    sourceExists: fs.existsSync(filePath),
  });
}

async function handleStringTableUpdate(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for stringtable updates." });
    return;
  }
  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "Key,English\n";
  const updated = updateStringTableCsv(source, {
    key: requireBodyString(body.key, "key"),
    values: body.values ?? {},
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, updated.source, "utf8");
  sendJson(response, 200, {
    filePath,
    key: updated.key,
    inserted: updated.inserted,
  });
}

async function handleStyles(url, response) {
  const resolved = resolveStyleFileFromRequest(url);
  if (!resolved.ok) {
    sendJson(response, resolved.status, { error: resolved.error });
    return;
  }

  const sourceExists = fs.existsSync(resolved.filePath);
  const source = sourceExists ? fs.readFileSync(resolved.filePath, "utf8") : "";
  const parsed = parseStyleFile(source, { filePath: resolved.filePath });
  sendJson(response, 200, {
    ...styleFileToJson(parsed),
    sourceExists,
  });
}

async function handleStyleUpdate(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for style updates." });
    return;
  }

  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const updated = upsertStyleProperty(source, {
    filePath,
    styleName: requireBodyString(body.styleName, "styleName"),
    typeClass: body.typeClass || "StyleClass",
    key: requireBodyString(body.key, "key"),
    values: Array.isArray(body.values) ? body.values : [],
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, updated.source, "utf8");
  const styled = styleFileToJson(parseStyleFile(updated.source, { filePath }));
  sendJson(response, 200, {
    filePath,
    style: updated.style,
    insertedStyle: updated.insertedStyle,
    insertedProperty: updated.insertedProperty,
    diagnosticCount: styled.diagnosticCount,
    diagnostics: styled.diagnostics,
  });
}

async function handleFonts(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  const projectIndex = buildDesktopProjectAssetIndex(root);
  const layoutPath = url.searchParams.get("layout") ? path.resolve(url.searchParams.get("layout")) : null;
  let diagnostics = [];
  if (layoutPath) {
    if (!fs.existsSync(layoutPath) || !fs.statSync(layoutPath).isFile()) {
      sendJson(response, 404, { error: `Layout file does not exist: ${layoutPath}` });
      return;
    }
    const document = parseLayout(fs.readFileSync(layoutPath, "utf8"), { filePath: layoutPath });
    diagnostics = validateLayoutDocument(document, { projectIndex })
      .filter((diagnostic) => diagnostic.code.startsWith("layout.font."));
  }
  sendJson(response, 200, {
    projectRoot: root,
    layoutPath,
    ...fontRegistryToJson(projectIndex.fonts),
    diagnosticCount: diagnostics.length,
    diagnostics,
  });
}

async function handleFontCoverage(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  sendJson(response, 200, buildFontCoverageReport({
    projectRoot: root,
    layoutPath: url.searchParams.get("layout") || undefined,
    languages: url.searchParams.get("languages") || undefined,
  }));
}

async function handleFontImport(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for font import." });
    return;
  }
  const body = await readJsonBody(request);
  const projectRoot = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
    return;
  }
  sendJson(response, 200, importFontAsset({
    projectRoot,
    sourceFont: requireBodyString(body.sourceFont, "sourceFont"),
    fontVirtualPath: body.fontVirtualPath || body.assetVirtualPath || undefined,
    sampleText: body.sampleText || undefined,
    write: body.write !== false,
  }));
}

function resolveStyleFileFromRequest(url) {
  const explicitFile = url.searchParams.get("file");
  if (explicitFile) {
    return {
      ok: true,
      filePath: path.resolve(explicitFile),
    };
  }

  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    return {
      ok: false,
      status: 400,
      error: "Missing project or file query parameter.",
    };
  }

  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return {
      ok: false,
      status: 404,
      error: `Project root does not exist: ${root}`,
    };
  }

  const projectIndex = buildDesktopProjectAssetIndex(root);
  return {
    ok: true,
    filePath: projectIndex.styles.files[0]?.filePath ?? path.join(root, "gui", "styles", "styles.styles"),
  };
}

async function handleImageImport(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for image import." });
    return;
  }
  const body = await readJsonBody(request);
  const imported = importImageAsset({
    projectRoot: requireBodyString(body.projectRoot, "projectRoot"),
    sourceImage: requireBodyString(body.sourceImage, "sourceImage"),
    assetVirtualPath: requireBodyString(body.assetVirtualPath, "assetVirtualPath"),
    imageSetVirtualPath: requireBodyString(body.imageSetVirtualPath, "imageSetVirtualPath"),
    setName: body.setName,
    imageName: body.imageName,
  });
  sendJson(response, 200, imported);
}

async function handleAtlasPack(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for atlas packing." });
    return;
  }
  const body = await readJsonBody(request);
  const packed = packImageAtlas({
    projectRoot: requireBodyString(body.projectRoot, "projectRoot"),
    sources: Array.isArray(body.sources) ? body.sources : body.sourceImages,
    assetVirtualPath: requireBodyString(body.assetVirtualPath, "assetVirtualPath"),
    imageSetVirtualPath: requireBodyString(body.imageSetVirtualPath, "imageSetVirtualPath"),
    setName: body.setName,
    maxWidth: body.maxWidth,
    padding: body.padding,
    powerOfTwo: body.powerOfTwo === true,
    includeSource: body.includeSource === true,
  });
  sendJson(response, 200, packed);
}


async function handleImageAssets(url, response) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }

  const query = (url.searchParams.get("q") ?? "").toLowerCase();
  const projectIndex = buildDesktopProjectAssetIndex(root);
  const bundles = [projectIndex, ...(projectIndex.vanillaIndexes ?? [])];
  const items = bundles.flatMap((bundle) => listImageAssetItems(bundle))
    .filter((item) => !query || item.ref.toLowerCase().includes(query) || item.filePath?.toLowerCase().includes(query))
    .slice(0, 250);

  sendJson(response, 200, {
    projectRoot: root,
    count: items.length,
    items,
  });
}

async function handlePropertyUpdate(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for property updates." });
    return;
  }

  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const widgetId = requireBodyString(body.widgetId, "widgetId");
  const key = requireBodyString(body.key, "key");
  const values = Array.isArray(body.values) ? body.values : [body.value ?? ""];
  const projectRoot = body.project ? path.resolve(body.project) : null;
  const width = Number(body.width ?? 1280);
  const height = Number(body.height ?? 720);
  const language = body.language ?? "English";
  const previewState = body.previewState ?? body.state ?? "normal";

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${filePath}` });
    return;
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const updated = updateWidgetProperty(beforeSource, {
    filePath,
    widgetId,
    key,
    values,
  });
  if (!updated.ok) {
    sendJson(response, 400, { error: updated.reason });
    return;
  }

  const transaction = createEditTransaction({
    filePath,
    beforeSource,
    afterSource: updated.source,
    edit: updated.edit,
    label: `Update ${widgetId}.${key}`,
  });
  writeHistoryTransaction(transaction, projectRoot);
  fs.writeFileSync(filePath, updated.source, "utf8");

  const data = buildLayoutData({
    filePath,
    source: updated.source,
    projectRoot,
    width,
    height,
    language,
    previewState,
  });
  sendJson(response, 200, {
    transaction: {
      id: transaction.id,
      beforeHash: transaction.before.hash,
      afterHash: transaction.after.hash,
      historyPath: transaction.historyPath,
    },
    preview: data,
  });
}

async function handleBoxUpdate(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for box updates." });
    return;
  }

  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const widgetId = requireBodyString(body.widgetId, "widgetId");
  const projectRoot = body.project ? path.resolve(body.project) : null;
  const width = Number(body.width ?? 1280);
  const height = Number(body.height ?? 720);
  const language = body.language ?? "English";
  const previewState = body.previewState ?? body.state ?? "normal";
  const updates = [];

  if (Array.isArray(body.position)) updates.push(["position", body.position]);
  if (Array.isArray(body.size)) updates.push(["size", body.size]);
  if (body.props && typeof body.props === "object") {
    for (const [key, values] of Object.entries(body.props)) {
      updates.push([key, Array.isArray(values) ? values : [values]]);
    }
  }
  if (!updates.length) {
    sendJson(response, 400, { error: "Box update requires position, size, and/or props." });
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${filePath}` });
    return;
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  let nextSource = beforeSource;
  const edits = [];
  for (const [key, values] of updates) {
    const updated = updateWidgetProperty(nextSource, {
      filePath,
      widgetId,
      key,
      values,
    });
    if (!updated.ok) {
      sendJson(response, 400, { error: updated.reason });
      return;
    }
    nextSource = updated.source;
    edits.push({ key, ...updated.edit });
  }

  const transaction = createEditTransaction({
    filePath,
    beforeSource,
    afterSource: nextSource,
    edit: {
      type: "box",
      widgetId,
      edits,
    },
    label: `Update ${widgetId} box`,
  });
  writeHistoryTransaction(transaction, projectRoot);
  fs.writeFileSync(filePath, nextSource, "utf8");

  const data = buildLayoutData({
    filePath,
    source: nextSource,
    projectRoot,
    width,
    height,
    language,
    previewState,
  });
  sendJson(response, 200, {
    transaction: {
      id: transaction.id,
      beforeHash: transaction.before.hash,
      afterHash: transaction.after.hash,
      historyPath: transaction.historyPath,
    },
    preview: data,
  });
}

async function handleWidgetCreate(request, response) {
  await handleWidgetStructuralEdit(request, response, "create");
}

async function handleWidgetDelete(request, response) {
  await handleWidgetStructuralEdit(request, response, "delete");
}

async function handleWidgetReparent(request, response) {
  await handleWidgetStructuralEdit(request, response, "reparent");
}

async function handleLayoutPalette(url, response) {
  sendJson(response, 200, listWidgetPalette({
    query: url.searchParams.get("q") || undefined,
    projectRoot: url.searchParams.get("project") ? path.resolve(url.searchParams.get("project")) : null,
  }));
}

async function handleWidgetStructuralEdit(request, response, operation) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for widget structure updates." });
    return;
  }

  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const projectRoot = body.project ? path.resolve(body.project) : null;
  const width = Number(body.width ?? 1280);
  const height = Number(body.height ?? 720);
  const language = body.language ?? "English";
  const previewState = body.previewState ?? body.state ?? "normal";

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${filePath}` });
    return;
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const preset = operation === "create" && body.presetId
    ? instantiateWidgetPreset(body.presetId, {
      projectRoot,
      name: body.name || undefined,
      props: body.props,
    })
    : null;
  if (preset && !preset.ok) {
    sendJson(response, 400, { error: preset.reason });
    return;
  }
  const updated = operation === "create"
    ? createWidget(beforeSource, {
      filePath,
      parentWidgetId: requireBodyString(body.parentWidgetId, "parentWidgetId"),
      typeClass: preset?.typeClass ?? requireBodyString(body.typeClass, "typeClass"),
      name: preset?.name ?? requireBodyString(body.name, "name"),
      props: preset?.props ?? body.props,
    })
    : operation === "delete"
      ? deleteWidget(beforeSource, {
        filePath,
        widgetId: requireBodyString(body.widgetId, "widgetId"),
        allowDeleteLastRoot: body.allowDeleteLastRoot === true,
      })
      : reparentWidget(beforeSource, {
        filePath,
        widgetId: requireBodyString(body.widgetId, "widgetId"),
        parentWidgetId: requireBodyString(body.parentWidgetId, "parentWidgetId"),
      });
  if (!updated.ok) {
    sendJson(response, 400, { error: updated.reason });
    return;
  }

  const transaction = createEditTransaction({
    filePath,
    beforeSource,
    afterSource: updated.source,
    edit: updated.edit,
    label: `${operation} widget`,
  });
  writeHistoryTransaction(transaction, projectRoot);
  fs.writeFileSync(filePath, updated.source, "utf8");

  const data = buildLayoutData({
    filePath,
    source: updated.source,
    projectRoot,
    width,
    height,
    language,
    previewState,
  });
  sendJson(response, 200, {
    operation,
    widget: updated.widget,
    parent: updated.parent,
    transaction: {
      id: transaction.id,
      beforeHash: transaction.before.hash,
      afterHash: transaction.after.hash,
      historyPath: transaction.historyPath,
    },
    preview: data,
  });
}

async function handleHistoryRestore(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for history restore." });
    return;
  }

  const body = await readJsonBody(request);
  const filePath = path.resolve(requireBodyString(body.file, "file"));
  const historyPath = path.resolve(requireBodyString(body.historyPath, "historyPath"));
  const direction = body.direction === "redo" ? "redo" : "undo";
  const projectRoot = body.project ? path.resolve(body.project) : null;
  const width = Number(body.width ?? 1280);
  const height = Number(body.height ?? 720);
  const language = body.language ?? "English";
  const previewState = body.previewState ?? body.state ?? "normal";

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${filePath}` });
    return;
  }

  const historyRoot = historyRootFor(projectRoot);
  if (!isInside(historyRoot, historyPath) || !fs.existsSync(historyPath)) {
    sendJson(response, 404, { error: `History entry does not exist: ${historyPath}` });
    return;
  }

  const transaction = JSON.parse(fs.readFileSync(historyPath, "utf8"));
  if (path.resolve(transaction.filePath) !== filePath) {
    sendJson(response, 409, { error: "History entry belongs to a different layout file." });
    return;
  }

  const currentSource = fs.readFileSync(filePath, "utf8");
  const currentHash = hashSource(currentSource);
  const expectedHash = direction === "undo" ? transaction.after.hash : transaction.before.hash;
  if (currentHash !== expectedHash) {
    sendJson(response, 409, {
      error: `Cannot ${direction}: current file hash does not match the selected transaction.`,
      currentHash,
      expectedHash,
    });
    return;
  }

  const restored = direction === "undo" ? undoTransaction(transaction) : redoTransaction(transaction);
  const restoreTransaction = createEditTransaction({
    filePath,
    beforeSource: currentSource,
    afterSource: restored.source,
    edit: {
      start: 0,
      end: currentSource.length,
      oldText: currentSource,
      newText: restored.source,
    },
    label: `${direction} ${transaction.label ?? transaction.id}`,
  });
  writeHistoryTransaction(restoreTransaction, projectRoot);
  fs.writeFileSync(filePath, restored.source, "utf8");

  const data = buildLayoutData({
    filePath,
    source: restored.source,
    projectRoot,
    width,
    height,
    language,
    previewState,
  });
  sendJson(response, 200, {
    restoredHash: restored.restoredHash,
    transaction: {
      id: restoreTransaction.id,
      beforeHash: restoreTransaction.before.hash,
      afterHash: restoreTransaction.after.hash,
      historyPath: restoreTransaction.historyPath,
    },
    preview: data,
    history: readHistoryEntries(filePath, projectRoot),
  });
}

function buildLayoutData({ filePath, source, projectRoot, width, height, language = "English", previewState = "normal" }) {
  const projectIndex = projectRoot ? buildDesktopProjectAssetIndex(projectRoot) : null;
  const document = parseLayout(source, { filePath });
  const model = buildLayoutPreviewModel(document, {
    width: Number.isFinite(width) ? width : 1280,
    height: Number.isFinite(height) ? height : 720,
    projectIndex,
    language,
    previewState,
  });
  const data = buildPreviewData(model, {
    title: path.basename(filePath),
  });
  appendValidationDiagnostics(data, document, projectIndex);
  rewriteImageUrlsForServer(data, { projectRoot });
  return data;
}

function listImageAssetItems(assetIndex) {
  const direct = assetIndex.files
    .filter((filePath) => imageAssetExtensions.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => describeImageAsset({
      kind: assetIndex.source === "vanilla" ? "vanilla-asset" : "asset",
      ref: path.relative(assetIndex.root, filePath).replaceAll("\\", "/"),
      filePath,
      root: assetIndex.root,
    }));
  const sprites = assetIndex.imageSets.flatMap((imageSet) => {
    const textureRef = imageSet.textureRefs[0] ?? null;
    const texture = textureRef ? assetIndex.indexes.byLowerVirtual.get(textureRef.toLowerCase()) : null;
    return imageSet.images.map((image) => describeImageAsset({
      kind: assetIndex.source === "vanilla" ? "vanilla-imageset" : "imageset",
      ref: `set:${imageSet.name} image:${image.name}`,
      filePath: texture,
      root: assetIndex.root,
      imageSet: imageSet.virtualPath,
      textureRef,
      crop: image.pos && image.size ? {
        x: image.pos[0],
        y: image.pos[1],
        width: image.size[0],
        height: image.size[1],
      } : null,
    }));
  });
  return [...sprites, ...direct];
}

function describeImageAsset({ kind, ref, filePath, root, imageSet = null, textureRef = null, crop = null }) {
  const descriptor = {
    kind,
    ref,
    filePath: filePath ?? null,
    virtualPath: filePath ? path.relative(root, filePath).replaceAll("\\", "/") : textureRef,
    imageSet,
    textureRef,
    crop,
    url: null,
      nativeTexture: null,
  };
  if (!filePath) return descriptor;

  const ext = path.extname(filePath).toLowerCase();
  if (browserImageExtensions.has(ext)) {
    descriptor.url = `/api/asset?file=${encodeURIComponent(filePath)}`;
    return descriptor;
  }
  if (nativeTextureExtensions.has(ext)) {
    descriptor.nativeTexture = nativeTextureDescriptor(filePath, root);
  }
  return descriptor;
}

function nativeTextureDescriptor(filePath, projectRoot = null) {
  const ext = path.extname(filePath).toLowerCase();
  const params = new URLSearchParams({ file: filePath });
  if (projectRoot) params.set("project", projectRoot);
  return {
    kind: "source-texture",
    filePath,
    ext,
    format: ext.replace(/^\./, ""),
    url: `/api/texture/native?${params.toString()}`,
  };
}

function appendValidationDiagnostics(data, document, projectIndex) {
  const diagnostics = validateLayoutDocument(document, { projectIndex })
    .map((diagnostic) => ({
      ...diagnostic,
      type: diagnostic.code,
      source: "validation",
    }));
  data.diagnostics.push(...diagnostics);
}

async function handleAsset(url, response) {
  const filePath = url.searchParams.get("file");
  if (!filePath) {
    sendJson(response, 400, { error: "Missing file query parameter." });
    return;
  }

  const absoluteFilePath = path.resolve(filePath);
  if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
    sendJson(response, 404, { error: `Asset file does not exist: ${absoluteFilePath}` });
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeFor(absoluteFilePath),
    "Cache-Control": "no-store",
  });
  fs.createReadStream(absoluteFilePath).pipe(response);
}

async function handleNativeTexture(url, response) {
  const filePath = url.searchParams.get("file");
  if (!filePath) {
    sendJson(response, 400, { error: "Missing file query parameter." });
    return;
  }

  const absoluteFilePath = path.resolve(filePath);
  const ext = path.extname(absoluteFilePath).toLowerCase();
  if (!nativeTextureExtensions.has(ext)) {
    sendJson(response, 415, { error: `Native texture endpoint does not serve ${ext || "extensionless"} files.` });
    return;
  }
  if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
    sendJson(response, 404, { error: `Texture file does not exist: ${absoluteFilePath}` });
    return;
  }

  const projectRoot = url.searchParams.get("project");
  const cacheRoot = projectRoot
    ? path.join(path.resolve(projectRoot), ".dzui", "preview-cache")
    : path.join(environmentConfigRoot, ".dzui", "preview-cache");
  const decoded = ensureDecodedPreviewAsset(absoluteFilePath, { cacheRoot });
  if (!decoded.ok) {
    sendJson(response, 422, {
      error: decoded.reason || "Texture preview decode failed.",
      filePath: absoluteFilePath,
      format: ext.slice(1),
      cacheRoot,
    });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
    "X-DZUI-Texture-Format": ext.slice(1),
    "X-DZUI-Texture-Decoder": decoded.decoder ?? (decoded.cached ? "cache" : "unknown"),
  });
  fs.createReadStream(decoded.outPath).pipe(response);
}

async function handleRawNativeTexture(url, response) {
  const filePath = url.searchParams.get("file");
  if (!filePath) {
    sendJson(response, 400, { error: "Missing file query parameter." });
    return;
  }

  const absoluteFilePath = path.resolve(filePath);
  const ext = path.extname(absoluteFilePath).toLowerCase();
  if (!nativeTextureExtensions.has(ext)) {
    sendJson(response, 415, { error: `Native texture endpoint does not serve ${ext || "extensionless"} files.` });
    return;
  }
  if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
    sendJson(response, 404, { error: `Texture file does not exist: ${absoluteFilePath}` });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Cache-Control": "no-store",
    "X-DZUI-Texture-Format": ext.slice(1),
  });
  fs.createReadStream(absoluteFilePath).pipe(response);
}

function writeHistoryTransaction(transaction, projectRoot) {
  const historyRoot = path.join(projectRoot ?? process.cwd(), ".dzui", "history");
  fs.mkdirSync(historyRoot, { recursive: true });
  const safeBase = path.basename(transaction.filePath ?? "layout").replace(/[^A-Za-z0-9_.-]/g, "_");
  const historyPath = path.join(historyRoot, `${Date.now()}-${safeBase}.json`);
  const stored = {
    ...transaction,
    historyPath,
  };
  fs.writeFileSync(historyPath, JSON.stringify(stored, null, 2), "utf8");
  transaction.historyPath = historyPath;
}

function withoutSource(value) {
  const { source, ...rest } = value;
  return rest;
}

function historyRootFor(projectRoot) {
  return path.join(projectRoot ?? process.cwd(), ".dzui", "history");
}

function readHistoryEntries(filePath, projectRoot) {
  const historyRoot = historyRootFor(projectRoot);
  if (!fs.existsSync(historyRoot) || !fs.statSync(historyRoot).isDirectory()) return [];
  return fs.readdirSync(historyRoot)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readHistoryEntry(path.join(historyRoot, file)))
    .filter((entry) => entry && path.resolve(entry.filePath) === filePath)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      createdAt: entry.createdAt,
      historyPath: entry.historyPath,
      beforeHash: entry.before?.hash,
      afterHash: entry.after?.hash,
      edit: entry.edit ? {
        start: entry.edit.start,
        end: entry.edit.end,
      } : null,
    }));
}

function readHistoryEntry(filePath) {
  try {
    const entry = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...entry,
      historyPath: entry.historyPath ?? filePath,
    };
  } catch {
    return null;
  }
}

function resolveExistingFile(file) {
  if (!file) return { ok: false, status: 400, error: "Missing file query parameter." };
  const value = path.resolve(file);
  if (!fs.existsSync(value) || !fs.statSync(value).isFile()) {
    return { ok: false, status: 404, error: `Layout file does not exist: ${value}` };
  }
  return { ok: true, value };
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function readJsonFile(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`JSON file does not exist: ${absolute}`);
  }
  return JSON.parse(fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/, ""));
}

function requireBodyString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value;
}

async function serveStatic(requestPath, response) {
  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const resolved = path.resolve(publicDir, `.${cleanPath}`);
  if (!resolved.startsWith(publicDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    sendText(response, 404, "Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": mimeFor(resolved),
    "Cache-Control": "no-store",
  });
  fs.createReadStream(resolved).pipe(response);
}

function rewriteImageUrlsForServer(data, options = {}) {
  const projectRoot = options.projectRoot ?? null;
  for (const node of data.nodes) {
    for (const image of [...node.images, ...(node.styleRender?.items ?? [])]) {
      if (image.url && image.filePath) {
        image.url = `/api/asset?file=${encodeURIComponent(image.filePath)}`;
      }
      if (image.nativeTexture?.filePath) {
        image.nativeTexture = nativeTextureDescriptor(image.nativeTexture.filePath, projectRoot);
      } else if (!image.url && image.filePath && nativeTextureExtensions.has(path.extname(image.filePath).toLowerCase())) {
        image.nativeTexture = nativeTextureDescriptor(image.filePath, projectRoot);
      }
    }
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value, null, 2));
}

function sendText(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(value);
}

function parseArgs(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(arg, next);
      index += 1;
    } else {
      options.set(arg, "true");
    }
  }
  return options;
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".bmp") return "image/bmp";
  return "application/octet-stream";
}
