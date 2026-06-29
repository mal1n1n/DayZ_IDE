import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { decodeDdsFileToPng } from "./dds.mjs";

const previewDecodeExtensions = new Set([".edds", ".dds", ".paa", ".tga"]);

export function previewCacheKey(filePath) {
  return crypto.createHash("sha1").update(path.resolve(filePath)).digest("hex");
}

export function previewCachePath(filePath, cacheRoot) {
  return path.join(cacheRoot, `${previewCacheKey(filePath)}.png`);
}

export function ensureDecodedPreviewAsset(filePath, options = {}) {
  const cacheRoot = options.cacheRoot ?? ".dzui/preview-cache";
  const outPath = options.outputPath ?? previewCachePath(filePath, cacheRoot);
  if (fs.existsSync(outPath)) {
    return {
      ok: true,
      filePath,
      outPath,
      cached: true,
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!previewDecodeExtensions.has(ext)) {
    return {
      ok: false,
      filePath,
      outPath,
      reason: `Preview decode is not supported for ${ext || "unknown extension"}.`,
    };
  }

  let nativeReason = null;
  if (ext === ".edds" || ext === ".dds") {
    try {
      return {
        ok: true,
        cached: false,
        decoder: "native-dds-32bpp",
        ...decodeDdsFileToPng(filePath, outPath),
      };
    } catch (error) {
      nativeReason = error instanceof Error ? error.message : String(error);
    }
  } else {
    nativeReason = `${ext.toUpperCase()} preview requires an external decoder.`;
  }

  const external = runExternalPreviewDecoder(filePath, outPath, options);
  if (external.ok) {
    return {
      ...external,
      nativeReason,
    };
  }

  return {
    ok: false,
    filePath,
    outPath,
    reason: external.reason
      ? `${nativeReason}; external decoder failed: ${external.reason}`
      : nativeReason,
  };
}

export function runExternalPreviewDecoder(filePath, outPath, options = {}) {
  const externalDecoder = options.externalDecoder ?? discoverExternalPreviewDecoder(options);
  if (externalDecoder) {
    return runCommandDecoder(filePath, outPath, externalDecoder, options);
  }

  const texconvPath = options.texconvPath
    ?? process.env.DZUI_TEXCONV_PATH
    ?? process.env.DZUI_TEXCONV
    ?? discoverTexconvPath(options);
  if (texconvPath) {
    return runTexconvDecoder(filePath, outPath, texconvPath, options);
  }

  return {
    ok: false,
    filePath,
    outPath,
    reason: "No external decoder configured. Set DZUI_TEXCONV_PATH, DZUI_PREVIEW_DECODER_JSON, or pass externalDecoder.",
  };
}

export function discoverExternalPreviewDecoder(options = {}) {
  const decoder = options.externalDecoder;
  if (decoder) return decoder;

  const jsonSource = options.externalDecoderJson
    ?? process.env.DZUI_PREVIEW_DECODER_JSON;
  if (jsonSource) {
    const source = String(jsonSource).trim();
    const json = fs.existsSync(source)
      ? fs.readFileSync(source, "utf8")
      : source;
    return JSON.parse(json.replace(/^\uFEFF/, ""));
  }

  const command = options.externalDecoderCommand ?? process.env.DZUI_PREVIEW_DECODER;
  if (!command) return null;
  const argsText = options.externalDecoderArgs ?? process.env.DZUI_PREVIEW_DECODER_ARGS ?? "[]";
  const args = Array.isArray(argsText) ? argsText : JSON.parse(String(argsText).replace(/^\uFEFF/, ""));
  return {
    name: options.externalDecoderName ?? process.env.DZUI_PREVIEW_DECODER_NAME ?? "external-preview-decoder",
    command,
    args,
    cwd: options.externalDecoderCwd ?? process.env.DZUI_PREVIEW_DECODER_CWD,
  };
}

export function discoverTexconvPath(options = {}) {
  const executableName = options.executableName ?? (process.platform === "win32" ? "texconv.exe" : "texconv");
  const explicit = [
    process.env.DZUI_TEXCONV_PATH,
    process.env.DZUI_TEXCONV,
  ].filter(Boolean);
  for (const candidate of explicit) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const pathHit = findOnPath(executableName, options.envPath ?? process.env.PATH);
  if (pathHit) return pathHit;

  const roots = [
    ...(options.texconvSearchRoots ?? []),
    process.env.DIRECTXTEX_ROOT,
    process.env.DX_TEX_ROOT,
    process.env.DAYZ_TOOLS,
    "C:/Program Files/DirectXTex",
    "C:/Program Files/Microsoft DirectXTex",
    "C:/Program Files (x86)/DirectXTex",
  ].filter(Boolean);
  for (const root of roots) {
    const hit = findInRoot(root, executableName);
    if (hit) return hit;
  }
  return null;
}

function runCommandDecoder(filePath, outPath, externalDecoder, options) {
  const command = externalDecoder.command;
  if (!command) {
    return { ok: false, filePath, outPath, reason: "externalDecoder.command is required." };
  }

  const outputDir = path.dirname(outPath);
  fs.mkdirSync(outputDir, { recursive: true });
  const args = (externalDecoder.args ?? []).map((arg) => replaceDecoderPlaceholders(arg, {
    input: filePath,
    output: outPath,
    outputDir,
    outputBaseName: path.basename(outPath),
  }));
  const result = spawnSync(command, args, {
    cwd: externalDecoder.cwd ?? options.cwd,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120000,
    windowsHide: true,
  });

  if (result.error) {
    return { ok: false, filePath, outPath, reason: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      filePath,
      outPath,
      reason: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    };
  }
  if (!fs.existsSync(outPath)) {
    return { ok: false, filePath, outPath, reason: `Decoder completed but did not create ${outPath}.` };
  }

  return {
    ok: true,
    cached: false,
    decoder: externalDecoder.name ?? "external",
    filePath,
    outPath,
  };
}

function findOnPath(executableName, envPath) {
  if (!envPath) return null;
  for (const entry of envPath.split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.join(entry, executableName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findInRoot(root, executableName) {
  const candidates = [
    path.join(root, executableName),
    path.join(root, "bin", executableName),
    path.join(root, "Bin", executableName),
    path.join(root, "DirectXTex", executableName),
    path.join(root, "texconv", executableName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function runTexconvDecoder(filePath, outPath, texconvPath, options) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-texconv-"));
  const ext = path.extname(filePath).toLowerCase();
  const tempExt = ext === ".edds" ? ".dds" : ext;
  const tempInput = path.join(tempDir, `${path.basename(filePath, path.extname(filePath))}${tempExt}`);
  fs.copyFileSync(filePath, tempInput);

  const result = spawnSync(texconvPath, [
    "-y",
    "-ft",
    "png",
    "-o",
    tempDir,
    tempInput,
  ], {
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120000,
    windowsHide: true,
  });

  if (result.error) {
    return { ok: false, filePath, outPath, reason: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      filePath,
      outPath,
      reason: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    };
  }

  const tempOutput = path.join(tempDir, `${path.basename(tempInput, ".dds")}.png`);
  if (!fs.existsSync(tempOutput)) {
    return { ok: false, filePath, outPath, reason: `texconv did not create ${tempOutput}.` };
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.copyFileSync(tempOutput, outPath);
  fs.rmSync(tempDir, { recursive: true, force: true });

  return {
    ok: true,
    cached: false,
    decoder: "texconv",
    filePath,
    outPath,
  };
}

function replaceDecoderPlaceholders(value, replacements) {
  return String(value)
    .replaceAll("{input}", replacements.input)
    .replaceAll("{output}", replacements.output)
    .replaceAll("{outputDir}", replacements.outputDir)
    .replaceAll("{outputBaseName}", replacements.outputBaseName);
}
