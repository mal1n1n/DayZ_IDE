import fs from "node:fs";
import path from "node:path";

import { buildProjectAssetIndex } from "../assets/index.mjs";
import { parseLayout, walkWidgets } from "../layout/parser.mjs";
import { normalizeSlashes } from "../project/path-utils.mjs";
import { resolveStyleInheritance } from "../styles/registry.mjs";
import { extractBmFontPageRefs } from "./authoring.mjs";
import { findMissingGlyphs, fontEntryToJson } from "./registry.mjs";

export function buildFontCoverageReport(projectRootOrOptions, maybeOptions = {}) {
  const options = typeof projectRootOrOptions === "string"
    ? { ...maybeOptions, projectRoot: projectRootOrOptions }
    : { ...(projectRootOrOptions ?? {}) };
  const projectRoot = path.resolve(required(options.projectRoot, "projectRoot"));
  const projectIndex = options.projectIndex ?? buildProjectAssetIndex(projectRoot);
  const targetLanguages = normalizeTargetLanguages(options.languages ?? options.targetLanguages, projectIndex.stringTable);
  const layoutPaths = resolveLayoutPaths(projectRoot, projectIndex, options);
  const diagnostics = [];
  const usageByFont = new Map();
  const unresolvedFontRefs = new Map();

  for (const layoutPath of layoutPaths) {
    const document = parseLayout(fs.readFileSync(layoutPath, "utf8"), { filePath: layoutPath });
    for (const { node } of walkWidgets(document)) {
      const fontRefs = collectNodeFontRefs(node, projectIndex.styles);
      if (fontRefs.length === 0) continue;
      const textSamples = collectNodeTextSamples(node, projectIndex.stringTable, targetLanguages, diagnostics, document);
      if (textSamples.length === 0) continue;
      for (const fontRef of fontRefs) {
        const entry = projectIndex.fonts.resolve(fontRef.font);
        if (!entry) {
          recordUnresolvedFont(unresolvedFontRefs, fontRef, node, document, textSamples);
          continue;
        }
        const usage = ensureFontUsage(usageByFont, entry);
        for (const sample of textSamples) recordFontSample(usage, sample, fontRef, node, document);
      }
    }
  }

  diagnostics.push(...unresolvedDiagnostics(unresolvedFontRefs));
  const fonts = projectIndex.fonts.fonts.map((entry) => {
    const usage = usageByFont.get(entry.virtualPath) ?? createFontUsage(entry);
    const font = fontUsageToReport(usage, projectRoot);
    diagnostics.push(...font.diagnostics);
    return font;
  });
  const missingGlyphCount = fonts.reduce((sum, font) => sum + font.missingGlyphCount, 0);
  const unknownCoverageCount = fonts.filter((font) => font.used && !font.coverage.known).length;
  const diagnosticCount = diagnostics.length;

  return {
    kind: "FontCoverageReport",
    projectRoot,
    layoutCount: layoutPaths.length,
    targetLanguages,
    fontCount: fonts.length,
    usedFontCount: fonts.filter((font) => font.used).length,
    knownCoverageCount: fonts.filter((font) => font.coverage.known).length,
    missingGlyphCount,
    unknownCoverageCount,
    ready: !diagnostics.some((diagnostic) => ["error", "warning"].includes(diagnostic.severity)),
    diagnosticCount,
    diagnostics,
    fonts,
  };
}

function resolveLayoutPaths(projectRoot, projectIndex, options) {
  const explicit = options.layoutPath ?? options.layoutFile ?? options.layout;
  if (explicit) return [path.resolve(explicit)];
  return projectIndex.files
    .filter((filePath) => filePath.toLowerCase().endsWith(".layout"))
    .sort((a, b) => normalizeSlashes(path.relative(projectRoot, a)).localeCompare(normalizeSlashes(path.relative(projectRoot, b))));
}

function normalizeTargetLanguages(value, stringTable) {
  const explicit = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[|,;\n]/)
      : [];
  const languages = explicit.map((item) => String(item).trim()).filter(Boolean);
  if (languages.length > 0) return uniqueStrings(languages);

  const inferred = [];
  for (const table of stringTable?.tables ?? []) {
    for (const entry of table.entries ?? []) inferred.push(...Object.keys(entry.values ?? {}));
  }
  return uniqueStrings(inferred);
}

function collectNodeFontRefs(node, styleRegistry) {
  const direct = node.props.find((prop) => prop.key.toLowerCase() === "font" && prop.values.length > 0);
  if (direct) {
    return [{
      font: valuesToText(direct.values),
      prop: direct,
      source: "font",
    }];
  }

  const styleProp = node.props.find((prop) => prop.key.toLowerCase() === "style" && prop.values.length > 0);
  if (!styleProp || !styleRegistry) return [];
  const styleName = valuesToText(styleProp.values);
  const style = resolveStyleInheritance(styleRegistry, styleName);
  const styleFont = style.properties.find((prop) => prop.key.toLowerCase() === "font" && prop.values.length > 0);
  if (!styleFont) return [];
  return [{
    font: styleFont.values.join(" "),
    prop: styleProp,
    source: "style",
    style: styleName,
  }];
}

function collectNodeTextSamples(node, stringTable, targetLanguages, diagnostics, document) {
  const prop = node.props.find((candidate) => candidate.key.toLowerCase() === "text" && candidate.values.length > 0);
  if (!prop) return [];
  const value = valuesToText(prop.values);
  if (!value) return [];
  if (value.startsWith("#") && stringTable?.get) {
    const entry = stringTable.get(value) ?? stringTable.get(value.slice(1));
    if (entry?.values) {
      const languages = targetLanguages.length ? targetLanguages : Object.keys(entry.values);
      return languages.flatMap((language) => {
        const text = entry.values[language] ?? "";
        if (!text) {
          diagnostics.push({
            code: "font.coverage.translation-missing",
            severity: "warning",
            message: `Stringtable key ${value} has no ${language} text for glyph coverage.`,
            filePath: document.filePath,
            line: prop.line,
            column: prop.column,
            context: {
              widget: node.name,
              key: value,
              language,
            },
          });
          return [];
        }
        return [{
          text,
          language,
          source: value,
          prop,
        }];
      });
    }
  }
  return [{
    text: value,
    language: "literal",
    source: "literal",
    prop,
  }];
}

function ensureFontUsage(map, entry) {
  if (!map.has(entry.virtualPath)) map.set(entry.virtualPath, createFontUsage(entry));
  return map.get(entry.virtualPath);
}

function createFontUsage(entry) {
  return {
    entry,
    samples: [],
    languages: new Map(),
  };
}

function recordFontSample(usage, sample, fontRef, node, document) {
  usage.samples.push({
    text: sample.text,
    language: sample.language,
    source: sample.source,
    widget: node.name,
    layoutPath: document.filePath,
    fontSource: fontRef.source,
    style: fontRef.style ?? null,
  });
  if (!usage.languages.has(sample.language)) {
    usage.languages.set(sample.language, {
      language: sample.language,
      sampleCount: 0,
      requiredGlyphs: new Map(),
      missingGlyphs: new Map(),
      samples: [],
    });
  }
  const language = usage.languages.get(sample.language);
  language.sampleCount += 1;
  language.samples.push({
    widget: node.name,
    source: sample.source,
    text: sample.text,
    layoutVirtualPath: normalizeSlashes(path.basename(document.filePath)),
  });
  for (const char of Array.from(sample.text)) {
    if (char === "\r" || char === "\n" || char === "\t") continue;
    const glyph = glyphInfo(char);
    language.requiredGlyphs.set(glyph.hex, glyph);
  }
  for (const glyph of findMissingGlyphs(sample.text, usage.entry.coverage)) {
    language.missingGlyphs.set(glyph.hex, glyph);
  }
}

function fontUsageToReport(usage, projectRoot) {
  const base = fontEntryToJson(usage.entry);
  const languages = [...usage.languages.values()].map((language) => ({
    language: language.language,
    sampleCount: language.sampleCount,
    requiredGlyphCount: language.requiredGlyphs.size,
    missingGlyphCount: language.missingGlyphs.size,
    missingGlyphs: [...language.missingGlyphs.values()],
    samples: language.samples.slice(0, 12),
  })).sort((a, b) => a.language.localeCompare(b.language));
  const missingGlyphs = dedupeGlyphs(languages.flatMap((language) => language.missingGlyphs));
  const diagnostics = [];
  if (usage.samples.length > 0 && !usage.entry.coverage?.known) {
    diagnostics.push({
      code: "font.coverage.unknown",
      severity: "warning",
      message: `Font coverage is unknown for used font: ${usage.entry.virtualPath}`,
      filePath: usage.entry.filePath,
      context: {
        fontPath: usage.entry.virtualPath,
        reason: usage.entry.coverage?.reason ?? null,
      },
    });
  }
  if (missingGlyphs.length > 0) {
    diagnostics.push({
      code: "font.coverage.missing-glyphs",
      severity: "warning",
      message: `${missingGlyphs.length} glyph(s) are missing from ${usage.entry.virtualPath}.`,
      filePath: usage.entry.filePath,
      context: {
        fontPath: usage.entry.virtualPath,
        missingGlyphs,
      },
    });
  }
  return {
    ...base,
    ref: stripExtension(base.virtualPath),
    used: usage.samples.length > 0,
    sampleCount: usage.samples.length,
    languages,
    missingGlyphCount: missingGlyphs.length,
    missingGlyphs,
    atlasPages: fontAtlasPages(usage.entry, projectRoot),
    diagnostics,
  };
}

function fontAtlasPages(entry, projectRoot) {
  if (path.extname(entry.filePath).toLowerCase() !== ".fnt") return [];
  let refs = [];
  try {
    refs = extractBmFontPageRefs(fs.readFileSync(entry.filePath, "utf8"));
  } catch {
    return [];
  }
  return refs.map((ref) => {
    const filePath = path.resolve(path.dirname(entry.filePath), ref);
    return {
      ref,
      filePath,
      virtualPath: normalizeSlashes(path.relative(projectRoot, filePath)),
      exists: fs.existsSync(filePath) && fs.statSync(filePath).isFile(),
    };
  });
}

function recordUnresolvedFont(map, fontRef, node, document, samples) {
  const key = fontRef.font || "(empty)";
  if (!map.has(key)) {
    map.set(key, {
      font: key,
      source: fontRef.source,
      style: fontRef.style ?? null,
      widgets: new Set(),
      layoutPaths: new Set(),
      samples: 0,
    });
  }
  const item = map.get(key);
  item.widgets.add(node.name);
  item.layoutPaths.add(document.filePath);
  item.samples += samples.length;
}

function unresolvedDiagnostics(unresolved) {
  return [...unresolved.values()].map((item) => ({
    code: "font.coverage.font-unresolved",
    severity: "warning",
    message: `Font reference is unresolved for coverage report: ${item.font}`,
    context: {
      font: item.font,
      source: item.source,
      style: item.style,
      widgets: [...item.widgets],
      layoutPaths: [...item.layoutPaths],
      sampleCount: item.samples,
    },
  }));
}

function dedupeGlyphs(glyphs) {
  const byHex = new Map();
  for (const glyph of glyphs) byHex.set(glyph.hex, glyph);
  return [...byHex.values()].sort((a, b) => a.codepoint - b.codepoint);
}

function glyphInfo(char) {
  const codepoint = char.codePointAt(0);
  return {
    char,
    codepoint,
    hex: `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`,
  };
}

function valuesToText(values) {
  return values.map((token) => token.value).join(" ");
}

function stripExtension(value) {
  const ext = path.extname(value);
  return ext ? value.slice(0, -ext.length) : value;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
