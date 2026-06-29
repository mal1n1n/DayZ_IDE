import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildProjectAssetIndex } from "../assets/index.mjs";
import { discoverDayzTools } from "../engine/dayz-tools.mjs";
import { validateProject } from "../validation/layout.mjs";
import { buildPboWorkflowPlan } from "./workflow.mjs";

export function buildWorkshopPublishPlan(options = {}) {
  const projectRoot = path.resolve(requiredString(options.projectRoot, "projectRoot"));
  const tools = options.tools ?? discoverDayzTools(options);
  const buildPlan = options.buildPlan ?? buildPboWorkflowPlan({
    projectRoot,
    addonSource: options.addonSource,
    outputRoot: options.outputRoot,
    prefix: options.prefix,
    tools,
    allowDiagnostics: true,
  });
  const projectIndex = options.projectIndex ?? buildProjectAssetIndex(projectRoot);
  const validation = options.validation ?? validateProject(projectRoot, { projectIndex });
  const pboPath = path.resolve(options.pboPath ?? buildPlan.pboPath);
  const contentRoot = path.resolve(options.contentRoot ?? options.publishRoot ?? buildPlan.outputRoot);
  const logRoot = path.resolve(options.logRoot ?? path.join(projectRoot, ".dzui", "workshop", "logs"));
  const publisherPath = optionalResolved(options.publisherPath) ?? tools.publisher;
  const publisherCmdPath = optionalResolved(options.publisherCmdPath) ?? tools.publisherCmd;
  const workshopItemId = optionalString(options.workshopItemId ?? options.itemId);
  const title = optionalString(options.title);
  const changeNote = optionalString(options.changeNote);
  const changeNoteFile = optionalResolved(options.changeNoteFile);
  const previewImage = optionalResolved(options.previewImage);
  const commandContext = {
    projectRoot,
    addonSource: buildPlan.addonSource,
    outputRoot: buildPlan.outputRoot,
    pboPath,
    contentRoot,
    logRoot,
    workshopItemId,
    title,
    changeNote,
    changeNoteFile,
    previewImage,
    publisherPath,
    publisherCmdPath,
    toolsRoot: tools.toolsRoot,
  };
  const templatedCommand = options.command
    ? renderCommandTemplate(options.command, commandContext)
    : { command: null, missingPlaceholders: [] };
  const defaultCommand = !options.command
    ? buildDefaultPublisherCmdCommand({ publisherCmdPath, workshopItemId, changeNote, changeNoteFile, contentRoot })
    : null;
  const command = templatedCommand.command ?? defaultCommand;
  const missing = [];

  if (!options.command && !publisherCmdPath) missing.push("PublisherCmd.exe or command template");
  if (!options.command && !workshopItemId) missing.push("workshopItemId");
  if (!options.command && !changeNote && !changeNoteFile) missing.push("changeNote or changeNoteFile");
  if (!directoryExists(contentRoot)) missing.push(`content folder: ${contentRoot}`);
  if (options.requirePbo !== false && !fileExists(pboPath)) missing.push(`built PBO: ${pboPath}`);
  if (changeNoteFile && !fileExists(changeNoteFile)) missing.push(`change note file: ${changeNoteFile}`);
  if (previewImage && !fileExists(previewImage)) missing.push(`preview image: ${previewImage}`);
  if (validation.diagnosticCount > 0 && options.allowDiagnostics !== true) {
    missing.push("clean validation or allowDiagnostics=true");
  }
  for (const placeholder of templatedCommand.missingPlaceholders) {
    missing.push(`command placeholder: ${placeholder}`);
  }
  if (!command?.executable) missing.push("publish command executable");

  return {
    kind: "WorkshopPublishPlan",
    mode: "update",
    ready: missing.length === 0,
    missing,
    projectRoot,
    pboPath,
    contentRoot,
    logRoot,
    workshopItemId,
    title,
    changeNote,
    changeNoteFile,
    previewImage,
    tools: {
      publisher: publisherPath,
      publisherCmd: publisherCmdPath,
      addonBuilder: tools.addonBuilder,
      pDrive: tools.pDrive,
    },
    validation: {
      diagnosticCount: validation.diagnosticCount,
    },
    buildPlan: {
      ready: buildPlan.ready,
      missing: buildPlan.missing,
      addonSource: buildPlan.addonSource,
      outputRoot: buildPlan.outputRoot,
      prefix: buildPlan.prefix,
      pboPath: buildPlan.pboPath,
      manifest: buildPlan.manifest,
    },
    commandSource: options.command ? "template" : "PublisherCmd",
    command,
    steps: [
      "Validate the project and confirm the build artifact exists.",
      "Stage the Workshop content folder that contains the mod PBO and metadata.",
      "Run PublisherCmd update with the Workshop item id, change note, and content path.",
      "Capture PublisherCmd stdout/stderr and write a DZUI publish log.",
      "Report the publish result back to CLI, MCP, or the desktop shell.",
    ],
    manualSteps: [
      "If PublisherCmd is not available, open DayZ Tools Publisher and select the staged content folder.",
      "Use the Workshop item id for updates; first-time item creation may require the Publisher UI.",
      "After publishing, keep the generated DZUI log with the build/release artifact.",
    ],
    notes: [
      "Default execution targets PublisherCmd update; a command template can override it for custom scripts or tests.",
      "PublisherCmd expects a folder with mod content, not a raw PBO path. DZUI defaults that folder to the PBO build output root.",
    ],
  };
}

export function runWorkshopPublishWorkflow(options = {}) {
  const plan = options.plan ?? buildWorkshopPublishPlan(options);
  const startedAt = new Date().toISOString();
  const timeoutMs = Number(options.timeoutMs ?? 300000);

  if (!plan.ready && options.allowNotReady !== true) {
    return {
      kind: "WorkshopPublishRun",
      ok: false,
      skipped: true,
      reason: `Workshop publish plan is not ready: ${plan.missing.join(", ")}`,
      plan,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
  if (!plan.command?.executable) {
    return {
      kind: "WorkshopPublishRun",
      ok: false,
      skipped: true,
      reason: "Workshop publish plan has no executable command.",
      plan,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  fs.mkdirSync(plan.logRoot, { recursive: true });
  const result = spawnSync(plan.command.executable, plan.command.args, {
    cwd: plan.command.cwd ?? plan.projectRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    env: {
      ...process.env,
      ...(plan.command.env ?? {}),
      ...(options.env ?? {}),
      DZUI_PROJECT_ROOT: plan.projectRoot,
      DZUI_PBO_PATH: plan.pboPath,
      DZUI_WORKSHOP_CONTENT_ROOT: plan.contentRoot,
      DZUI_WORKSHOP_ITEM_ID: plan.workshopItemId ?? "",
    },
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const timedOut = result.error?.code === "ETIMEDOUT";
  const exitCode = result.status ?? (result.error ? 1 : 0);
  const logPath = path.join(plan.logRoot, `${safeStamp(startedAt)}-workshop-publish.log`);

  fs.writeFileSync(logPath, [
    `startedAt=${startedAt}`,
    `finishedAt=${finishedAt}`,
    `executable=${plan.command.executable}`,
    `args=${plan.command.args.join(" ")}`,
    `cwd=${plan.command.cwd ?? plan.projectRoot}`,
    `exitCode=${exitCode}`,
    `timedOut=${timedOut}`,
    `projectRoot=${plan.projectRoot}`,
    `contentRoot=${plan.contentRoot}`,
    `pboPath=${plan.pboPath}`,
    `workshopItemId=${plan.workshopItemId ?? ""}`,
    "",
    "[stdout]",
    stdout,
    "",
    "[stderr]",
    stderr,
    result.error ? `\n[error]\n${result.error.message}` : "",
  ].join("\n"), "utf8");

  return {
    kind: "WorkshopPublishRun",
    ok: exitCode === 0,
    skipped: false,
    exitCode,
    timedOut,
    logPath,
    stdout,
    stderr,
    error: result.error ? result.error.message : null,
    startedAt,
    finishedAt,
    plan,
  };
}

function buildDefaultPublisherCmdCommand({ publisherCmdPath, workshopItemId, changeNote, changeNoteFile, contentRoot }) {
  if (!publisherCmdPath) return null;
  const args = [
    "update",
    `/id:${workshopItemId ?? ""}`,
    changeNoteFile ? `/changeNoteFile:${changeNoteFile}` : `/changeNote:${changeNote ?? ""}`,
    `/path:${contentRoot}`,
    "/nologo",
    "/nosummary",
  ];
  return {
    executable: publisherCmdPath,
    args,
    cwd: path.dirname(publisherCmdPath),
  };
}

function renderCommandTemplate(command, context) {
  const missingPlaceholders = new Set();
  const executable = renderTemplateValue(command.executable, context, missingPlaceholders);
  const args = Array.isArray(command.args)
    ? command.args.map((arg) => renderTemplateValue(arg, context, missingPlaceholders))
    : [];
  const cwd = command.cwd ? renderTemplateValue(command.cwd, context, missingPlaceholders) : undefined;
  const env = command.env && typeof command.env === "object"
    ? Object.fromEntries(Object.entries(command.env).map(([key, value]) => [
      key,
      renderTemplateValue(value, context, missingPlaceholders),
    ]))
    : undefined;
  return {
    command: executable ? { executable, args, cwd, env } : null,
    missingPlaceholders: [...missingPlaceholders],
  };
}

function renderTemplateValue(value, context, missingPlaceholders) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(context, key) || context[key] === null || context[key] === undefined || context[key] === "") {
      missingPlaceholders.add(key);
      return match;
    }
    return String(context[key]);
  });
}

function fileExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function directoryExists(dirPath) {
  return Boolean(dirPath) && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function safeStamp(value) {
  return String(value).replace(/[^0-9A-Za-z_.-]/g, "-");
}

function optionalResolved(value) {
  const text = optionalString(value);
  return text ? path.resolve(text) : null;
}

function optionalString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
