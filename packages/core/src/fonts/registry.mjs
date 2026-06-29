import fs from "node:fs";
import path from "node:path";

import { normalizeVirtualRef, relativeVirtual } from "../project/path-utils.mjs";

export const fontExtensions = new Set([
  ".fnt",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
]);

export function buildFontRegistry(root, files) {
  const fonts = [];
  const byVirtualNoExt = new Map();
  const byFileNameNoExt = new Map();

  for (const filePath of files.filter((candidate) => fontExtensions.has(path.extname(candidate).toLowerCase()))) {
    const virtualPath = relativeVirtual(root, filePath);
    const noExt = stripExtension(virtualPath).toLowerCase();
    const fileNameNoExt = stripExtension(path.basename(filePath)).toLowerCase();
    const entry = {
      filePath,
      virtualPath,
      coverage: readFontCoverage(filePath),
    };
    fonts.push(entry);
    byVirtualNoExt.set(noExt, entry);
    if (!byFileNameNoExt.has(fileNameNoExt)) byFileNameNoExt.set(fileNameNoExt, []);
    byFileNameNoExt.get(fileNameNoExt).push(entry);
  }

  return {
    fonts,
    resolve(ref) {
      return resolveFontRef(ref, { byVirtualNoExt, byFileNameNoExt });
    },
  };
}

export function readFontCoverage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".fnt") {
    return {
      known: false,
      glyphCount: 0,
      reason: `Coverage parsing is not supported for ${ext || "unknown"} fonts.`,
    };
  }

  try {
    return parseFontCoverage(fs.readFileSync(filePath, "utf8"), { filePath });
  } catch (error) {
    return {
      known: false,
      glyphCount: 0,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parseFontCoverage(content, options = {}) {
  const codepoints = new Set();
  const text = String(content);
  for (const match of text.matchAll(/\bchar\s+[^\r\n<>]*\bid=(-?\d+)/gi)) {
    addCodepoint(codepoints, Number(match[1]));
  }
  for (const match of text.matchAll(/<char\b[^>]*\bid=["']?(-?\d+)["']?[^>]*>/gi)) {
    addCodepoint(codepoints, Number(match[1]));
  }

  return {
    known: codepoints.size > 0,
    glyphCount: codepoints.size,
    codepoints,
    summary: summarizeFontCoverage({ codepoints }),
    reason: codepoints.size > 0 ? null : "No BMFont char id entries were found.",
    filePath: options.filePath ?? null,
  };
}

export function summarizeFontCoverage(coverage) {
  const codepoints = [...(coverage?.codepoints ?? [])].sort((a, b) => a - b);
  return {
    known: coverage?.known === true,
    glyphCount: coverage?.glyphCount ?? codepoints.length,
    ranges: compactCodepointRanges(codepoints),
    reason: coverage?.reason ?? null,
  };
}

export function fontEntryToJson(entry) {
  return {
    filePath: entry.filePath,
    virtualPath: entry.virtualPath,
    coverage: summarizeFontCoverage(entry.coverage),
  };
}

export function fontRegistryToJson(registry) {
  const fonts = (registry?.fonts ?? []).map(fontEntryToJson);
  return {
    kind: "FontRegistry",
    count: fonts.length,
    knownCoverage: fonts.filter((font) => font.coverage.known).length,
    fonts,
  };
}

export function findMissingGlyphs(text, coverage) {
  if (!coverage?.known || !coverage.codepoints) return [];
  const missing = [];
  const seen = new Set();
  for (const char of Array.from(String(text ?? ""))) {
    if (isIgnoredCoverageChar(char)) continue;
    const codepoint = char.codePointAt(0);
    if (coverage.codepoints.has(codepoint) || seen.has(codepoint)) continue;
    seen.add(codepoint);
    missing.push({
      char,
      codepoint,
      hex: `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`,
    });
  }
  return missing;
}

export function resolveFontRef(ref, index) {
  const normalized = stripExtension(normalizeVirtualRef(ref)).toLowerCase();
  if (index.byVirtualNoExt.has(normalized)) return index.byVirtualNoExt.get(normalized);
  const basename = stripExtension(path.basename(normalized)).toLowerCase();
  const sameName = index.byFileNameNoExt.get(basename) ?? [];
  return sameName.length === 1 ? sameName[0] : null;
}

function stripExtension(value) {
  const ext = path.extname(value);
  return ext ? value.slice(0, -ext.length) : value;
}

function addCodepoint(codepoints, codepoint) {
  if (Number.isInteger(codepoint) && codepoint >= 0 && codepoint <= 0x10ffff) {
    codepoints.add(codepoint);
  }
}

function compactCodepointRanges(codepoints) {
  const ranges = [];
  for (const codepoint of codepoints) {
    const last = ranges[ranges.length - 1];
    if (last && last.end + 1 === codepoint) {
      last.end = codepoint;
    } else {
      ranges.push({ start: codepoint, end: codepoint });
    }
  }
  return ranges.map((range) => ({
    ...range,
    label: range.start === range.end
      ? formatCodepoint(range.start)
      : `${formatCodepoint(range.start)}-${formatCodepoint(range.end)}`,
  }));
}

function formatCodepoint(codepoint) {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function isIgnoredCoverageChar(char) {
  return char === "\r" || char === "\n" || char === "\t";
}
