import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildProjectAssetIndex } from "../assets/index.mjs";
import { buildLayoutPreviewModel } from "../layout/preview-model.mjs";
import { parseLayout } from "../layout/parser.mjs";
import { buildEnginePreviewWorkspace, writeEnginePreviewWorkspace } from "./dayz-tools.mjs";
import { buildGeometryDiffReport } from "./geometry-diff.mjs";
import { diffPngFiles } from "./pixel-diff.mjs";

export function buildEngineCapturePlan(options = {}) {
  const workspace = options.workspace ?? buildEnginePreviewWorkspace(options);
  const outputRoot = path.resolve(options.outputRoot ?? path.join(workspace.previewRoot, "captures"));
  const reportsRoot = path.resolve(options.reportsRoot ?? path.join(outputRoot, "reports"));
  const logRoot = path.resolve(options.logRoot ?? path.join(workspace.previewRoot, "logs"));
  const command = normalizeCommand(options.command ?? workspace.launchPlan.command);
  const paths = {
    expectedScreenshot: path.resolve(options.expectedScreenshotPath ?? path.join(outputRoot, "dzui-preview.png")),
    actualScreenshot: path.resolve(options.actualScreenshotPath ?? path.join(outputRoot, "engine-preview.png")),
    geometryDump: path.resolve(options.geometryDumpPath ?? path.join(outputRoot, "geometry-dump.json")),
    pixelDiff: path.resolve(options.pixelDiffPath ?? path.join(outputRoot, "pixel-diff.png")),
    geometryReport: path.resolve(options.geometryReportPath ?? path.join(reportsRoot, "geometry-report.json")),
    pixelReport: path.resolve(options.pixelReportPath ?? path.join(reportsRoot, "pixel-report.json")),
  };
  const missing = [];
  if (!command?.executable) missing.push("launch command executable");

  return {
    kind: "EngineCapturePlan",
    ready: missing.length === 0,
    missing,
    workspace,
    outputRoot,
    reportsRoot,
    logRoot,
    command,
    paths,
    tolerance: {
      geometryPx: positiveNumber(options.geometryTolerancePx, 1),
      pixel: positiveNumber(options.pixelTolerance, 0),
    },
    steps: [
      "Generate the temporary engine preview workspace.",
      "Launch DayZDiag/Workbench or the configured capture command.",
      "Wait for engine screenshot and geometry dump outputs.",
      "Compare engine geometry against the DZUI preview model.",
      "Compare engine screenshot against the expected DZUI screenshot when both PNGs exist.",
      "Write JSON reports and optional visual pixel diff image.",
    ],
  };
}

export function runEngineCaptureWorkflow(options = {}) {
  const plan = options.plan ?? buildEngineCapturePlan(options);
  const startedAt = new Date().toISOString();
  const timeoutMs = Number(options.timeoutMs ?? 300000);
  const waitMs = Number(options.waitMs ?? 0);

  if (!plan.ready && options.allowNotReady !== true) {
    return {
      kind: "EngineCaptureRun",
      ok: false,
      skipped: true,
      reason: `Capture plan is not ready: ${plan.missing.join(", ")}`,
      plan,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  if (options.writeWorkspace !== false) writeWorkspaceFiles(plan.workspace);
  fs.mkdirSync(plan.outputRoot, { recursive: true });
  fs.mkdirSync(plan.reportsRoot, { recursive: true });
  fs.mkdirSync(plan.logRoot, { recursive: true });

  const result = spawnSync(plan.command.executable, plan.command.args, {
    cwd: plan.command.cwd ?? plan.workspace.projectRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    env: {
      ...process.env,
      ...(options.env ?? {}),
      DZUI_PROJECT_ROOT: plan.workspace.projectRoot,
      DZUI_LAYOUT_PATH: plan.workspace.layoutPath,
      DZUI_CAPTURE_EXPECTED_SCREENSHOT: plan.paths.expectedScreenshot,
      DZUI_CAPTURE_ACTUAL_SCREENSHOT: plan.paths.actualScreenshot,
      DZUI_CAPTURE_GEOMETRY_DUMP: plan.paths.geometryDump,
      DZUI_CAPTURE_PIXEL_DIFF: plan.paths.pixelDiff,
    },
  });
  if (waitMs > 0) waitForCaptureOutputs(plan.paths, waitMs);

  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const timedOut = result.error?.code === "ETIMEDOUT";
  const exitCode = result.status ?? (result.error ? 1 : 0);
  const outputs = captureOutputs(plan.paths);
  const geometryReport = outputs.geometryDump
    ? writeGeometryReport(plan)
    : null;
  const pixelReport = outputs.expectedScreenshot && outputs.actualScreenshot
    ? writePixelReport(plan)
    : null;
  const finalOutputs = captureOutputs(plan.paths);
  const logPath = path.join(plan.logRoot, `${safeStamp(startedAt)}-capture.log`);

  fs.writeFileSync(logPath, [
    `startedAt=${startedAt}`,
    `finishedAt=${finishedAt}`,
    `executable=${plan.command.executable}`,
    `args=${plan.command.args.join(" ")}`,
    `exitCode=${exitCode}`,
    `timedOut=${timedOut}`,
    "",
    "[stdout]",
    stdout,
    "",
    "[stderr]",
    stderr,
    result.error ? `\n[error]\n${result.error.message}` : "",
  ].join("\n"), "utf8");

  return {
    kind: "EngineCaptureRun",
    ok: exitCode === 0 && (finalOutputs.actualScreenshot || finalOutputs.geometryDump),
    skipped: false,
    exitCode,
    timedOut,
    outputs: finalOutputs,
    geometryReport,
    pixelReport,
    logPath,
    stdout,
    stderr,
    error: result.error ? result.error.message : null,
    startedAt,
    finishedAt,
    plan,
  };
}

function writeWorkspaceFiles(workspace) {
  for (const file of workspace.files ?? []) {
    fs.mkdirSync(path.dirname(file.filePath), { recursive: true });
    fs.writeFileSync(file.filePath, file.source, "utf8");
  }
  if (!workspace.files) writeEnginePreviewWorkspace({ projectRoot: workspace.projectRoot, layoutPath: workspace.layoutPath });
}

function writeGeometryReport(plan) {
  const source = fs.readFileSync(plan.workspace.layoutPath, "utf8");
  const document = parseLayout(source, { filePath: plan.workspace.layoutPath });
  const projectIndex = fs.existsSync(plan.workspace.projectRoot)
    ? buildProjectAssetIndex(plan.workspace.projectRoot)
    : null;
  const model = buildLayoutPreviewModel(document, {
    width: plan.workspace.viewport.width,
    height: plan.workspace.viewport.height,
    language: plan.workspace.language,
    projectIndex,
  });
  const engineDump = JSON.parse(fs.readFileSync(plan.paths.geometryDump, "utf8"));
  const report = buildGeometryDiffReport(model, engineDump, {
    tolerancePx: plan.tolerance.geometryPx,
  });
  fs.mkdirSync(path.dirname(plan.paths.geometryReport), { recursive: true });
  fs.writeFileSync(plan.paths.geometryReport, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return {
    filePath: plan.paths.geometryReport,
    passed: report.passed,
    summary: report.summary,
  };
}

function writePixelReport(plan) {
  const report = diffPngFiles({
    expectedPath: plan.paths.expectedScreenshot,
    actualPath: plan.paths.actualScreenshot,
    diffPath: plan.paths.pixelDiff,
    tolerance: plan.tolerance.pixel,
  });
  fs.mkdirSync(path.dirname(plan.paths.pixelReport), { recursive: true });
  fs.writeFileSync(plan.paths.pixelReport, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return {
    filePath: plan.paths.pixelReport,
    passed: report.passed,
    summary: report.summary,
    diffImage: report.diffImage,
  };
}

function captureOutputs(paths) {
  return {
    expectedScreenshot: fs.existsSync(paths.expectedScreenshot),
    actualScreenshot: fs.existsSync(paths.actualScreenshot),
    geometryDump: fs.existsSync(paths.geometryDump),
    pixelDiff: fs.existsSync(paths.pixelDiff),
    geometryReport: fs.existsSync(paths.geometryReport),
    pixelReport: fs.existsSync(paths.pixelReport),
  };
}

function waitForCaptureOutputs(paths, waitMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const outputs = captureOutputs(paths);
    if (outputs.actualScreenshot || outputs.geometryDump) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
}

function normalizeCommand(command) {
  if (!command) return null;
  return {
    executable: command.executable,
    args: Array.isArray(command.args) ? command.args.map(String) : [],
    cwd: command.cwd,
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function safeStamp(value) {
  return String(value).replace(/[^0-9A-Za-z_.-]/g, "-");
}
