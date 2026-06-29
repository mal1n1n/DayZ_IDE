import path from "node:path";

import { walkWidgets } from "../layout/parser.mjs";

const widgetTypeMap = new Map([
  ["TextWidgetClass", "TextWidget"],
  ["MultilineTextWidgetClass", "MultilineTextWidget"],
  ["RichTextWidgetClass", "RichTextWidget"],
  ["ImageWidgetClass", "ImageWidget"],
  ["ButtonWidgetClass", "ButtonWidget"],
  ["CheckBoxWidgetClass", "CheckBoxWidget"],
  ["EditBoxWidgetClass", "EditBoxWidget"],
  ["SliderWidgetClass", "SliderWidget"],
  ["TextListboxWidgetClass", "TextListboxWidget"],
  ["ScrollWidgetClass", "ScrollWidget"],
  ["GridSpacerWidgetClass", "GridSpacerWidget"],
  ["WrapSpacerWidgetClass", "WrapSpacerWidget"],
  ["PanelWidgetClass", "Widget"],
  ["FrameWidgetClass", "Widget"],
]);

export function generateControllerSkeleton(document, options = {}) {
  const className = sanitizeClassName(options.className ?? defaultClassName(document.filePath));
  const layoutPath = normalizeLayoutPath(options.layoutPath ?? document.filePath ?? "path/to/layout.layout");
  const baseClass = options.baseClass ?? "UIScriptedMenu";
  const includeRoot = options.includeRoot !== false;
  const widgets = selectNamedWidgets(document, { includeRoot });
  const lines = [];

  lines.push(`class ${className} extends ${baseClass}`);
  lines.push("{");
  lines.push(" protected Widget m_Root;");
  for (const widget of widgets) {
    lines.push(` protected ${widget.scriptType} ${widget.memberName};`);
  }
  lines.push("");
  lines.push(" override Widget Init()");
  lines.push(" {");
  lines.push(`  m_Root = GetGame().GetWorkspace().CreateWidgets("${escapeEnforceString(layoutPath)}");`);
  lines.push("");
  for (const widget of widgets) {
    lines.push(`  ${widget.memberName} = ${widget.castPrefix}m_Root.FindAnyWidget("${escapeEnforceString(widget.name)}")${widget.castSuffix};`);
  }
  lines.push("");
  lines.push("  return m_Root;");
  lines.push(" }");
  lines.push("");
  lines.push(" override void OnShow()");
  lines.push(" {");
  lines.push("  super.OnShow();");
  lines.push(" }");
  lines.push("");
  lines.push(" override void OnHide()");
  lines.push(" {");
  lines.push("  super.OnHide();");
  lines.push(" }");
  lines.push("}");
  lines.push("");

  return {
    className,
    baseClass,
    layoutPath,
    widgets,
    source: lines.join("\n"),
  };
}

export function selectNamedWidgets(document, options = {}) {
  const includeRoot = options.includeRoot !== false;
  const seenMembers = new Set();
  const widgets = [];

  for (const { node, depth } of walkWidgets(document)) {
    if (!includeRoot && depth === 0) continue;
    if (!node.name) continue;
    const scriptType = widgetTypeMap.get(node.typeClass) ?? "Widget";
    const memberName = uniqueMemberName(`m_${sanitizeIdentifier(node.name)}`, seenMembers);
    widgets.push({
      name: node.name,
      typeClass: node.typeClass,
      scriptType,
      memberName,
      line: node.line,
      castPrefix: scriptType === "Widget" ? "" : `${scriptType}.Cast(`,
      castSuffix: scriptType === "Widget" ? "" : ")",
    });
  }

  return widgets;
}

function defaultClassName(filePath) {
  if (!filePath) return "GeneratedMenu";
  return `${sanitizeClassName(path.basename(filePath, path.extname(filePath)))}Menu`;
}

function sanitizeClassName(value) {
  const id = sanitizeIdentifier(value);
  const normalized = id.startsWith("m_") ? id.slice(2) : id;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function sanitizeIdentifier(value) {
  const normalized = String(value)
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const id = normalized || "Widget";
  return /^[A-Za-z_]/.test(id) ? id : `_${id}`;
}

function uniqueMemberName(name, seen) {
  let candidate = name;
  let index = 2;
  while (seen.has(candidate.toLowerCase())) {
    candidate = `${name}_${index}`;
    index += 1;
  }
  seen.add(candidate.toLowerCase());
  return candidate;
}

function normalizeLayoutPath(value) {
  return String(value).replaceAll("\\", "/");
}

function escapeEnforceString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}
