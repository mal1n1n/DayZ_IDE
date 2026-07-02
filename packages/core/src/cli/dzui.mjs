#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import {
  applyLayoutPatch,
  buildLayoutPreviewModel,
  buildLayoutTransformPatch,
  buildLayoutDiffReport,
  buildFontCoverageReport,
  buildPluginRuntimePackage,
  buildPluginRuntimeRegistry,
  buildPluginSdkReport,
  buildProjectAssetIndex,
  createWidget,
  deleteWidget,
  ensureDecodedPreviewAsset,
  fontRegistryToJson,
  generateControllerSkeleton,
  generateLayoutPatch,
  importFontAsset,
  importImageAsset,
  installPluginRuntimeTrust,
  instantiateWidgetPreset,
  layoutToPlainObject,
  listWidgetPalette,
  packImageAtlas,
  parseLayout,
  parseStyleFile,
  renderPreviewHtml,
  readProjectSettings,
  readPluginTrustPolicy,
  reparentWidget,
  resolveLayoutPatchConflicts,
  runPluginRuntimeCommand,
  styleFileToJson,
  summarizeLayout,
  updateStringTableCsv,
  upsertStyleProperty,
  upsertImageSetSprite,
  validateLayoutDocument,
  validateProject,
  walkWidgets,
  verifyPluginRuntimePackage,
  writePluginRuntimePackage,
  writeProjectSettings,
} from "../index.mjs";

const [command, ...args] = process.argv.slice(2);

try {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(command ? 0 : 2);
  }

  if (command === "parse") {
    runParse(args);
  } else if (command === "inspect") {
    runInspect(args);
  } else if (command === "preview") {
    runPreview(args);
  } else if (command === "decode") {
    runDecode(args);  } else if (command === "validate") {
    runValidate(args);
  } else if (command === "validate-project") {
    runValidateProject(args);  } else if (command === "settings-get") {
    runSettingsGet(args);
  } else if (command === "settings-set") {
    runSettingsSet(args);
  } else if (command === "plugins") {
    runPlugins(args);
  } else if (command === "plugins-runtime") {
    runPluginsRuntime(args);
  } else if (command === "plugins-package") {
    runPluginsPackage(args);
  } else if (command === "plugins-verify") {
    runPluginsVerify(args);
  } else if (command === "plugins-trust") {
    runPluginsTrust(args);
  } else if (command === "plugins-command") {
    runPluginsCommand(args).catch(handleFatalError);
  } else if (command === "layout-create") {
    runLayoutCreate(args);
  } else if (command === "layout-palette") {
    runLayoutPalette(args);
  } else if (command === "layout-delete") {
    runLayoutDelete(args);
  } else if (command === "layout-reparent") {
    runLayoutReparent(args);
  } else if (command === "layout-transform") {
    runLayoutTransform(args);
  } else if (command === "layout-diff") {
    runLayoutDiff(args);
  } else if (command === "layout-patch") {
    runLayoutPatch(args);
  } else if (command === "layout-generate-patch") {
    runLayoutGeneratePatch(args);
  } else if (command === "layout-resolve-patch") {
    runLayoutResolvePatch(args);
  } else if (command === "controller") {
    runController(args);
  } else if (command === "stringtable-set") {
    runStringTableSet(args);
  } else if (command === "style-list") {
    runStyleList(args);
  } else if (command === "style-set") {
    runStyleSet(args);
  } else if (command === "font-list") {
    runFontList(args);
  } else if (command === "font-check") {
    runFontCheck(args);
  } else if (command === "font-coverage") {
    runFontCoverage(args);
  } else if (command === "font-import") {
    runFontImport(args);
  } else if (command === "imageset-upsert") {
    runImageSetUpsert(args);
  } else if (command === "image-import") {
    runImageImport(args);
  } else if (command === "atlas-pack") {
    runAtlasPack(args);
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function runParse(args) {
  const { filePath, flags } = parseFileArgs(args);
  const document = readLayoutDocument(filePath);
  const plain = layoutToPlainObject(document, {
    includeSource: flags.has("--source"),
    includeTokens: flags.has("--tokens"),
  });
  console.log(JSON.stringify(plain, null, 2));
}

function runInspect(args) {
  const { filePath } = parseFileArgs(args);
  const document = readLayoutDocument(filePath);
  const summary = summarizeLayout(document);

  console.log(`${path.relative(process.cwd(), filePath) || filePath}`);
  console.log(`widgets: ${summary.widgetCount}`);
  console.log(`properties: ${summary.propertyCount}`);
  console.log(`image refs: ${summary.imageRefCount}`);
  console.log("");

  for (const { node, depth } of walkWidgets(document)) {
    const indent = "  ".repeat(depth);
    console.log(`${indent}${node.typeClass} ${node.name} (${node.props.length} props, ${node.children.length} children)`);
  }

  if (summary.imageRefs.length > 0) {
    console.log("");
    console.log("image refs:");
    for (const ref of summary.imageRefs) {
      console.log(`  ${ref.line}: ${ref.widget}.${ref.key} = ${ref.ref}`);
    }
  }

  printDiagnostics(document.diagnostics);
}

function runPreview(args) {
  const { filePath, options } = parseOptionArgs(args);
  const width = Number(options.get("--width") ?? 1280);
  const height = Number(options.get("--height") ?? 720);
  const projectRoot = options.has("--project") ? path.resolve(options.get("--project")) : null;
  const outPath = path.resolve(options.get("--out") ?? defaultPreviewPath(filePath));
  const projectIndex = projectRoot ? buildProjectAssetIndex(projectRoot) : null;
  const document = readLayoutDocument(filePath);
  const model = buildLayoutPreviewModel(document, {
    width,
    height,
    projectIndex,
    language: options.get("--language") ?? "English",
    previewState: options.get("--state") ?? options.get("--preview-state") ?? "normal",
  });
  const html = renderPreviewHtml(model, {
    title: path.basename(filePath),
    cacheRoot: projectRoot ? path.join(projectRoot, ".dzui/preview-cache") : ".dzui/preview-cache",
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  console.log(outPath);
}

function runDecode(args) {
  const { filePath, options } = parseOptionArgs(args);
  const outPath = options.has("--out")
    ? path.resolve(options.get("--out"))
    : path.resolve(".dzui", "preview-cache", `${path.basename(filePath)}.png`);
  const decoded = ensureDecodedPreviewAsset(filePath, {
    outputPath: outPath,
    texconvPath: options.get("--texconv"),
    externalDecoder: options.has("--decoder-json") ? readJsonOption(options.get("--decoder-json")) : undefined,
  });
  if (!decoded.ok) {
    console.error(decoded.reason);
    process.exit(1);
  }
  console.log(decoded.outPath);
}


function runSettingsSet(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const patch = {};
  if (options.has("--layout")) patch.layoutPath = options.get("--layout");
  const preview = {};
  if (options.has("--width")) preview.width = Number(options.get("--width"));
  if (options.has("--height")) preview.height = Number(options.get("--height"));
  if (options.has("--language")) preview.language = options.get("--language");
  if (options.has("--state")) preview.state = options.get("--state");
  if (options.has("--preview-state")) preview.state = options.get("--preview-state");
  if (Object.keys(preview).length > 0) patch.preview = preview;
  console.log(JSON.stringify(writeProjectSettings(projectRoot, patch), null, 2));
}

function runPlugins(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const report = buildPluginSdkReport(projectRoot);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready && !options.has("--allow-diagnostics")) process.exit(1);
}

function runPluginsRuntime(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const registry = buildPluginRuntimeRegistry(projectRoot);
  console.log(JSON.stringify(registry, null, 2));
  if (!registry.ready && !options.has("--allow-diagnostics")) process.exit(1);
}

function runPluginsPackage(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const packageOptions = {
    out: options.get("--out"),
    ...pluginPackageSigningOptions(options),
  };
  const result = options.has("--write")
    ? writePluginRuntimePackage(projectRoot, packageOptions)
    : buildPluginRuntimePackage(projectRoot, packageOptions);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready && !options.has("--allow-diagnostics")) process.exit(1);
}

function runPluginsVerify(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const result = verifyPluginRuntimePackage(projectRoot, options.get("--package") ?? options.get("--manifest"), pluginTrustVerifyOptions(options));
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed && !options.has("--allow-diagnostics")) process.exit(1);
}

function runPluginsTrust(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const result = options.has("--list")
    ? readPluginTrustPolicy(projectRoot, { trustPolicyPath: options.get("--trust-policy") })
    : installPluginRuntimeTrust(projectRoot, options.get("--package") ?? options.get("--manifest"), {
      trustPolicyPath: options.get("--trust-policy"),
      write: !options.has("--dry-run"),
    });
  console.log(JSON.stringify(result, null, 2));
  if (result.ready === false && !options.has("--allow-diagnostics")) process.exit(1);
}

async function runPluginsCommand(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const result = await runPluginRuntimeCommand(projectRoot, {
    commandId: requiredOption(options, "--command"),
    args: options.has("--args-json") ? readJsonOption(options.get("--args-json")) : {},
    packagePath: options.get("--package"),
    execute: options.has("--execute"),
    allowUntrusted: options.has("--allow-untrusted"),
    ...pluginTrustVerifyOptions(options),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.executed === false && options.has("--execute") && !options.has("--allow-diagnostics")) process.exit(1);
}

function pluginPackageSigningOptions(options) {
  return {
    signPrivateKeyPath: options.get("--sign-private-key"),
    signPublicKeyPath: options.get("--sign-public-key"),
    signKeyId: options.get("--sign-key-id"),
  };
}

function pluginTrustVerifyOptions(options) {
  return {
    requireSignature: options.has("--require-signature"),
    requireTrusted: options.has("--require-trusted"),
    trustPolicyPath: options.get("--trust-policy"),
    trustedKeysPath: options.get("--trusted-keys"),
  };
}

function runLayoutCreate(args) {
  const { filePath, options } = parseOptionArgs(args);
  const source = fs.readFileSync(filePath, "utf8");
  const projectRoot = options.has("--project") ? path.resolve(options.get("--project")) : null;
  const preset = options.has("--preset")
    ? instantiateWidgetPreset(options.get("--preset"), {
      projectRoot,
      name: options.get("--name") || undefined,
      props: readWidgetPropsFromOptions(options),
    })
    : null;
  if (preset && !preset.ok) throw new Error(preset.reason);
  const props = preset ? preset.props : readWidgetPropsFromOptions(options);
  const updated = createWidget(source, {
    filePath,
    parentWidgetId: options.get("--parent-id"),
    parentWidgetName: options.get("--parent-name"),
    asRoot: options.has("--root"),
    typeClass: preset?.typeClass ?? requiredOption(options, "--type"),
    name: preset?.name ?? requiredOption(options, "--name"),
    props: Object.keys(props).length ? props : undefined,
  });
  finishLayoutWrite(filePath, source, updated, options);
}

function runLayoutPalette(args) {
  const { options } = parseArgsWithOptions(args);
  const projectRoot = options.has("--project") ? path.resolve(options.get("--project")) : null;
  console.log(JSON.stringify(listWidgetPalette({
    query: options.get("--query") ?? options.get("--q"),
    projectRoot,
  }), null, 2));
}

function runLayoutDelete(args) {
  const { filePath, options } = parseOptionArgs(args);
  const source = fs.readFileSync(filePath, "utf8");
  const updated = deleteWidget(source, {
    filePath,
    widgetId: options.get("--widget-id"),
    widgetName: options.get("--widget-name"),
    allowDeleteLastRoot: options.has("--allow-delete-last-root"),
  });
  finishLayoutWrite(filePath, source, updated, options);
}

function runLayoutReparent(args) {
  const { filePath, options } = parseOptionArgs(args);
  const source = fs.readFileSync(filePath, "utf8");
  const updated = reparentWidget(source, {
    filePath,
    widgetId: options.get("--widget-id"),
    widgetName: options.get("--widget-name"),
    parentWidgetId: options.get("--parent-id"),
    parentWidgetName: options.get("--parent-name"),
  });
  finishLayoutWrite(filePath, source, updated, options);
}

function runLayoutTransform(args) {
  const { filePath, options } = parseOptionArgs(args);
  const source = fs.readFileSync(filePath, "utf8");
  const document = parseLayout(source, { filePath });
  const transformed = buildLayoutTransformPatch(document, {
    action: requiredOption(options, "--action"),
    widgetIds: parseListOption(requiredOption(options, "--widgets")),
    width: Number(options.get("--width") ?? 1280),
    height: Number(options.get("--height") ?? 720),
    delta: options.has("--delta") ? parsePair(options.get("--delta")) : undefined,
    targetBounds: options.has("--target-bounds") ? parseQuad(options.get("--target-bounds")) : undefined,
    targetWidth: options.has("--target-width") ? Number(options.get("--target-width")) : undefined,
    targetHeight: options.has("--target-height") ? Number(options.get("--target-height")) : undefined,
    label: options.get("--label"),
  });
  if (!transformed.ok) throw new Error(transformed.reason);
  const result = applyLayoutPatch(source, transformed.patch, {
    filePath,
    includeSource: true,
    allowDiagnostics: options.has("--allow-diagnostics"),
  });
  if (!result.ok) throw new Error(result.reason);
  const written = !options.has("--dry-run");
  if (written) fs.writeFileSync(filePath, result.source, "utf8");
  console.log(JSON.stringify({
    written,
    filePath,
    action: transformed.action,
    selection: transformed.selection,
    patch: transformed.patch,
    result: withoutSource(result),
    ...(options.has("--include-source") ? { source: result.source } : {}),
  }, null, 2));
}

function runLayoutDiff(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const beforePath = path.resolve(options.get("--before") ?? positional[0] ?? "");
  const afterPath = path.resolve(options.get("--after") ?? positional[1] ?? "");
  if (!beforePath || beforePath === process.cwd()) {
    throw new Error("layout-diff requires a before layout path.");
  }
  if (!afterPath || afterPath === process.cwd()) {
    throw new Error("layout-diff requires an after layout path.");
  }
  const before = readLayoutDocument(beforePath);
  const after = readLayoutDocument(afterPath);
  const report = buildLayoutDiffReport(before, after, {
    includeUnchanged: options.has("--include-unchanged"),
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed && !options.has("--allow-diff")) process.exit(1);
}

function runLayoutPatch(args) {
  const { filePath, options } = parseOptionArgs(args);
  const patchPath = path.resolve(requiredOption(options, "--patch"));
  const beforeSource = fs.readFileSync(filePath, "utf8");
  const patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
  const result = applyLayoutPatch(beforeSource, patch, {
    filePath,
    includeSource: true,
    allowHashMismatch: options.has("--allow-hash-mismatch"),
    allowDiagnostics: options.has("--allow-diagnostics"),
  });
  const written = result.ok && !options.has("--dry-run");
  if (written) fs.writeFileSync(filePath, result.source, "utf8");
  const response = {
    written,
    filePath,
    patchPath,
    ...withoutSource(result),
    ...(options.has("--include-source") ? { source: result.source } : {}),
  };
  console.log(JSON.stringify(response, null, 2));
  if (!result.ok) process.exit(1);
}

function runLayoutGeneratePatch(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const beforePath = path.resolve(options.get("--before") ?? positional[0] ?? "");
  const afterPath = path.resolve(options.get("--after") ?? positional[1] ?? "");
  if (!beforePath || beforePath === process.cwd()) throw new Error("layout-generate-patch requires a before layout path.");
  if (!afterPath || afterPath === process.cwd()) throw new Error("layout-generate-patch requires an after layout path.");
  const patch = generateLayoutPatch(readLayoutDocument(beforePath), readLayoutDocument(afterPath), {
    label: options.get("--label"),
    allowDeleteLastRoot: options.has("--allow-delete-last-root"),
  });
  const outPath = options.get("--out") ? path.resolve(options.get("--out")) : null;
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(patch, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ...patch,
    written: Boolean(outPath),
    outPath,
  }, null, 2));
  if (patch.conflicts.length > 0 && !options.has("--allow-conflicts")) process.exit(1);
}

function runLayoutResolvePatch(args) {
  const { filePath, options } = parseOptionArgs(args);
  const patch = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const resolved = resolveLayoutPatchConflicts(patch, {
    defaultAction: options.get("--action") ?? "skip",
    note: options.get("--note"),
  });
  const outPath = options.get("--out") ? path.resolve(options.get("--out")) : null;
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ...resolved,
    written: Boolean(outPath),
    outPath,
  }, null, 2));
  if (resolved.conflicts.length > 0) process.exit(1);
}

function finishLayoutWrite(filePath, beforeSource, updated, options) {
  if (!updated.ok) {
    console.error(updated.reason);
    process.exit(1);
  }
  const written = !options.has("--dry-run");
  if (written) fs.writeFileSync(filePath, updated.source, "utf8");
  console.log(JSON.stringify({
    written,
    filePath,
    edit: updated.edit,
    widget: updated.widget,
    parent: updated.parent,
    beforeBytes: Buffer.byteLength(beforeSource, "utf8"),
    afterBytes: Buffer.byteLength(updated.source, "utf8"),
    ...(options.has("--include-source") ? { source: updated.source } : {}),
  }, null, 2));
}

function readWidgetPropsFromOptions(options) {
  const props = {};
  if (options.has("--position")) props.position = parsePair(options.get("--position"));
  if (options.has("--size")) props.size = parsePair(options.get("--size"));
  if (options.has("--text")) props.text = options.get("--text");
  if (options.has("--image")) props.image0 = options.get("--image");
  if (options.has("--visible")) props.visible = [Number(options.get("--visible"))];
  return props;
}

function runController(args) {
  const { filePath, options } = parseOptionArgs(args);
  const document = readLayoutDocument(filePath);
  const skeleton = generateControllerSkeleton(document, {
    className: options.get("--class"),
    layoutPath: options.get("--layout") ?? filePath,
    baseClass: options.get("--base") ?? "UIScriptedMenu",
    includeRoot: !options.has("--no-root"),
  });
  const outPath = options.get("--out");
  if (outPath) {
    const absoluteOutPath = path.resolve(outPath);
    fs.mkdirSync(path.dirname(absoluteOutPath), { recursive: true });
    fs.writeFileSync(absoluteOutPath, skeleton.source, "utf8");
    console.log(absoluteOutPath);
  } else {
    console.log(skeleton.source);
  }
}

function runStringTableSet(args) {
  const { filePath, options } = parseOptionArgs(args);
  const key = options.get("--key");
  const column = options.get("--column") ?? "English";
  const value = options.get("--value") ?? "";
  if (!key) throw new Error("--key is required.");

  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "Key,English\n";
  const updated = updateStringTableCsv(source, {
    key,
    values: {
      [column]: value,
    },
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, updated.source, "utf8");
  console.log(JSON.stringify({
    filePath,
    key: updated.key,
    column,
    inserted: updated.inserted,
  }, null, 2));
}

function runStyleList(args) {
  const { filePath, options } = parseOptionArgs(args);
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const parsed = parseStyleFile(source, { filePath });
  console.log(JSON.stringify(styleFileToJson(parsed, {
    includePreviewDiagnostics: !options.has("--no-preview-diagnostics"),
  }), null, 2));
}

function runStyleSet(args) {
  const { filePath, options } = parseOptionArgs(args);
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const values = options.has("--values")
    ? parseStyleValues(options.get("--values"))
    : options.has("--value")
      ? [options.get("--value")]
      : [];
  const updated = upsertStyleProperty(source, {
    filePath,
    styleName: requiredOption(options, "--style"),
    typeClass: options.get("--type") ?? "StyleClass",
    key: requiredOption(options, "--key"),
    values,
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, updated.source, "utf8");
  const parsed = parseStyleFile(updated.source, { filePath });
  const styled = styleFileToJson(parsed);
  console.log(JSON.stringify({
    filePath,
    style: updated.style,
    insertedStyle: updated.insertedStyle,
    insertedProperty: updated.insertedProperty,
    diagnosticCount: styled.diagnosticCount,
    diagnostics: styled.diagnostics,
  }, null, 2));
}

function runFontList(args) {
  const { filePath: projectRoot } = parseOptionArgs(args);
  const projectIndex = buildProjectAssetIndex(projectRoot);
  console.log(JSON.stringify({
    projectRoot,
    ...fontRegistryToJson(projectIndex.fonts),
  }, null, 2));
}

function runFontCheck(args) {
  const { filePath, options } = parseOptionArgs(args);
  const projectRoot = path.resolve(requiredOption(options, "--project"));
  const projectIndex = buildProjectAssetIndex(projectRoot);
  const document = readLayoutDocument(filePath);
  const diagnostics = validateLayoutDocument(document, { projectIndex })
    .filter((diagnostic) => diagnostic.code.startsWith("layout.font."));
  console.log(JSON.stringify({
    filePath,
    projectRoot,
    diagnosticCount: diagnostics.length,
    diagnostics,
  }, null, 2));
  if (diagnostics.length > 0 && !options.has("--allow-diagnostics")) process.exit(1);
}

function runFontCoverage(args) {
  const { positional, options } = parseArgsWithOptions(args);
  const projectRoot = path.resolve(positional[0] ?? options.get("--project") ?? ".");
  const report = buildFontCoverageReport({
    projectRoot,
    layoutPath: options.get("--layout"),
    languages: options.get("--languages") ?? options.get("--language"),
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready && !options.has("--allow-diagnostics")) process.exit(1);
}

function runFontImport(args) {
  const { filePath, options } = parseOptionArgs(args);
  const result = importFontAsset({
    projectRoot: requiredOption(options, "--project"),
    sourceFont: filePath,
    fontVirtualPath: options.get("--asset") ?? options.get("--font"),
    sampleText: options.get("--sample-text"),
    write: !options.has("--dry-run"),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === "warning") && !options.has("--allow-diagnostics")) {
    process.exit(1);
  }
}

function runImageSetUpsert(args) {
  const { filePath, options } = parseOptionArgs(args);
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const updated = upsertImageSetSprite(content, {
    filePath,
    setName: options.get("--set") ?? path.basename(filePath, ".imageset"),
    textureRef: requiredOption(options, "--texture"),
    imageName: requiredOption(options, "--image"),
    pos: parsePair(options.get("--pos") ?? "0 0"),
    size: parsePair(requiredOption(options, "--size")),
    flags: Number(options.get("--flags") ?? 0),
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, updated.source, "utf8");
  console.log(JSON.stringify({
    filePath,
    setRef: updated.setRef,
    inserted: updated.inserted,
  }, null, 2));
}

function runImageImport(args) {
  const { filePath: sourceImage, options } = parseOptionArgs(args);
  const imported = importImageAsset({
    projectRoot: requiredOption(options, "--project"),
    sourceImage,
    assetVirtualPath: requiredOption(options, "--asset"),
    imageSetVirtualPath: requiredOption(options, "--imageset"),
    setName: options.get("--set"),
    imageName: options.get("--image"),
    pos: options.has("--pos") ? parsePair(options.get("--pos")) : undefined,
    size: options.has("--size") ? parsePair(options.get("--size")) : undefined,
    flags: Number(options.get("--flags") ?? 0),
  });
  console.log(JSON.stringify(imported, null, 2));
}

function runAtlasPack(args) {
  const { filePath: projectRoot, options } = parseOptionArgs(args);
  const packed = packImageAtlas({
    projectRoot,
    sources: parseListOption(requiredOption(options, "--images")),
    assetVirtualPath: requiredOption(options, "--asset"),
    imageSetVirtualPath: requiredOption(options, "--imageset"),
    setName: options.get("--set"),
    maxWidth: Number(options.get("--max-width") ?? 2048),
    padding: Number(options.get("--padding") ?? 2),
    powerOfTwo: options.has("--power-of-two"),
    write: !options.has("--dry-run"),
    includeSource: options.has("--include-source"),
  });
  console.log(JSON.stringify(packed, null, 2));
}

function readLayoutDocument(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Layout file does not exist: ${filePath}`);
  }
  const source = fs.readFileSync(filePath, "utf8");
  return parseLayout(source, { filePath });
}

function parseFileArgs(args) {
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) {
    console.error(`Usage: dzui ${command} <layout-file>`);
    process.exit(2);
  }
  return { filePath: path.resolve(fileArg), flags };
}

function parseOptionArgs(args) {
  const { positional, options } = parseArgsWithOptions(args);
  if (positional.length === 0) {
    console.error(`Usage: dzui ${command} <layout-file>`);
    process.exit(2);
  }
  return { filePath: path.resolve(positional[0]), options };
}

function parseArgsWithOptions(args) {
  const options = new Map();
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(arg, next);
      index += 1;
    } else {
      options.set(arg, "true");
    }
  }

  return { positional, options };
}

function parsePair(value) {
  const parts = String(value).trim().split(/\s+/).map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    throw new Error(`Expected numeric pair, got: ${value}`);
  }
  return [parts[0], parts[1]];
}

function parseQuad(value) {
  const parts = String(value).trim().split(/\s+/).map(Number);
  if (parts.length < 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Expected numeric quad, got: ${value}`);
  }
  return [parts[0], parts[1], parts[2], parts[3]];
}

function parseStyleValues(value) {
  return String(value).trim().split(/\s+/).filter(Boolean).map((part) => {
    const number = Number(part);
    return Number.isFinite(number) ? number : part;
  });
}

function requiredOption(options, name) {
  const value = options.get(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function defaultPreviewPath(filePath) {
  const name = `${path.basename(filePath, path.extname(filePath))}.preview.html`;
  return path.join(process.cwd(), ".dzui", "previews", name);
}

function readJsonOption(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8").replace(/^\uFEFF/, ""));
}

function printDiagnostics(diagnostics) {
  if (diagnostics.length === 0) return;

  console.log("");
  console.log("diagnostics:");
  for (const diagnostic of diagnostics) {
    const location = diagnostic.line === null
      ? ""
      : `${diagnostic.line}:${diagnostic.column ?? 1} `;
    const severity = diagnostic.severity ? `${diagnostic.severity} ` : "";
    console.log(`  ${location}${severity}${diagnostic.code}: ${diagnostic.message}`);
  }
}

function printHelp() {
  console.log(`Usage:
  dzui parse <layout-file> [--source] [--tokens]
  dzui inspect <layout-file>
  dzui preview <layout-file> [--project <project-root>] [--out <html-file>] [--width <px>] [--height <px>] [--language <name>] [--state <normal|hover|selected|disabled>]
  dzui decode <asset-file.edds|.dds|.paa|.tga> [--out <png-file>] [--texconv <texconv.exe>] [--decoder-json <decoder.json>]
  dzui validate <layout-file> [layout-file...] [--project <project-root>]
  dzui validate-project <project-root>
  dzui settings-get <project-root>
  dzui settings-set <project-root> [--layout <layout-file>] [--width <px>] [--height <px>] [--language <name>] [--state <normal|hover|selected|disabled>]
  dzui plugins <project-root> [--allow-diagnostics]
  dzui plugins-runtime <project-root> [--allow-diagnostics]
  dzui plugins-package <project-root> [--out <json-file>] [--write] [--sign-private-key <pem-file>] [--sign-public-key <pem-file>] [--sign-key-id <id>] [--allow-diagnostics]
  dzui plugins-verify <project-root> [--package <json-file>] [--require-signature] [--require-trusted] [--trust-policy <json-file>] [--trusted-keys <json-file>] [--allow-diagnostics]
  dzui plugins-trust <project-root> [--package <json-file>] [--trust-policy <json-file>] [--dry-run] [--list] [--allow-diagnostics]
  dzui plugins-command <project-root> --command <plugin.command/id> [--args-json <file>] [--package <json-file>] [--execute] [--allow-untrusted] [--require-signature] [--require-trusted] [--trust-policy <json-file>] [--trusted-keys <json-file>] [--allow-diagnostics]
  dzui layout-palette [--query <text>] [--project <project-root>]
  dzui layout-create <layout-file> --parent-id <widget-id> (--type <WidgetClass> --name <Name> | --preset <preset-id> [--name <Name>]) [--project <project-root>] [--position <x y>] [--size <w h>] [--text <Text>] [--dry-run]
  dzui layout-delete <layout-file> --widget-id <widget-id> [--dry-run]
  dzui layout-reparent <layout-file> --widget-id <widget-id> --parent-id <target-widget-id> [--dry-run]
  dzui layout-transform <layout-file> --action <align-left|align-hcenter|align-right|align-top|align-vcenter|align-bottom|distribute-horizontal|distribute-vertical|translate|resize-group> --widgets <id,id> [--delta <x y>] [--target-bounds <x y w h>] [--target-width <px>] [--target-height <px>] [--width <px>] [--height <px>] [--dry-run]
  dzui layout-diff <before.layout> <after.layout> [--allow-diff] [--include-unchanged]
  dzui layout-patch <layout-file> --patch <patch.json> [--dry-run] [--include-source] [--allow-hash-mismatch] [--allow-diagnostics]
  dzui layout-generate-patch <before.layout> <after.layout> [--out <patch.json>] [--allow-conflicts]
  dzui layout-resolve-patch <patch.json> [--out <patch.json>] [--action <skip|accept-generated|unresolved>] [--note <Text>]
  dzui controller <layout-file> [--class <ClassName>] [--layout <virtual-layout-path>] [--base <BaseClass>] [--out <script-file.c>]
  dzui stringtable-set <stringtable.csv> --key <STR_KEY> [--column <Language>] [--value <Text>]
  dzui style-list <file.styles> [--no-preview-diagnostics]
  dzui style-set <file.styles> --style <StyleName> --key <property> [--value <Text> | --values <a b c>] [--type <StyleClass>]
  dzui font-list <project-root>
  dzui font-check <layout-file> --project <project-root> [--allow-diagnostics]
  dzui font-coverage <project-root> [--layout <layout-file>] [--languages <English,Russian>] [--allow-diagnostics]
  dzui font-import <source-font.fnt|ttf|otf|woff> --project <root> [--asset <gui/fonts/font.fnt>] [--sample-text <Text>] [--dry-run] [--allow-diagnostics]
  dzui imageset-upsert <file.imageset> --texture <texture-path> --image <image-name> --size <w h> [--set <set-name>] [--pos <x y>]
  dzui image-import <source-image.png> --project <root> --asset <virtual-image-path> --imageset <virtual-imageset-path> [--set <set-name>] [--image <image-name>]
  dzui atlas-pack <project-root> --images <png;png> --asset <virtual-atlas.png> --imageset <virtual-imageset.imageset> [--set <set-name>] [--max-width <px>] [--padding <px>] [--power-of-two] [--dry-run]

Examples:
  node packages/core/src/cli/dzui.mjs inspect fixtures/layouts/pda_minimal.layout
  node packages/core/src/cli/dzui.mjs preview fixtures/layouts/pda_minimal.layout
  npm run parse -- fixtures/layouts/arena_bot_minimal.layout`);
}

function handleFatalError(error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function withoutSource(value) {
  const { source, ...rest } = value;
  return rest;
}

function parseListOption(value) {
  return String(value).split(/[|;,\n]/).map((item) => item.trim()).filter(Boolean);
}
