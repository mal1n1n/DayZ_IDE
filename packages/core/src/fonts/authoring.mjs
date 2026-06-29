import fs from "node:fs";
import path from "node:path";

import {
  findMissingGlyphs,
  fontExtensions,
  readFontCoverage,
  summarizeFontCoverage,
} from "./registry.mjs";

export function importFontAsset(options = {}) {
  const projectRoot = path.resolve(required(options.projectRoot, "projectRoot"));
  const sourceFont = path.resolve(required(options.sourceFont, "sourceFont"));
  if (!fs.existsSync(sourceFont) || !fs.statSync(sourceFont).isFile()) {
    throw new Error(`Source font does not exist: ${sourceFont}`);
  }

  const ext = path.extname(sourceFont).toLowerCase();
  if (!fontExtensions.has(ext)) throw new Error(`Unsupported font extension: ${ext || "none"}`);

  const fontVirtualPath = normalizeFontVirtualPath(options.fontVirtualPath ?? options.assetVirtualPath, sourceFont);
  const targetFontPath = path.join(projectRoot, fontVirtualPath);
  const write = options.write !== false;
  const coverage = readFontCoverage(sourceFont);
  const sampleText = typeof options.sampleText === "string" ? options.sampleText : "";
  const missingGlyphs = sampleText ? findMissingGlyphs(sampleText, coverage) : [];
  const diagnostics = [];
  const pages = ext === ".fnt"
    ? collectFontPages(sourceFont, targetFontPath, projectRoot, options.pageSources)
    : [];

  if (!coverage.known) {
    diagnostics.push({
      severity: "info",
      code: "font.coverage.unknown",
      message: coverage.reason ?? "Font coverage is unknown.",
      filePath: sourceFont,
    });
  }
  if (missingGlyphs.length > 0) {
    diagnostics.push({
      severity: "warning",
      code: "font.coverage.sample-missing-glyphs",
      message: `${missingGlyphs.length} sample glyphs are missing from ${fontVirtualPath}.`,
      filePath: sourceFont,
      context: { missingGlyphs },
    });
  }
  for (const page of pages) {
    if (!page.exists) {
      diagnostics.push({
        severity: "warning",
        code: "font.page.missing",
        message: `BMFont page texture is missing: ${page.sourcePath}`,
        filePath: sourceFont,
        context: { pageRef: page.ref },
      });
    }
  }

  if (write) {
    fs.mkdirSync(path.dirname(targetFontPath), { recursive: true });
    fs.copyFileSync(sourceFont, targetFontPath);
    for (const page of pages.filter((item) => item.exists)) {
      fs.mkdirSync(path.dirname(page.targetPath), { recursive: true });
      fs.copyFileSync(page.sourcePath, page.targetPath);
      page.written = true;
    }
  }

  return {
    kind: "FontImportResult",
    projectRoot,
    sourceFont,
    targetFontPath,
    fontVirtualPath,
    fontRef: stripExtension(fontVirtualPath),
    written: write,
    coverage: summarizeFontCoverage(coverage),
    sampleText,
    missingGlyphs,
    pages,
    diagnosticCount: diagnostics.length,
    diagnostics,
  };
}

export function extractBmFontPageRefs(content) {
  const refs = [];
  const seen = new Set();
  const text = String(content ?? "");
  const add = (value) => {
    const ref = normalizePageRef(value);
    if (!ref || seen.has(ref.toLowerCase())) return;
    seen.add(ref.toLowerCase());
    refs.push(ref);
  };

  for (const match of text.matchAll(/\bpage\s+[^\r\n<>]*\bfile=(?:"([^"]+)"|'([^']+)'|([^\s]+))/gi)) {
    add(match[1] ?? match[2] ?? match[3]);
  }
  for (const match of text.matchAll(/<page\b[^>]*\bfile=["']?([^"'\s>]+)["']?[^>]*>/gi)) {
    add(match[1]);
  }
  return refs;
}

function collectFontPages(sourceFont, targetFontPath, projectRoot, pageSources) {
  const explicitPages = normalizeExplicitPages(pageSources, sourceFont);
  const refs = explicitPages.length
    ? explicitPages.map((page) => page.ref)
    : extractBmFontPageRefs(fs.readFileSync(sourceFont, "utf8"));
  const sourceDir = path.dirname(sourceFont);
  const targetDir = path.dirname(targetFontPath);
  return refs.map((ref) => {
    const explicit = explicitPages.find((page) => page.ref.toLowerCase() === ref.toLowerCase());
    const sourcePath = explicit?.sourcePath ?? path.resolve(sourceDir, ref);
    const targetPath = path.resolve(targetDir, ref);
    return {
      ref,
      sourcePath,
      targetPath,
      virtualPath: normalizeSlashes(path.relative(projectRoot, targetPath)),
      exists: fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile(),
      written: false,
    };
  });
}

function normalizeExplicitPages(pageSources, sourceFont) {
  if (!Array.isArray(pageSources)) return [];
  return pageSources.map((item) => {
    if (typeof item === "string") {
      return {
        ref: normalizePageRef(path.basename(item)),
        sourcePath: path.resolve(item),
      };
    }
    const rawSourcePath = required(item?.sourcePath ?? item?.source, "page sourcePath");
    const sourcePath = path.isAbsolute(rawSourcePath)
      ? rawSourcePath
      : path.resolve(path.dirname(sourceFont), rawSourcePath);
    return {
      ref: normalizePageRef(item.ref ?? item.pageRef ?? path.basename(sourcePath)),
      sourcePath,
    };
  }).filter((item) => item.ref);
}

function normalizeFontVirtualPath(value, sourceFont) {
  const sourceExt = path.extname(sourceFont);
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : `gui/fonts/${path.basename(sourceFont)}`;
  const normalized = normalizeSlashes(raw).replace(/^\/+/, "");
  return path.extname(normalized) ? normalized : `${normalized}${sourceExt}`;
}

function normalizePageRef(value) {
  const raw = normalizeSlashes(String(value ?? "").trim()).replace(/^\/+/, "");
  if (!raw) return "";
  if (/^[A-Za-z]:\//.test(raw)) return path.basename(raw);
  if (raw.includes("..")) return path.basename(raw);
  return raw;
}

function stripExtension(value) {
  const ext = path.extname(value);
  return ext ? value.slice(0, -ext.length) : value;
}

function normalizeSlashes(value) {
  return String(value).replaceAll("\\", "/");
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
