import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { discoverDayzTools } from "../engine/dayz-tools.mjs";
import { readImageDimensions } from "../imageset/authoring.mjs";

export function buildTextureConversionPlan(options = {}) {
  const sourcePath = path.resolve(required(options.sourceImage ?? options.sourcePath ?? options.source, "sourceImage"));
  const format = normalizeFormat(options.format ?? (path.extname(options.outputPath ?? "").slice(1) || "paa"));
  const outputPath = path.resolve(options.outputPath ?? replaceExtension(sourcePath, `.${format}`));
  const tools = options.tools ?? discoverDayzTools(options);
  const converterPath = optionalResolved(options.converterPath ?? options.imageToPaaPath) ?? tools.imageToPaa;
  const commandTemplate = options.command ?? null;
  const dimensions = safeReadImageDimensions(sourcePath);
  const missing = [];
  const warnings = [];

  if (!fs.existsSync(sourcePath)) missing.push(`source image: ${sourcePath}`);
  if (format !== "paa" && !commandTemplate) {
    missing.push(`${format.toUpperCase()} converter command template`);
  }
  if (format === "paa" && !commandTemplate && !converterPath) {
    missing.push("ImageToPAA.exe or command template");
  }
  if (dimensions && (!isPowerOfTwo(dimensions.width) || !isPowerOfTwo(dimensions.height))) {
    warnings.push(`Image dimensions are not powers of two (${dimensions.width}x${dimensions.height}); ImageToPAA may reject or rescale this texture.`);
  }

  const command = commandTemplate
    ? expandCommandTemplate(commandTemplate, { sourcePath, outputPath, format })
    : converterPath ? {
      executable: converterPath,
      args: [
        sourcePath,
        outputPath,
      ],
      cwd: path.dirname(converterPath),
    } : null;

  return {
    kind: "TextureConversionPlan",
    ready: missing.length === 0,
    missing,
    warnings,
    sourcePath,
    outputPath,
    format,
    dimensions,
    tools: {
      imageToPaa: tools.imageToPaa,
      texView: tools.texView,
      toolsRoot: tools.toolsRoot,
    },
    command,
    steps: [
      "Read the source image and verify the target texture path.",
      format === "paa"
        ? "Run ImageToPAA.exe or the configured command template."
        : `Run the configured ${format.toUpperCase()} converter command template.`,
      "Verify that the converted texture exists.",
      "Use the converted texture path in layout/imageSet references or build output.",
    ],
  };
}

export function runTextureConversionWorkflow(options = {}) {
  const plan = options.plan ?? buildTextureConversionPlan(options);
  const startedAt = new Date().toISOString();
  const timeoutMs = Number(options.timeoutMs ?? 120000);
  const logRoot = path.resolve(options.logRoot ?? path.join(path.dirname(plan.outputPath), ".dzui-conversion-logs"));

  if (!plan.ready && options.allowNotReady !== true) {
    return {
      kind: "TextureConversionRun",
      ok: false,
      skipped: true,
      reason: `Texture conversion plan is not ready: ${plan.missing.join(", ")}`,
      plan,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
  if (!plan.command?.executable) {
    return {
      kind: "TextureConversionRun",
      ok: false,
      skipped: true,
      reason: "Texture conversion plan has no executable command.",
      plan,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  fs.mkdirSync(path.dirname(plan.outputPath), { recursive: true });
  fs.mkdirSync(logRoot, { recursive: true });
  const result = spawnSync(plan.command.executable, plan.command.args ?? [], {
    cwd: plan.command.cwd ?? path.dirname(plan.command.executable),
    env: { ...process.env, ...(plan.command.env ?? {}) },
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const timedOut = result.error?.code === "ETIMEDOUT";
  const exitCode = result.status ?? (result.error ? 1 : 0);
  const outputExists = fs.existsSync(plan.outputPath);
  const ok = exitCode === 0 && outputExists;
  const logPath = path.join(logRoot, `${safeStamp(startedAt)}-${path.basename(plan.outputPath)}.log`);

  fs.writeFileSync(logPath, [
    `startedAt=${startedAt}`,
    `finishedAt=${finishedAt}`,
    `executable=${plan.command.executable}`,
    `args=${(plan.command.args ?? []).join(" ")}`,
    `exitCode=${exitCode}`,
    `timedOut=${timedOut}`,
    `outputPath=${plan.outputPath}`,
    `outputExists=${outputExists}`,
    "",
    "[stdout]",
    stdout,
    "",
    "[stderr]",
    stderr,
    result.error ? `\n[error]\n${result.error.message}` : "",
  ].join("\n"), "utf8");

  return {
    kind: "TextureConversionRun",
    ok,
    skipped: false,
    reason: ok ? null : outputExists
      ? `Converter exited with code ${exitCode}.`
      : `Converted output was not produced: ${plan.outputPath}`,
    plan,
    startedAt,
    finishedAt,
    exitCode,
    timedOut,
    stdout,
    stderr,
    logPath,
    outputExists,
    outputPath: plan.outputPath,
  };
}

function expandCommandTemplate(command, values) {
  if (!command || typeof command !== "object") throw new Error("command template must be an object.");
  return {
    executable: replacePlaceholders(required(command.executable, "command.executable"), values),
    args: Array.isArray(command.args) ? command.args.map((arg) => replacePlaceholders(arg, values)) : [],
    cwd: command.cwd ? replacePlaceholders(command.cwd, values) : undefined,
    env: command.env && typeof command.env === "object"
      ? Object.fromEntries(Object.entries(command.env).map(([key, value]) => [key, replacePlaceholders(value, values)]))
      : undefined,
  };
}

function replacePlaceholders(value, { sourcePath, outputPath, format }) {
  return String(value)
    .replaceAll("{source}", sourcePath)
    .replaceAll("{sourcePath}", sourcePath)
    .replaceAll("{out}", outputPath)
    .replaceAll("{output}", outputPath)
    .replaceAll("{outputPath}", outputPath)
    .replaceAll("{format}", format);
}

function safeReadImageDimensions(filePath) {
  try {
    return fs.existsSync(filePath) ? readImageDimensions(filePath) : null;
  } catch {
    return null;
  }
}

function replaceExtension(filePath, extension) {
  return path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}${extension}`);
}

function normalizeFormat(value) {
  const normalized = String(value ?? "paa").trim().replace(/^\./, "").toLowerCase();
  return normalized || "paa";
}

function optionalResolved(value) {
  return typeof value === "string" && value.trim() ? path.resolve(value) : null;
}

function isPowerOfTwo(value) {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function safeStamp(value) {
  return String(value).replace(/[:.]/g, "-");
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
