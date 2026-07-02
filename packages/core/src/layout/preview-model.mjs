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
  const widgetType = normalizeWidgetType(node.typeClass);
  const resolvedStyle = styleName && context.styleRegistry
    ? resolveStyleInheritance(context.styleRegistry, styleName, { widgetType })
    : null;
  const stylePreview = buildStylePreview(resolvedStyle, context.previewState);
  const box = context.boxOverride ?? computeBox(node, context.parentBox, { stylePreview });
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
    priority: readNumberProp(node, "priority", stylePreview?.priority ?? 0),
    style: styleName,
    stylePreview,
    styleRender: buildStyleRender(node, stylePreview, context.projectIndex, context.previewState, widgetType),
    styleResolved: resolvedStyle ? {
      ok: resolvedStyle.ok,
      chain: resolvedStyle.chain,
      diagnostics: resolvedStyle.diagnostics,
      properties: resolvedStyle.properties,
      xmlStyle: resolvedStyle.xmlStyle,
    } : null,
    text: rawText ? localizeStringValue(rawText, context.projectIndex?.stringTable, context.language) : null,
    textRaw: rawText,
    textLayout: buildTextLayout(node),
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

  const childBoxOverrides = buildSpacerChildBoxOverrides(node, box, context);
  for (const [index, child] of node.children.entries()) {
    appendNode(child, {
      ...context,
      parentBox: box,
      boxOverride: childBoxOverrides?.get(child) ?? null,
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
  const exactPosX = readBooleanProp(node, "hexactpos", stylePreview?.exact?.positionX ?? false);
  const exactPosY = readBooleanProp(node, "vexactpos", stylePreview?.exact?.positionY ?? false);
  const exactSizeX = readBooleanProp(node, "hexactsize", stylePreview?.exact?.sizeX ?? false);
  const exactSizeY = readBooleanProp(node, "vexactsize", stylePreview?.exact?.sizeY ?? false);
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

function buildStylePreview(resolvedStyle, previewState = "normal") {
  if (!resolvedStyle?.exists) return null;
  const xmlStyle = resolvedStyle.xmlStyle ?? null;
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
    priority: readStyleNumberProp(resolvedStyle, "priority", null),
    position: readStyleNumberListProp(resolvedStyle, "position", null),
    size: readStyleNumberListProp(resolvedStyle, "size", null),
    exact: {
      positionX: readStyleBooleanProp(resolvedStyle, "hexactpos", null),
      positionY: readStyleBooleanProp(resolvedStyle, "vexactpos", null),
      sizeX: readStyleBooleanProp(resolvedStyle, "hexactsize", null),
      sizeY: readStyleBooleanProp(resolvedStyle, "vexactsize", null),
    },
    halign: readStyleStringProp(resolvedStyle, "halign", null),
    valign: readStyleStringProp(resolvedStyle, "valign", null),
    image: readStyleStringProp(resolvedStyle, "image", null),
    imageSet: readStyleStringProp(resolvedStyle, "imageset", null) ?? xmlStyle?.imageSet ?? null,
    xmlStyle,
    stateItems: selectXmlStyleItems(xmlStyle, previewState),
  };
  preview.stateColors = {
    normal: preview.textColor ?? preview.color,
    hover: preview.hoverColor,
    selected: preview.selectedColor,
    disabled: preview.disabledColor,
  };
  preview.appliedProperties = Object.entries(preview)
    .filter(([key, value]) => key !== "stateColors" && key !== "appliedProperties" && value !== null && value !== undefined)
    .flatMap(([key, value]) => {
      if (key !== "exact") return [key];
      return Object.values(value).some((entry) => entry !== null && entry !== undefined) ? [key] : [];
    })
  return preview;
}

function buildTextLayout(node) {
  return {
    exact: readBooleanProp(node, "exact text", false),
    exactSize: readNumberProp(node, "exact text size", null),
    bold: readBooleanProp(node, "bold text", false),
    halign: normalizeAlign(readStringProp(node, "text halign", "left")),
    valign: normalizeAlign(readStringProp(node, "text valign", "center")),
    wrap: readBooleanProp(node, "wrap", false),
  };
}

function buildSpacerChildBoxOverrides(node, box, context) {
  if (!isSpacerWidget(node) || node.children.length === 0) return null;
  const visibleChildren = node.children.filter((child) => readBooleanProp(child, "visible", true) !== false);
  if (visibleChildren.length === 0) return null;

  const padding = readNumberProp(node, "Padding", 0);
  const margin = readNumberProp(node, "Margin", 0);
  const contentHalign = normalizeAlign(readStringProp(node, "content_halign", "left"));
  const contentValign = normalizeAlign(readStringProp(node, "content_valign", "top"));
  const area = {
    x: box.x + padding,
    y: box.y + padding,
    width: Math.max(0, box.width - (padding * 2)),
    height: Math.max(0, box.height - (padding * 2)),
  };
  const naturalBoxes = visibleChildren.map((child) => computeBox(child, box, {
    stylePreview: getNodeStylePreview(child, context.styleRegistry),
  }));

  let rows = Math.max(0, Math.trunc(readNumberProp(node, "Rows", 0)));
  let columns = Math.max(0, Math.trunc(readNumberProp(node, "Columns", 0)));
  if (rows === 1 && columns === 0) columns = visibleChildren.length;
  if (columns === 1 && rows === 0) rows = visibleChildren.length;
  if (rows === 0 && columns === 0) {
    columns = node.typeClass === "WrapSpacerWidgetClass" ? visibleChildren.length : 1;
    rows = Math.ceil(visibleChildren.length / columns);
  } else if (rows === 0) {
    rows = Math.ceil(visibleChildren.length / columns);
  } else if (columns === 0) {
    columns = Math.ceil(visibleChildren.length / rows);
  }

  const overrides = new Map();
  if (rows === 1) {
    const totalWidth = naturalBoxes.reduce((sum, childBox) => sum + childBox.width, 0) + (margin * Math.max(0, naturalBoxes.length - 1));
    const maxHeight = Math.max(...naturalBoxes.map((childBox) => childBox.height));
    let cursorX = alignContentAxis(area.x, area.width, totalWidth, contentHalign, "x");
    const groupY = alignContentAxis(area.y, area.height, maxHeight, contentValign, "y");
    visibleChildren.forEach((child, index) => {
      const childBox = naturalBoxes[index];
      const height = childBox.exact.sizeY ? childBox.height : area.height;
      overrides.set(child, {
        ...childBox,
        height,
        x: cursorX,
        y: alignContentAxis(groupY, maxHeight, height, contentValign, "y"),
      });
      cursorX += childBox.width + margin;
    });
    return overrides;
  }

  if (columns === 1) {
    const totalHeight = naturalBoxes.reduce((sum, childBox) => sum + childBox.height, 0) + (margin * Math.max(0, naturalBoxes.length - 1));
    const maxWidth = Math.max(...naturalBoxes.map((childBox) => childBox.width));
    const groupX = alignContentAxis(area.x, area.width, maxWidth, contentHalign, "x");
    let cursorY = alignContentAxis(area.y, area.height, totalHeight, contentValign, "y");
    visibleChildren.forEach((child, index) => {
      const childBox = naturalBoxes[index];
      const width = childBox.exact.sizeX ? childBox.width : area.width;
      overrides.set(child, {
        ...childBox,
        width,
        x: alignContentAxis(groupX, maxWidth, width, contentHalign, "x"),
        y: cursorY,
      });
      cursorY += childBox.height + margin;
    });
    return overrides;
  }

  const cellWidth = Math.max(0, (area.width - (margin * Math.max(0, columns - 1))) / columns);
  const cellHeight = Math.max(0, (area.height - (margin * Math.max(0, rows - 1))) / rows);
  visibleChildren.forEach((child, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const childBox = naturalBoxes[index];
    const cell = {
      x: area.x + (column * (cellWidth + margin)),
      y: area.y + (row * (cellHeight + margin)),
      width: cellWidth,
      height: cellHeight,
    };
    overrides.set(child, {
      ...childBox,
      width: childBox.exact.sizeX ? childBox.width : cell.width,
      height: childBox.exact.sizeY ? childBox.height : cell.height,
      x: alignContentAxis(cell.x, cell.width, childBox.exact.sizeX ? childBox.width : cell.width, contentHalign, "x"),
      y: alignContentAxis(cell.y, cell.height, childBox.exact.sizeY ? childBox.height : cell.height, contentValign, "y"),
    });
  });
  return overrides;
}

function isSpacerWidget(node) {
  return node.typeClass === "GridSpacerWidgetClass" || node.typeClass === "WrapSpacerWidgetClass";
}

function getNodeStylePreview(node, styleRegistry) {
  const styleName = readStringProp(node, "style", null);
  const resolvedStyle = styleName && styleRegistry
    ? resolveStyleInheritance(styleRegistry, styleName, { widgetType: normalizeWidgetType(node.typeClass) })
    : null;
  return buildStylePreview(resolvedStyle);
}

function buildStyleRender(node, stylePreview, projectIndex, previewState, widgetType) {
  const imageSet = stylePreview?.imageSet;
  if (!imageSet) return null;
  const checked = readBooleanProp(node, "checked", false)
    || readBooleanProp(node, "checkedvalue", false)
    || readBooleanProp(node, "state", false);
  const selectedItems = [...(stylePreview.stateItems ?? [])];
  if (widgetType === "CheckBoxWidget" && checked) {
    selectedItems.push(...selectXmlStyleItems(stylePreview.xmlStyle, "mark"));
  }
  const items = selectedItems
    .filter((item) => item?.image)
    .map((item, index) => {
      const ref = `set:${imageSet} image:${item.image}`;
      return {
        slot: index,
        source: "style",
        stateName: item.stateName ?? null,
        itemName: item.name ?? null,
        ref,
        line: item.line ?? null,
        resolved: projectIndex ? resolveImageReference(ref, projectIndex) : null,
      };
    });
  if (items.length === 0) return null;
  return {
    widgetType,
    imageSet,
    previewState,
    items,
  };
}

function selectXmlStyleItems(xmlStyle, previewState = "normal") {
  if (!xmlStyle?.states?.length) return [];
  const statesByName = new Map(xmlStyle.states.map((state) => [String(state.name ?? "").toLowerCase(), state]));
  const candidateNames = stateCandidateNames(previewState);
  for (const name of candidateNames) {
    const state = statesByName.get(name);
    if (state?.items?.length) {
      return state.items.map((item) => ({ ...item, stateName: state.name }));
    }
  }
  return [];
}

function stateCandidateNames(previewState) {
  const normalized = normalizePreviewState(previewState);
  if (String(previewState).trim().toLowerCase() === "mark") return ["mark", "normal"];
  if (normalized === "hover") return ["highlight", "focus", "hover", "normal"];
  if (normalized === "selected") return ["pushed", "selected", "focus", "highlight", "normal"];
  if (normalized === "disabled") return ["disabled", "disable", "normal"];
  return ["normal"];
}

function alignContentAxis(start, size, ownSize, align, axis) {
  if (align === "center") return start + ((size - ownSize) / 2);
  if ((axis === "x" && align === "right") || (axis === "y" && align === "bottom")) {
    return start + size - ownSize;
  }
  return start;
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
  const normalized = String(value).trim().toLowerCase().replace(/_ref$/, "");
  if (["center", "centre", "middle"].includes(normalized)) return "center";
  if (["right", "bottom"].includes(normalized)) return normalized;
  return ["left", "top"].includes(normalized) ? normalized : normalized;
}

function normalizeWidgetType(typeClass) {
  const value = String(typeClass ?? "").trim();
  return value ? value.replace(/Class$/i, "") : null;
}
