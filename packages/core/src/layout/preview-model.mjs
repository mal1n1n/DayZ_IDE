import { resolveImageReference } from "../assets/index.mjs";
import { localizeStringValue } from "../localization/stringtable.mjs";
import { resolveStyleInheritance } from "../styles/registry.mjs";
import { describeWidgetProperties } from "./property-schema.mjs";

export function buildLayoutPreviewModel(document, options = {}) {
  const viewport = {
    width: options.width ?? 1280,
    height: options.height ?? 720,
  };
  const projectIndex = options.projectIndex ?? null;
  const styleRegistry = options.styleRegistry ?? projectIndex?.styles ?? null;
  const previewState = normalizePreviewState(options.previewState ?? options.state ?? "normal");
  const rootBox = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const nodes = [];

  for (const [index, root] of document.roots.entries()) {
    appendNode(root, {
      parentBox: rootBox,
      path: `${root.name || root.typeClass || "root"}:${index}`,
      parentId: null,
      depth: 0,
      nodes,
      projectIndex,
      styleRegistry,
      language: options.language ?? "English",
      previewState,
    });
  }

  return {
    kind: "LayoutPreviewModel",
    filePath: document.filePath,
    viewport,
    previewState,
    nodes,
    diagnostics: document.diagnostics,
  };
}

function appendNode(node, context) {
  const styleName = readStringProp(node, "style", null);
  const resolvedStyle = styleName && context.styleRegistry
    ? resolveStyleInheritance(context.styleRegistry, styleName)
    : null;
  const stylePreview = buildStylePreview(resolvedStyle);
  const box = computeBox(node, context.parentBox, { stylePreview });
  const rawText = readStringProp(node, "text", null);
  const explicitColor = readNumberListProp(node, "color", null);
  const color = explicitColor ?? stylePreview?.textColor ?? stylePreview?.color ?? null;
  const alpha = readNumberProp(node, "alpha", stylePreview?.alpha ?? 1);
  const stateColors = {
    normal: color,
    hover: readStateColorProp(node, ["hovercolor", "mouseovercolor", "focusedcolor"], null) ?? stylePreview?.hoverColor ?? null,
    selected: readStateColorProp(node, ["selectedcolor", "focuscolor"], null) ?? stylePreview?.selectedColor ?? null,
    disabled: readStateColorProp(node, ["disabledcolor", "disablecolor"], null) ?? stylePreview?.disabledColor ?? null,
  };
  const hasRequestedStateColor = Boolean(stateColors[context.previewState]);
  const stateColor = stateColors[context.previewState] ?? stateColors.normal;
  const renderAlpha = context.previewState === "disabled" && !stateColors.disabled
    ? alpha * 0.45
    : alpha;
  const previewNode = {
    id: context.path,
    typeClass: node.typeClass,
    name: node.name,
    depth: context.depth,
    parentId: context.parentId,
    source: {
      line: node.line,
      column: node.column,
      span: node.span,
    },
    box,
    parentBox: context.parentBox,
    props: Object.fromEntries(node.props.map((prop) => [prop.key, prop.values.map((value) => value.value)])),
    typedProperties: describeWidgetProperties(node),
    visible: readBooleanProp(node, "visible", stylePreview?.visible ?? true),
    ignorePointer: readBooleanProp(node, "ignorepointer", stylePreview?.ignorePointer ?? false),
    priority: readNumberProp(node, "priority", 0),
    style: styleName,
    stylePreview,
    styleResolved: resolvedStyle ? {
      ok: resolvedStyle.ok,
      chain: resolvedStyle.chain,
      diagnostics: resolvedStyle.diagnostics,
      properties: resolvedStyle.properties,
    } : null,
    text: rawText ? localizeStringValue(rawText, context.projectIndex?.stringTable, context.language) : null,
    textRaw: rawText,
    language: context.language,
    font: readStringProp(node, "font", null) ?? stylePreview?.font ?? null,
    color,
    alpha,
    renderColor: stateColor,
    renderAlpha,
    previewState: context.previewState,
    state: {
      requested: context.previewState,
      effective: hasRequestedStateColor ? context.previewState : "normal",
      color: stateColor,
      alpha: renderAlpha,
    },
    stateColors,
    images: readImageSlots(node, context.projectIndex, stylePreview),
  };
  context.nodes.push(previewNode);

  for (const [index, child] of node.children.entries()) {
    appendNode(child, {
      ...context,
      parentBox: box,
      path: `${context.path}/${child.name || child.typeClass}:${index}`,
      parentId: context.path,
      depth: context.depth + 1,
    });
  }
}

export function computeBox(node, parentBox, options = {}) {
  const stylePreview = options.stylePreview ?? null;
  const position = readNumberListProp(node, "position", stylePreview?.position ?? [0, 0]);
  const size = readNumberListProp(node, "size", stylePreview?.size ?? [1, 1]);
  const exactPosX = readBooleanProp(node, "hexactpos", false);
  const exactPosY = readBooleanProp(node, "vexactpos", false);
  const exactSizeX = readBooleanProp(node, "hexactsize", false);
  const exactSizeY = readBooleanProp(node, "vexactsize", false);
  const halign = normalizeAlign(readStringProp(node, "halign", stylePreview?.halign ?? "left"));
  const valign = normalizeAlign(readStringProp(node, "valign", stylePreview?.valign ?? "top"));

  const width = exactSizeX ? size[0] : parentBox.width * size[0];
  const height = exactSizeY ? size[1] : parentBox.height * size[1];
  const offsetX = exactPosX ? position[0] : parentBox.width * position[0];
  const offsetY = exactPosY ? position[1] : parentBox.height * position[1];

  return {
    x: alignAxis(parentBox.x, parentBox.width, width, offsetX, halign, "x"),
    y: alignAxis(parentBox.y, parentBox.height, height, offsetY, valign, "y"),
    width,
    height,
    exact: {
      positionX: exactPosX,
      positionY: exactPosY,
      sizeX: exactSizeX,
      sizeY: exactSizeY,
    },
    align: {
      horizontal: halign,
      vertical: valign,
    },
  };
}

function alignAxis(parentStart, parentSize, ownSize, offset, align, axis) {
  if (align === "center") return parentStart + ((parentSize - ownSize) / 2) + offset;
  if ((axis === "x" && align === "right") || (axis === "y" && align === "bottom")) {
    return parentStart + parentSize - ownSize - offset;
  }
  return parentStart + offset;
}

function readImageSlots(node, projectIndex, stylePreview = null) {
  const images = [];
  for (const prop of node.props) {
    const match = prop.key.match(/^image(\d*)$/i);
    if (!match || prop.values.length === 0) continue;
    const ref = prop.values.map((value) => value.value).join(" ");
    const slot = match[1] === "" ? 0 : Number(match[1]);
    images.push({
      slot,
      ref,
      line: prop.line,
      resolved: projectIndex ? resolveImageReference(ref, projectIndex) : null,
    });
  }
  if (images.length === 0 && stylePreview?.image) {
    images.push({
      slot: 0,
      ref: stylePreview.image,
      line: null,
      source: "style",
      resolved: projectIndex ? resolveImageReference(stylePreview.image, projectIndex) : null,
    });
  }
  return images.sort((a, b) => a.slot - b.slot);
}

function readStringProp(node, key, fallback) {
  const prop = findProp(node, key);
  if (!prop || prop.values.length === 0) return fallback;
  return prop.values.map((value) => value.value).join(" ");
}

function readNumberProp(node, key, fallback) {
  const prop = findProp(node, key);
  if (!prop || prop.values.length === 0) return fallback;
  const number = Number(prop.values[0].value);
  return Number.isFinite(number) ? number : fallback;
}

function readNumberListProp(node, key, fallback) {
  const prop = findProp(node, key);
  if (!prop || prop.values.length === 0) return fallback;
  const numbers = prop.values.map((value) => Number(value.value)).filter((value) => Number.isFinite(value));
  return numbers.length > 0 ? numbers : fallback;
}

function readBooleanProp(node, key, fallback) {
  const prop = findProp(node, key);
  if (!prop || prop.values.length === 0) return fallback;
  const value = String(prop.values[0].value).toLowerCase();
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

function readStyleStringProp(resolvedStyle, key, fallback) {
  const prop = findStyleProp(resolvedStyle, key);
  if (!prop || prop.values.length === 0) return fallback;
  return prop.values.join(" ");
}

function readStyleNumberListProp(resolvedStyle, key, fallback) {
  const prop = findStyleProp(resolvedStyle, key);
  if (!prop || prop.values.length === 0) return fallback;
  const numbers = prop.values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  return numbers.length > 0 ? numbers : fallback;
}

function readStyleNumberProp(resolvedStyle, key, fallback) {
  const prop = findStyleProp(resolvedStyle, key);
  if (!prop || prop.values.length === 0) return fallback;
  const number = Number(prop.values[0]);
  return Number.isFinite(number) ? number : fallback;
}

function readStyleBooleanProp(resolvedStyle, key, fallback) {
  const prop = findStyleProp(resolvedStyle, key);
  if (!prop || prop.values.length === 0) return fallback;
  const value = String(prop.values[0]).toLowerCase();
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

function buildStylePreview(resolvedStyle) {
  if (!resolvedStyle?.exists) return null;
  const preview = {
    font: readStyleStringProp(resolvedStyle, "font", null),
    color: readStyleNumberListProp(resolvedStyle, "color", null),
    textColor: readStyleNumberListProp(resolvedStyle, "textcolor", null),
    hoverColor: readStyleNumberListProp(resolvedStyle, "hovercolor", null)
      ?? readStyleNumberListProp(resolvedStyle, "mouseovercolor", null)
      ?? readStyleNumberListProp(resolvedStyle, "focusedcolor", null),
    selectedColor: readStyleNumberListProp(resolvedStyle, "selectedcolor", null),
    disabledColor: readStyleNumberListProp(resolvedStyle, "disabledcolor", null),
    alpha: readStyleNumberProp(resolvedStyle, "alpha", null),
    visible: readStyleBooleanProp(resolvedStyle, "visible", null),
    ignorePointer: readStyleBooleanProp(resolvedStyle, "ignorepointer", null),
    position: readStyleNumberListProp(resolvedStyle, "position", null),
    size: readStyleNumberListProp(resolvedStyle, "size", null),
    halign: readStyleStringProp(resolvedStyle, "halign", null),
    valign: readStyleStringProp(resolvedStyle, "valign", null),
    image: readStyleStringProp(resolvedStyle, "image", null),
  };
  preview.stateColors = {
    normal: preview.textColor ?? preview.color,
    hover: preview.hoverColor,
    selected: preview.selectedColor,
    disabled: preview.disabledColor,
  };
  preview.appliedProperties = Object.entries(preview)
    .filter(([key, value]) => key !== "stateColors" && key !== "appliedProperties" && value !== null && value !== undefined)
    .map(([key]) => key);
  return preview;
}

function findProp(node, key) {
  const normalized = key.toLowerCase();
  return node.props.find((prop) => prop.key.toLowerCase() === normalized) ?? null;
}

function findStyleProp(resolvedStyle, key) {
  const normalized = key.toLowerCase();
  return resolvedStyle?.properties?.find((prop) => prop.key.toLowerCase() === normalized) ?? null;
}

function readStateColorProp(node, keys, fallback) {
  for (const key of keys) {
    const value = readNumberListProp(node, key, null);
    if (value) return value;
  }
  return fallback;
}

function normalizePreviewState(value) {
  const normalized = String(value ?? "normal").trim().toLowerCase();
  if (["hover", "mouseover", "focus", "focused"].includes(normalized)) return "hover";
  if (["selected", "select", "active"].includes(normalized)) return "selected";
  if (["disabled", "disable", "inactive"].includes(normalized)) return "disabled";
  return "normal";
}

function normalizeAlign(value) {
  const normalized = String(value).toLowerCase();
  if (["center", "centre", "middle"].includes(normalized)) return "center";
  if (["right", "bottom"].includes(normalized)) return normalized;
  return ["left", "top"].includes(normalized) ? normalized : normalized;
}
