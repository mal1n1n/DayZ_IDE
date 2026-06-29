#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyLayoutPatch,
  buildLayoutDiffReport,
  buildLayoutPreviewModel,
  buildLayoutTransformPatch,
  buildTextureConversionPlan,
  buildToolchainReadinessReport,
  buildEngineCapturePlan,
  buildEngineLaunchPlan,
  buildEnginePreviewWorkspace,
  buildFontCoverageReport,
  buildGeometryDiffReport,
  buildPreviewData,
  buildPboWorkflowPlan,
  buildPluginRuntimePackage,
  buildPluginRuntimeRegistry,
  buildPluginSdkReport,
  buildWorkshopPublishPlan,
  buildProjectAssetIndex,
  createEditTransaction,
  createWidget,
  deleteWidget,
  diffPngFiles,
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
  previewCacheKey,
  redoTransaction,
  readProjectSettings,
  readPluginTrustPolicy,
  reparentWidget,
  resolveLayoutPatchConflicts,
  listWidgetPalette,
  packImageAtlas,
  runPluginRuntimeCommand,
  runEngineCaptureWorkflow,
  runPboWorkflow,
  runWorkshopPublishWorkflow,
  runTextureConversionWorkflow,
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
  writeEnginePreviewWorkspace,
  writeProjectSettings,
} from "../../../packages/core/src/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const args = parseArgs(process.argv.slice(2));
const port = Number(args.get("--port") ?? process.env.PORT ?? 5173);
const host = args.get("--host") ?? "127.0.0.1";
const browserImageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const imageAssetExtensions = new Set([...browserImageExtensions, ".edds", ".paa", ".tga", ".dds"]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
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
    if (url.pathname === "/api/project/settings") {
      await handleProjectSettings(url, response);
      return;
    }
    if (url.pathname === "/api/project/settings/save") {
      await handleProjectSettingsSave(request, response);
      return;
    }
    if (url.pathname === "/api/toolchain/readiness") {
      await handleToolchainReadiness(url, response);
      return;
    }
    if (url.pathname === "/api/engine/launch-plan") {
      await handleEngineLaunchPlan(url, response);
      return;
    }
    if (url.pathname === "/api/engine/preview-workspace") {
      await handleEnginePreviewWorkspace(url, response);
      return;
    }
    if (url.pathname === "/api/engine/preview-workspace/save") {
      await handleEnginePreviewWorkspaceSave(request, response);
      return;
    }
    if (url.pathname === "/api/engine/geometry-diff") {
      await handleEngineGeometryDiff(url, response);
      return;
    }
    if (url.pathname === "/api/engine/pixel-diff") {
      await handleEnginePixelDiff(url, response);
      return;
    }
    if (url.pathname === "/api/engine/capture/plan") {
      await handleEngineCapturePlan(url, response);
      return;
    }
    if (url.pathname === "/api/engine/capture/run") {
      await handleEngineCaptureRun(request, response);
      return;
    }
    if (url.pathname === "/api/build/plan") {
      await handleBuildPlan(url, response);
      return;
    }
    if (url.pathname === "/api/build/run") {
      await handleBuildRun(url, response);
      return;
    }
    if (url.pathname === "/api/workshop/plan") {
      await handleWorkshopPlan(url, response);
      return;
    }
    if (url.pathname === "/api/workshop/run") {
      await handleWorkshopRun(request, response);
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
    if (url.pathname === "/api/texture/convert/plan") {
      await handleTextureConvertPlan(request, response);
      return;
    }
    if (url.pathname === "/api/texture/convert/run") {
      await handleTextureConvertRun(request, response);
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
    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  console.log(`DZUI shell running at http://${host}:${port}/`);
});

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

async function handleToolchainReadiness(url, response) {
  sendJson(response, 200, buildToolchainReadinessReport({
    projectRoot: url.searchParams.get("project") || undefined,
    layoutPath: url.searchParams.get("layout") || undefined,
    addonSource: url.searchParams.get("addon") || undefined,
    outputRoot: url.searchParams.get("out") || undefined,
    prefix: url.searchParams.get("prefix") || undefined,
    toolsRoot: url.searchParams.get("tools") || undefined,
    dayzRoot: url.searchParams.get("dayz") || undefined,
    pDrive: url.searchParams.get("pdrive") || undefined,
    pboPath: url.searchParams.get("pbo") || undefined,
    contentRoot: url.searchParams.get("content") || undefined,
    workshopItemId: url.searchParams.get("item") || url.searchParams.get("workshopId") || undefined,
    title: url.searchParams.get("title") || undefined,
    changeNote: url.searchParams.get("changeNote") || undefined,
    changeNoteFile: url.searchParams.get("changeNoteFile") || undefined,
    previewImage: url.searchParams.get("preview") || undefined,
    sourceImage: url.searchParams.get("texture") || undefined,
    textureOutputPath: url.searchParams.get("textureOut") || undefined,
    textureFormat: url.searchParams.get("textureFormat") || undefined,
    converterPath: url.searchParams.get("converter") || undefined,
    captureOutputRoot: url.searchParams.get("captureOut") || undefined,
    expectedScreenshotPath: url.searchParams.get("expected") || undefined,
    actualScreenshotPath: url.searchParams.get("actual") || undefined,
    geometryDumpPath: url.searchParams.get("geometry") || undefined,
    pixelDiffPath: url.searchParams.get("pixelDiff") || undefined,
    allowDiagnostics: url.searchParams.get("allowDiagnostics") === "true",
    requirePbo: url.searchParams.get("requirePbo") === "false" ? false : undefined,
  }));
}

async function handleEngineLaunchPlan(url, response) {
  const projectRoot = url.searchParams.get("project");
  const layoutPath = url.searchParams.get("layout");
  if (!projectRoot) {
    sendJson(response, 400, { error: "Missing project query parameter." });
    return;
  }
  if (!layoutPath) {
    sendJson(response, 400, { error: "Missing layout query parameter." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  sendJson(response, 200, buildEngineLaunchPlan({
    mode: url.searchParams.get("mode") || undefined,
    projectRoot: root,
    layoutPath,
    missionPath: url.searchParams.get("mission") || undefined,
    toolsRoot: url.searchParams.get("tools") || undefined,
    dayzRoot: url.searchParams.get("dayz") || undefined,
    pDrive: url.searchParams.get("pdrive") || undefined,
  }));
}

async function handleEnginePreviewWorkspace(url, response) {
  const workspaceOptions = resolveEnginePreviewWorkspaceQuery(url);
  if (!workspaceOptions.ok) {
    sendJson(response, workspaceOptions.status, { error: workspaceOptions.error });
    return;
  }
  sendJson(response, 200, buildEnginePreviewWorkspace(workspaceOptions.value));
}

async function handleEnginePreviewWorkspaceSave(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for engine preview workspace generation." });
    return;
  }
  const body = await readJsonBody(request);
  const projectRoot = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
  const layoutPath = path.resolve(requireBodyString(body.layoutPath, "layoutPath"));
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
    return;
  }
  if (!fs.existsSync(layoutPath) || !fs.statSync(layoutPath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${layoutPath}` });
    return;
  }
  sendJson(response, 200, writeEnginePreviewWorkspace({
    projectRoot,
    layoutPath,
    previewRoot: body.previewRoot || undefined,
    missionName: body.missionName || undefined,
    worldName: body.worldName || undefined,
    menuClass: body.menuClass || undefined,
    width: body.width,
    height: body.height,
    language: body.language,
    toolsRoot: body.toolsRoot || undefined,
    dayzRoot: body.dayzRoot || undefined,
    pDrive: body.pDrive || undefined,
  }));
}

async function handleEngineGeometryDiff(url, response) {
  const layoutPath = url.searchParams.get("layout");
  const dumpPath = url.searchParams.get("dump");
  if (!layoutPath) {
    sendJson(response, 400, { error: "Missing layout query parameter." });
    return;
  }
  if (!dumpPath) {
    sendJson(response, 400, { error: "Missing dump query parameter." });
    return;
  }
  const layout = path.resolve(layoutPath);
  const dump = path.resolve(dumpPath);
  if (!fs.existsSync(layout) || !fs.statSync(layout).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${layout}` });
    return;
  }
  if (!fs.existsSync(dump) || !fs.statSync(dump).isFile()) {
    sendJson(response, 404, { error: `Engine dump file does not exist: ${dump}` });
    return;
  }
  const projectRoot = url.searchParams.get("project") ? path.resolve(url.searchParams.get("project")) : null;
  const projectIndex = projectRoot ? buildProjectAssetIndex(projectRoot) : null;
  const document = parseLayout(fs.readFileSync(layout, "utf8"), { filePath: layout });
  const model = buildLayoutPreviewModel(document, {
    width: Number(url.searchParams.get("width") ?? 1280),
    height: Number(url.searchParams.get("height") ?? 720),
    projectIndex,
    language: url.searchParams.get("language") ?? "English",
  });
  const engineDump = JSON.parse(fs.readFileSync(dump, "utf8"));
  sendJson(response, 200, buildGeometryDiffReport(model, engineDump, {
    tolerancePx: Number(url.searchParams.get("tolerance") ?? 1),
  }));
}

async function handleEnginePixelDiff(url, response) {
  const expectedPath = url.searchParams.get("expected");
  const actualPath = url.searchParams.get("actual");
  if (!expectedPath) {
    sendJson(response, 400, { error: "Missing expected query parameter." });
    return;
  }
  if (!actualPath) {
    sendJson(response, 400, { error: "Missing actual query parameter." });
    return;
  }
  const expected = path.resolve(expectedPath);
  const actual = path.resolve(actualPath);
  if (!fs.existsSync(expected) || !fs.statSync(expected).isFile()) {
    sendJson(response, 404, { error: `Expected PNG does not exist: ${expected}` });
    return;
  }
  if (!fs.existsSync(actual) || !fs.statSync(actual).isFile()) {
    sendJson(response, 404, { error: `Actual PNG does not exist: ${actual}` });
    return;
  }
  sendJson(response, 200, diffPngFiles({
    expectedPath: expected,
    actualPath: actual,
    diffPath: url.searchParams.get("diff") || undefined,
    tolerance: Number(url.searchParams.get("tolerance") ?? 0),
    ignoreAlpha: url.searchParams.get("ignoreAlpha") === "true",
  }));
}

async function handleEngineCapturePlan(url, response) {
  const options = readEngineCaptureQuery(url);
  if (!options.ok) {
    sendJson(response, options.status, { error: options.error });
    return;
  }
  sendJson(response, 200, buildEngineCapturePlan(options.value));
}

async function handleEngineCaptureRun(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for engine capture run." });
    return;
  }
  const body = await readJsonBody(request);
  const projectRoot = path.resolve(requireBodyString(body.projectRoot, "projectRoot"));
  const layoutPath = path.resolve(requireBodyString(body.layoutPath, "layoutPath"));
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${projectRoot}` });
    return;
  }
  if (!fs.existsSync(layoutPath) || !fs.statSync(layoutPath).isFile()) {
    sendJson(response, 404, { error: `Layout file does not exist: ${layoutPath}` });
    return;
  }
  sendJson(response, 200, runEngineCaptureWorkflow({
    projectRoot,
    layoutPath,
    outputRoot: body.outputRoot || undefined,
    expectedScreenshotPath: body.expectedScreenshotPath || undefined,
    actualScreenshotPath: body.actualScreenshotPath || undefined,
    geometryDumpPath: body.geometryDumpPath || undefined,
    pixelDiffPath: body.pixelDiffPath || undefined,
    toolsRoot: body.toolsRoot || undefined,
    dayzRoot: body.dayzRoot || undefined,
    pDrive: body.pDrive || undefined,
    timeoutMs: body.timeoutMs,
    waitMs: body.waitMs,
    allowNotReady: body.allowNotReady === true,
  }));
}

function resolveEnginePreviewWorkspaceQuery(url) {
  const projectRoot = url.searchParams.get("project");
  const layoutPath = url.searchParams.get("layout");
  if (!projectRoot) {
    return { ok: false, status: 400, error: "Missing project query parameter." };
  }
  if (!layoutPath) {
    return { ok: false, status: 400, error: "Missing layout query parameter." };
  }
  const root = path.resolve(projectRoot);
  const layout = path.resolve(layoutPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { ok: false, status: 404, error: `Project root does not exist: ${root}` };
  }
  if (!fs.existsSync(layout) || !fs.statSync(layout).isFile()) {
    return { ok: false, status: 404, error: `Layout file does not exist: ${layout}` };
  }
  return {
    ok: true,
    value: {
      projectRoot: root,
      layoutPath: layout,
      previewRoot: url.searchParams.get("out") || undefined,
      missionName: url.searchParams.get("missionName") || undefined,
      worldName: url.searchParams.get("world") || undefined,
      menuClass: url.searchParams.get("menuClass") || undefined,
      width: Number(url.searchParams.get("width") || 1280),
      height: Number(url.searchParams.get("height") || 720),
      language: url.searchParams.get("language") || undefined,
      toolsRoot: url.searchParams.get("tools") || undefined,
      dayzRoot: url.searchParams.get("dayz") || undefined,
      pDrive: url.searchParams.get("pdrive") || undefined,
    },
  };
}

function readEngineCaptureQuery(url) {
  const projectRoot = url.searchParams.get("project");
  const layoutPath = url.searchParams.get("layout");
  if (!projectRoot) return { ok: false, status: 400, error: "Missing project query parameter." };
  if (!layoutPath) return { ok: false, status: 400, error: "Missing layout query parameter." };
  const root = path.resolve(projectRoot);
  const layout = path.resolve(layoutPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { ok: false, status: 404, error: `Project root does not exist: ${root}` };
  }
  if (!fs.existsSync(layout) || !fs.statSync(layout).isFile()) {
    return { ok: false, status: 404, error: `Layout file does not exist: ${layout}` };
  }
  return {
    ok: true,
    value: {
      projectRoot: root,
      layoutPath: layout,
      outputRoot: url.searchParams.get("out") || undefined,
      expectedScreenshotPath: url.searchParams.get("expected") || undefined,
      actualScreenshotPath: url.searchParams.get("actual") || undefined,
      geometryDumpPath: url.searchParams.get("geometry") || undefined,
      pixelDiffPath: url.searchParams.get("pixelDiff") || undefined,
      toolsRoot: url.searchParams.get("tools") || undefined,
      dayzRoot: url.searchParams.get("dayz") || undefined,
      pDrive: url.searchParams.get("pdrive") || undefined,
    },
  };
}

async function handleBuildPlan(url, response) {
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
  sendJson(response, 200, buildPboWorkflowPlan({
    projectRoot: root,
    addonSource: url.searchParams.get("addon") || undefined,
    outputRoot: url.searchParams.get("out") || undefined,
    prefix: url.searchParams.get("prefix") || undefined,
    toolsRoot: url.searchParams.get("tools") || undefined,
    dayzRoot: url.searchParams.get("dayz") || undefined,
    pDrive: url.searchParams.get("pdrive") || undefined,
    allowDiagnostics: url.searchParams.get("allowDiagnostics") === "true",
  }));
}

async function handleBuildRun(url, response) {
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
  const timeoutMs = url.searchParams.has("timeoutMs")
    ? Number(url.searchParams.get("timeoutMs"))
    : undefined;
  sendJson(response, 200, runPboWorkflow({
    projectRoot: root,
    addonSource: url.searchParams.get("addon") || undefined,
    outputRoot: url.searchParams.get("out") || undefined,
    prefix: url.searchParams.get("prefix") || undefined,
    toolsRoot: url.searchParams.get("tools") || undefined,
    dayzRoot: url.searchParams.get("dayz") || undefined,
    pDrive: url.searchParams.get("pdrive") || undefined,
    allowDiagnostics: url.searchParams.get("allowDiagnostics") === "true",
    allowNotReady: url.searchParams.get("allowNotReady") === "true",
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
  }));
}

async function handleWorkshopPlan(url, response) {
  const options = resolveWorkshopPublishQuery(url);
  if (!options.ok) {
    sendJson(response, options.status, { error: options.error });
    return;
  }
  sendJson(response, 200, buildWorkshopPublishPlan(options.value));
}

async function handleWorkshopRun(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for Workshop publish run." });
    return;
  }
  const body = await readJsonBody(request);
  const projectRoot = body.projectRoot;
  if (typeof projectRoot !== "string" || !projectRoot.trim()) {
    sendJson(response, 400, { error: "projectRoot is required." });
    return;
  }
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    sendJson(response, 404, { error: `Project root does not exist: ${root}` });
    return;
  }
  const commandFile = body.commandFile || body.commandJson;
  const command = body.command ?? (commandFile ? readJsonFile(commandFile) : undefined);
  sendJson(response, 200, runWorkshopPublishWorkflow({
    projectRoot: root,
    addonSource: body.addonSource || undefined,
    outputRoot: body.outputRoot || undefined,
    prefix: body.prefix || undefined,
    toolsRoot: body.toolsRoot || undefined,
    dayzRoot: body.dayzRoot || undefined,
    pDrive: body.pDrive || undefined,
    pboPath: body.pboPath || undefined,
    contentRoot: body.contentRoot || undefined,
    workshopItemId: body.workshopItemId || body.itemId || undefined,
    title: body.title || undefined,
    changeNote: body.changeNote || undefined,
    changeNoteFile: body.changeNoteFile || undefined,
    previewImage: body.previewImage || undefined,
    command,
    allowDiagnostics: body.allowDiagnostics === true,
    allowNotReady: body.allowNotReady === true,
    requirePbo: body.requirePbo === false ? false : undefined,
    timeoutMs: Number.isFinite(Number(body.timeoutMs)) ? Number(body.timeoutMs) : undefined,
  }));
}

function resolveWorkshopPublishQuery(url) {
  const projectRoot = url.searchParams.get("project");
  if (!projectRoot) return { ok: false, status: 400, error: "Missing project query parameter." };
  const root = path.resolve(projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { ok: false, status: 404, error: `Project root does not exist: ${root}` };
  }
  const commandFile = url.searchParams.get("commandJson") || url.searchParams.get("commandFile");
  return {
    ok: true,
    value: {
      projectRoot: root,
      addonSource: url.searchParams.get("addon") || undefined,
      outputRoot: url.searchParams.get("out") || undefined,
      prefix: url.searchParams.get("prefix") || undefined,
      toolsRoot: url.searchParams.get("tools") || undefined,
      dayzRoot: url.searchParams.get("dayz") || undefined,
      pDrive: url.searchParams.get("pdrive") || undefined,
      pboPath: url.searchParams.get("pbo") || undefined,
      contentRoot: url.searchParams.get("content") || undefined,
      workshopItemId: url.searchParams.get("item") || url.searchParams.get("workshopId") || undefined,
      title: url.searchParams.get("title") || undefined,
      changeNote: url.searchParams.get("changeNote") || undefined,
      changeNoteFile: url.searchParams.get("changeNoteFile") || undefined,
      previewImage: url.searchParams.get("preview") || undefined,
      command: commandFile ? readJsonFile(commandFile) : undefined,
      allowDiagnostics: url.searchParams.get("allowDiagnostics") === "true",
      requirePbo: url.searchParams.get("requirePbo") === "false" ? false : undefined,
    },
  };
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
    const projectIndex = buildProjectAssetIndex(root);
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
  const projectIndex = buildProjectAssetIndex(root);
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

  const projectIndex = buildProjectAssetIndex(root);
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

async function handleTextureConvertPlan(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for texture conversion plans." });
    return;
  }
  const body = await readJsonBody(request);
  const plan = buildTextureConversionPlan(readTextureConversionBody(body));
  sendJson(response, plan.ready ? 200 : 409, plan);
}

async function handleTextureConvertRun(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Use POST for texture conversion runs." });
    return;
  }
  const body = await readJsonBody(request);
  const run = runTextureConversionWorkflow({
    ...readTextureConversionBody(body),
    timeoutMs: Number(body.timeoutMs ?? 120000),
    allowNotReady: body.allowNotReady === true,
  });
  sendJson(response, run.ok ? 200 : 400, run);
}

function readTextureConversionBody(body) {
  return {
    sourceImage: requireBodyString(body.sourceImage, "sourceImage"),
    outputPath: body.outputPath,
    format: body.format,
    toolsRoot: body.toolsRoot,
    converterPath: body.converterPath,
    command: body.command,
  };
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
  const projectIndex = buildProjectAssetIndex(root);
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
  if (!updates.length) {
    sendJson(response, 400, { error: "Box update requires position and/or size." });
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
  const projectIndex = projectRoot ? buildProjectAssetIndex(projectRoot) : null;
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
    cacheRoot: projectRoot ? path.join(projectRoot, ".dzui/preview-cache") : ".dzui/preview-cache",
  });
  appendValidationDiagnostics(data, document, projectIndex);
  rewriteImageUrlsForServer(data);
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
    cachePath: null,
    decode: null,
  };
  if (!filePath) return descriptor;

  const ext = path.extname(filePath).toLowerCase();
  if (browserImageExtensions.has(ext)) {
    descriptor.url = `/api/asset?file=${encodeURIComponent(filePath)}`;
    return descriptor;
  }
  if (ext === ".edds" || ext === ".paa" || ext === ".tga" || ext === ".dds") {
    const cachePath = path.join(root, ".dzui/preview-cache", `${previewCacheKey(filePath)}.png`);
    descriptor.cachePath = cachePath;
    const decoded = ensureDecodedPreviewAsset(filePath, { outputPath: cachePath });
    descriptor.decode = decoded;
    if (decoded.ok && fs.existsSync(cachePath)) {
      descriptor.url = `/api/asset?file=${encodeURIComponent(cachePath)}`;
    }
  }
  return descriptor;
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

function rewriteImageUrlsForServer(data) {
  for (const node of data.nodes) {
    for (const image of node.images) {
      if (image.url && image.filePath) {
        image.url = `/api/asset?file=${encodeURIComponent(image.filePath)}`;
      }
      if (!image.url && image.cachePath && image.filePath) {
        const decoded = ensureDecodedPreviewAsset(image.filePath, { outputPath: image.cachePath });
        image.decode = decoded;
        if (decoded.ok && fs.existsSync(image.cachePath)) {
          image.url = `/api/asset?file=${encodeURIComponent(image.cachePath)}`;
        }
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
