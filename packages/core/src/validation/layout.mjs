import fs from "node:fs";
import path from "node:path";

import { buildProjectAssetIndex, resolveImageReference } from "../assets/index.mjs";
import { findMissingGlyphs } from "../fonts/registry.mjs";
import { parseLayout, walkWidgets } from "../layout/parser.mjs";
import { normalizeVirtualRef } from "../project/path-utils.mjs";
import { resolveStyleInheritance } from "../styles/registry.mjs";

export function validateLayoutDocument(document, options = {}) {
  const diagnostics = [];

  for (const diagnostic of document.diagnostics) {
    diagnostics.push({
      ...diagnostic,
      severity: "error",
    });
  }

  diagnostics.push(...validateDuplicateWidgetNames(document));
  diagnostics.push(...validateWidgetBoxes(document));
  diagnostics.push(...validateImageReferences(document, options.projectIndex));
  const stringTable = options.stringTable ?? options.projectIndex?.stringTable;
  const styleRegistry = options.styleRegistry ?? options.projectIndex?.styles;
  diagnostics.push(...validateStringRefs(document, stringTable));
  diagnostics.push(...validateStyleRefs(document, styleRegistry));
  diagnostics.push(...validateFontRefs(document, options.fontRegistry ?? options.projectIndex?.fonts, {
    stringTable,
    styleRegistry,
  }));

  return diagnostics;
}

export function validateLayoutFile(filePath, options = {}) {
  const absoluteFilePath = path.resolve(filePath);
  const document = parseLayout(fs.readFileSync(absoluteFilePath, "utf8"), { filePath: absoluteFilePath });
  return {
    filePath: absoluteFilePath,
    diagnostics: validateLayoutDocument(document, options),
    document,
  };
}

export function validateProject(root, options = {}) {
  const projectIndex = options.projectIndex ?? buildProjectAssetIndex(root);
  const layoutFiles = projectIndex.files.filter((filePath) => filePath.toLowerCase().endsWith(".layout"));
  const layouts = layoutFiles.map((filePath) => validateLayoutFile(filePath, {
    ...options,
    projectIndex,
  }));
  const scriptDiagnostics = validateScriptRefs(projectIndex, layouts);
  const stringTableDiagnostics = projectIndex.stringTable?.diagnostics ?? [];
  const styleDiagnostics = projectIndex.styles?.diagnostics ?? [];
  const diagnosticCount = layouts.reduce((count, layout) => count + layout.diagnostics.length, 0)
    + scriptDiagnostics.length
    + stringTableDiagnostics.length
    + styleDiagnostics.length;

  return {
    root,
    layoutCount: layouts.length,
    diagnosticCount,
    layouts: layouts.map((layout) => ({
      filePath: layout.filePath,
      diagnostics: layout.diagnostics,
    })),
    scripts: {
      diagnosticCount: scriptDiagnostics.length,
      diagnostics: scriptDiagnostics,
    },
    stringTable: {
      diagnosticCount: stringTableDiagnostics.length,
      diagnostics: stringTableDiagnostics,
    },
    styles: {
      diagnosticCount: styleDiagnostics.length,
      diagnostics: styleDiagnostics,
    },
  };
}

function validateDuplicateWidgetNames(document) {
  const byName = new Map();
  for (const { node } of walkWidgets(document)) {
    if (!node.name) continue;
    const key = node.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(node);
  }

  const diagnostics = [];
  for (const [name, nodes] of byName) {
    if (nodes.length <= 1) continue;
    for (const node of nodes.slice(1)) {
      diagnostics.push(makeDiagnostic(document, {
        code: "layout.widget.duplicate-name",
        severity: "warning",
        message: `Duplicate widget name "${node.name}". Scripts using FindAnyWidget may bind the wrong node.`,
        node,
        context: { name, firstLine: nodes[0].line },
      }));
    }
  }
  return diagnostics;
}

function validateWidgetBoxes(document) {
  const diagnostics = [];
  for (const { node } of walkWidgets(document)) {
    const size = readNumberListProp(node, "size");
    if (!size) continue;
    if (size.length < 2 || !Number.isFinite(size[0]) || !Number.isFinite(size[1])) {
      diagnostics.push(makeDiagnostic(document, {
        code: "layout.widget.invalid-size",
        severity: "error",
        message: `Widget "${node.name}" has an invalid size property.`,
        node,
      }));
      continue;
    }
    if (size[0] <= 0 || size[1] <= 0) {
      diagnostics.push(makeDiagnostic(document, {
        code: "layout.widget.non-positive-size",
        severity: "warning",
        message: `Widget "${node.name}" has a non-positive size (${size[0]} ${size[1]}).`,
        node,
        context: { size },
      }));
    }
  }
  return diagnostics;
}

function validateImageReferences(document, projectIndex) {
  if (!projectIndex) return [];

  const diagnostics = [];
  for (const { node } of walkWidgets(document)) {
    for (const prop of node.props) {
      if (!/^image\d*$/i.test(prop.key) || prop.values.length === 0) continue;
      const ref = prop.values.map((value) => value.value).join(" ");
      if (!ref.trim()) continue;

      const resolved = resolveImageReference(ref, projectIndex);
      if (resolved.ok || resolved.external) continue;

      diagnostics.push({
        code: imageDiagnosticCode(resolved.mode),
        severity: "error",
        message: `Image reference is unresolved: ${ref}`,
        filePath: document.filePath,
        line: prop.line,
        column: prop.column,
        span: prop.span,
        context: {
          widget: node.name,
          widgetType: node.typeClass,
          ref,
          mode: resolved.mode,
        },
      });
    }
  }
  return diagnostics;
}

function validateStringRefs(document, stringTable) {
  if (!stringTable) return [];

  const diagnostics = [];
  for (const { node } of walkWidgets(document)) {
    for (const prop of node.props) {
      if (prop.key.toLowerCase() !== "text" || prop.values.length === 0) continue;
      const value = prop.values.map((token) => token.value).join(" ");
      if (!value.startsWith("#STR_")) continue;
      if (stringTable.has(value) || stringTable.has(value.slice(1))) continue;
      diagnostics.push({
        code: "layout.text.stringtable-unresolved",
        severity: "error",
        message: `Stringtable key is unresolved: ${value}`,
        filePath: document.filePath,
        line: prop.line,
        column: prop.column,
        span: prop.span,
        context: {
          widget: node.name,
          key: value,
        },
      });
    }
  }
  return diagnostics;
}

function validateStyleRefs(document, styleRegistry) {
  if (!styleRegistry || styleRegistry.byName.size === 0) return [];

  const diagnostics = [];
  for (const { node } of walkWidgets(document)) {
    for (const prop of node.props) {
      if (prop.key.toLowerCase() !== "style" || prop.values.length === 0) continue;
      const style = prop.values.map((token) => token.value).join(" ");
      if (!style || styleRegistry.has(style)) continue;
      diagnostics.push({
        code: "layout.style.unresolved",
        severity: "warning",
        message: `Style reference is unresolved: ${style}`,
        filePath: document.filePath,
        line: prop.line,
        column: prop.column,
        span: prop.span,
        context: {
          widget: node.name,
          style,
        },
      });
    }
  }
  return diagnostics;
}

function validateFontRefs(document, fontRegistry, options = {}) {
  if (!fontRegistry || fontRegistry.fonts.length === 0) return [];

  const diagnostics = [];
  for (const { node } of walkWidgets(document)) {
    for (const ref of collectNodeFontRefs(node, options.styleRegistry)) {
      const font = ref.font;
      const entry = font ? fontRegistry.resolve(font) : null;
      if (!font || !entry) {
        diagnostics.push({
          code: "layout.font.unresolved",
          severity: "warning",
          message: `Font reference is unresolved: ${font}`,
          filePath: document.filePath,
          line: ref.prop.line,
          column: ref.prop.column,
          span: ref.prop.span,
          context: {
            widget: node.name,
            font,
            source: ref.source,
            style: ref.style ?? null,
          },
        });
        continue;
      }

      if (!entry.coverage?.known) continue;
      for (const textRef of collectNodeTextValues(node, options.stringTable)) {
        const missingGlyphs = findMissingGlyphs(textRef.text, entry.coverage);
        if (missingGlyphs.length === 0) continue;
        diagnostics.push({
          code: "layout.font.glyph-missing",
          severity: "warning",
          message: `Font "${font}" is missing ${missingGlyphs.length} glyph(s) for widget "${node.name}".`,
          filePath: document.filePath,
          line: textRef.prop.line,
          column: textRef.prop.column,
          span: textRef.prop.span,
          context: {
            widget: node.name,
            font,
            fontPath: entry.virtualPath,
            text: textRef.text,
            textSource: textRef.source,
            language: textRef.language ?? null,
            missingGlyphs,
            fontSource: ref.source,
            style: ref.style ?? null,
          },
        });
      }
    }
  }
  return diagnostics;
}

function collectNodeFontRefs(node, styleRegistry) {
  const direct = node.props.find((prop) => prop.key.toLowerCase() === "font" && prop.values.length > 0);
  if (direct) {
    return [{
      font: direct.values.map((token) => token.value).join(" "),
      prop: direct,
      source: "font",
    }];
  }

  const styleProp = node.props.find((prop) => prop.key.toLowerCase() === "style" && prop.values.length > 0);
  if (!styleProp || !styleRegistry) return [];
  const styleName = styleProp.values.map((token) => token.value).join(" ");
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

function collectNodeTextValues(node, stringTable) {
  const prop = node.props.find((candidate) => candidate.key.toLowerCase() === "text" && candidate.values.length > 0);
  if (!prop) return [];
  const value = prop.values.map((token) => token.value).join(" ");
  if (!value) return [];
  if (value.startsWith("#") && stringTable?.get) {
    const entry = stringTable.get(value) ?? stringTable.get(value.slice(1));
    if (entry?.values) {
      return Object.entries(entry.values)
        .filter(([, text]) => String(text ?? "") !== "")
        .map(([language, text]) => ({
          text,
          language,
          prop,
          source: value,
        }));
    }
  }
  return [{ text: value, prop, source: "literal" }];
}

function validateScriptRefs(projectIndex, layouts) {
  const diagnostics = [];
  const widgetNames = new Set();
  for (const layout of layouts) {
    for (const { node } of walkWidgets(layout.document)) {
      if (node.name) widgetNames.add(node.name.toLowerCase());
    }
  }

  for (const ref of projectIndex.scripts.refs.findWidgets) {
    if (widgetNames.has(ref.ref.toLowerCase())) continue;
    diagnostics.push({
      code: "script.widget.findanywidget-unresolved",
      severity: "warning",
      message: `FindAnyWidget target is not present in parsed layouts: ${ref.ref}`,
      filePath: ref.filePath,
      line: ref.line,
      column: 1,
      context: {
        ref: ref.ref,
        script: ref.virtualPath,
      },
    });
  }

  for (const ref of projectIndex.scripts.refs.createWidgets) {
    const normalized = normalizeVirtualRef(ref.ref).toLowerCase();
    const exists = projectIndex.indexes.byLowerVirtual.has(normalized)
      || [...projectIndex.indexes.byLowerVirtual.keys()].some((candidate) => candidate.endsWith(normalized));
    if (exists) continue;
    diagnostics.push({
      code: "script.layout.createwidgets-unresolved",
      severity: "error",
      message: `CreateWidgets layout path is unresolved: ${ref.ref}`,
      filePath: ref.filePath,
      line: ref.line,
      column: 1,
      context: {
        ref: ref.ref,
        script: ref.virtualPath,
      },
    });
  }

  for (const ref of projectIndex.scripts.refs.setText) {
    if (projectIndex.stringTable?.has(ref.ref)) continue;
    diagnostics.push({
      code: "script.text.stringtable-unresolved",
      severity: "error",
      message: `SetText stringtable key is unresolved: ${ref.ref}`,
      filePath: ref.filePath,
      line: ref.line,
      column: 1,
      context: {
        ref: ref.ref,
        script: ref.virtualPath,
      },
    });
  }

  return diagnostics;
}

function imageDiagnosticCode(mode) {
  if (mode === "set-unresolved") return "layout.image.set-unresolved";
  if (mode === "set-image-unresolved") return "layout.image.set-image-unresolved";
  if (mode === "imageset-texture-unresolved") return "layout.image.imageset-texture-unresolved";
  return "layout.image.asset-unresolved";
}

function readNumberListProp(node, key) {
  const prop = node.props.find((candidate) => candidate.key.toLowerCase() === key);
  if (!prop) return null;
  return prop.values.map((value) => Number(value.value));
}

function makeDiagnostic(document, { code, severity, message, node, context = {} }) {
  return {
    code,
    severity,
    message,
    filePath: document.filePath,
    line: node.line,
    column: node.column,
    span: node.span,
    context,
  };
}
