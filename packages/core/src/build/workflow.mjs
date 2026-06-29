import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildProjectAssetIndex } from "../assets/index.mjs";
import { discoverDayzTools } from "../engine/dayz-tools.mjs";
import { validateProject } from "../validation/layout.mjs";

export function buildPboWorkflowPlan(options = {}) {
  const projectRoot = path.resolve(required(options.projectRoot, "projectRoot"));
  const addonSource = path.resolve(options.addonSource ?? projectRoot);
  const outputRoot = path.resolve(options.outputRoot ?? path.join(projectRoot, ".dzui", "build"));
  const prefix = options.prefix ?? inferAddonPrefix(projectRoot, addonSource);
  const tools = options.tools ?? discoverDayzTools(options);
  const projectIndex = options.projectIndex ?? buildProjectAssetIndex(projectRoot);
  const validation = options.validation ?? validateProject(projectRoot, { projectIndex });
  const missing = [];

  if (!tools.addonBuilder) missing.push("AddonBuilder.exe");
  if (validation.diagnosticCount > 0 && options.allowDiagnostics !== true) {
    missing.push("clean validation or allowDiagnostics=true");
  }

  const addonName = path.basename(addonSource);
  const pboPath = path.join(outputRoot, `${addonName}.pbo`);
  const command = tools.addonBuilder ? {
    executable: tools.addonBuilder,
    args: [
      addonSource,
      outputRoot,
      "-clear",
      `-prefix=${prefix}`,
    ],
  } : null;

  return {
    kind: "PboWorkflowPlan",
    ready: missing.length === 0,
    missing,
    projectRoot,
    addonSource,
    outputRoot,
    prefix,
    pboPath,
    tools: {
      addonBuilder: tools.addonBuilder,
      imageToPaa: tools.imageToPaa,
      publisher: tools.publisher,
      publisherCmd: tools.publisherCmd,
      pDrive: tools.pDrive,
    },
    manifest: buildManifest(projectRoot, projectIndex, validation),
    steps: [
      "Validate layouts, assets, stringtable, styles, fonts, and script references.",
      "Prepare preview/build cache under .dzui.",
      "Run AddonBuilder with the selected addon source, output root, and prefix.",
      "Collect AddonBuilder logs and produced PBO path.",
      "Optionally run engine preview or publishing workflow after a successful build.",
    ],
    command,
  };
}

export function buildManifest(projectRoot, projectIndex, validation) {
  return {
    projectRoot,
    counts: projectIndex.counts,
    layouts: projectIndex.files.filter((filePath) => filePath.toLowerCase().endsWith(".layout")).length,
    edds: projectIndex.edds.length,
    imageSets: projectIndex.imageSets.length,
    styles: projectIndex.styles.byName.size,
    fonts: projectIndex.fonts.fonts.length,
    stringTableEntries: projectIndex.stringTable.tables.reduce((count, table) => count + table.entries.length, 0),
    scripts: projectIndex.scripts.scripts.length,
    validationDiagnostics: validation.diagnosticCount,
  };
}

export function runPboWorkflow(options = {}) {
  const plan = options.plan ?? buildPboWorkflowPlan(options);
  const startedAt = new Date().toISOString();
  const timeoutMs = Number(options.timeoutMs ?? 300000);
  const logRoot = path.resolve(options.logRoot ?? path.join(plan.projectRoot, ".dzui", "build", "logs"));

  if (!plan.ready && options.allowNotReady !== true) {
    return {
      kind: "PboWorkflowRun",
      ok: false,
      skipped: true,
      reason: `Build plan is not ready: ${plan.missing.join(", ")}`,
      plan,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
  if (!plan.command?.executable) {
    return {
      kind: "PboWorkflowRun",
      ok: false,
      skipped: true,
      reason: "Build plan has no executable command.",
      plan,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  fs.mkdirSync(plan.outputRoot, { recursive: true });
  fs.mkdirSync(logRoot, { recursive: true });
  const result = spawnSync(plan.command.executable, plan.command.args, {
    cwd: options.cwd ?? plan.projectRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const logPath = path.join(logRoot, `${safeStamp(startedAt)}-${path.basename(plan.addonSource)}.log`);
  const timedOut = result.error?.code === "ETIMEDOUT";
  const exitCode = result.status ?? (result.error ? 1 : 0);
  const pboExists = fs.existsSync(plan.pboPath);
  const ok = exitCode === 0 && pboExists;

  fs.writeFileSync(logPath, [
    `startedAt=${startedAt}`,
    `finishedAt=${finishedAt}`,
    `executable=${plan.command.executable}`,
    `args=${plan.command.args.join(" ")}`,
    `exitCode=${exitCode}`,
    `timedOut=${timedOut}`,
    `pboPath=${plan.pboPath}`,
    `pboExists=${pboExists}`,
    "",
    "[stdout]",
    stdout,
    "",
    "[stderr]",
    stderr,
    result.error ? `\n[error]\n${result.error.message}` : "",
  ].join("\n"), "utf8");

  return {
    kind: "PboWorkflowRun",
    ok,
    skipped: false,
    exitCode,
    timedOut,
    pboExists,
    pboPath: plan.pboPath,
    logPath,
    stdout,
    stderr,
    error: result.error ? result.error.message : null,
    startedAt,
    finishedAt,
    plan,
  };
}

function inferAddonPrefix(projectRoot, addonSource) {
  const relative = path.relative(projectRoot, addonSource).replaceAll("\\", "/");
  return relative && !relative.startsWith("..") ? relative : path.basename(addonSource);
}

function safeStamp(value) {
  return String(value).replace(/[^0-9A-Za-z_.-]/g, "-");
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
