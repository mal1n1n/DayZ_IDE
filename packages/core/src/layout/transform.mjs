import { hashSource } from "../history/snapshots.mjs";
import { buildLayoutPreviewModel } from "./preview-model.mjs";

export const layoutTransformActions = [
  "align-left",
  "align-hcenter",
  "align-right",
  "align-top",
  "align-vcenter",
  "align-bottom",
  "distribute-horizontal",
  "distribute-vertical",
  "translate",
  "resize-group",
];

export function buildLayoutTransformPatch(document, request = {}) {
  const action = normalizeTransformAction(request.action);
  const model = request.model ?? buildLayoutPreviewModel(document, {
    width: request.width,
    height: request.height,
    projectIndex: request.projectIndex,
    styleRegistry: request.styleRegistry,
    language: request.language,
  });
  const requestedIds = normalizeSelection(request.widgetIds ?? request.widgets ?? request.selection);
  const requestedNames = normalizeSelection(request.widgetNames);
  const selection = resolveSelection(model, requestedIds, requestedNames);

  if (selection.missing.length > 0) {
    return {
      ok: false,
      reason: `Widget(s) not found: ${selection.missing.join(", ")}`,
      action,
      diagnostics: selection.missing.map((id) => ({
        code: "layout.transform.widget-not-found",
        severity: "error",
        message: `Widget not found: ${id}`,
        context: { widgetId: id },
      })),
    };
  }
  if (selection.nodes.length === 0) {
    return {
      ok: false,
      reason: "At least one widget is required for layout transform.",
      action,
      diagnostics: [],
    };
  }
  if (action.startsWith("align-") && selection.nodes.length < 2) {
    return {
      ok: false,
      reason: "Alignment requires at least two widgets.",
      action,
      diagnostics: [],
    };
  }
  if (action.startsWith("distribute-") && selection.nodes.length < 3) {
    return {
      ok: false,
      reason: "Distribution requires at least three widgets.",
      action,
      diagnostics: [],
    };
  }
  if (action === "resize-group" && selection.nodes.length < 2) {
    return {
      ok: false,
      reason: "Group resize requires at least two widgets.",
      action,
      diagnostics: [],
    };
  }

  const resizeTarget = action === "resize-group"
    ? normalizeResizeTarget(request, boundsFor(selection.nodes))
    : null;
  if (resizeTarget && !resizeTarget.ok) {
    return {
      ok: false,
      reason: resizeTarget.reason,
      action,
      diagnostics: [],
    };
  }

  const targetBoxes = targetBoxesForAction(selection.nodes, action, {
    ...request,
    resizeTarget: resizeTarget?.box,
  });
  const operations = [];
  for (const node of selection.nodes) {
    const targetBox = targetBoxes.get(node.id);
    if (!targetBox) continue;
    const position = boxToLayoutPosition(node, targetBox);
    const currentPosition = boxToLayoutPosition(node, node.box);
    const size = boxToLayoutSize(node, targetBox);
    const currentSize = boxToLayoutSize(node, node.box);
    const operation = {
      op: "updateBox",
      widgetId: node.id,
      meta: {
        reason: "layout-transform",
        action,
        widgetName: node.name,
      },
    };
    if (!samePair(position, currentPosition)) operation.position = position;
    if (!samePair(size, currentSize)) operation.size = size;
    if (operation.position || operation.size) operations.push(operation);
  }

  return {
    ok: true,
    action,
    selection: selection.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      typeClass: node.typeClass,
      parentId: node.parentId,
    })),
    bounds: boundsFor(selection.nodes),
    operationCount: operations.length,
    patch: {
      kind: "LayoutPatch",
      label: request.label ?? `Layout ${action}`,
      beforeHash: hashSource(document.source ?? ""),
      operations,
      conflicts: [],
      generatedFrom: {
        filePath: document.filePath,
        transform: {
          action,
          widgetIds: selection.nodes.map((node) => node.id),
        },
      },
    },
  };
}

function targetBoxesForAction(nodes, action, request) {
  if (action === "translate") return translateBoxes(nodes, request);
  if (action === "resize-group") return resizeGroupBoxes(nodes, request);
  if (action === "distribute-horizontal") return distributeBoxes(nodes, "x");
  if (action === "distribute-vertical") return distributeBoxes(nodes, "y");

  const bounds = boundsFor(nodes);
  const boxes = new Map();
  for (const node of nodes) {
    const box = { ...node.box };
    if (action === "align-left") box.x = bounds.x;
    if (action === "align-hcenter") box.x = bounds.x + (bounds.width / 2) - (box.width / 2);
    if (action === "align-right") box.x = bounds.x + bounds.width - box.width;
    if (action === "align-top") box.y = bounds.y;
    if (action === "align-vcenter") box.y = bounds.y + (bounds.height / 2) - (box.height / 2);
    if (action === "align-bottom") box.y = bounds.y + bounds.height - box.height;
    boxes.set(node.id, box);
  }
  return boxes;
}

function translateBoxes(nodes, request) {
  const delta = normalizeDelta(request);
  const boxes = new Map();
  for (const node of nodes) {
    boxes.set(node.id, {
      ...node.box,
      x: node.box.x + delta.x,
      y: node.box.y + delta.y,
    });
  }
  return boxes;
}

function resizeGroupBoxes(nodes, request) {
  const sourceBounds = boundsFor(nodes);
  const targetBounds = request.resizeTarget ?? sourceBounds;
  const scaleX = sourceBounds.width > 0 ? targetBounds.width / sourceBounds.width : 1;
  const scaleY = sourceBounds.height > 0 ? targetBounds.height / sourceBounds.height : 1;
  const boxes = new Map();
  for (const node of nodes) {
    boxes.set(node.id, {
      ...node.box,
      x: targetBounds.x + ((node.box.x - sourceBounds.x) * scaleX),
      y: targetBounds.y + ((node.box.y - sourceBounds.y) * scaleY),
      width: Math.max(4, node.box.width * scaleX),
      height: Math.max(4, node.box.height * scaleY),
    });
  }
  return boxes;
}

function distributeBoxes(nodes, axis) {
  const sorted = [...nodes].sort((a, b) => a.box[axis] - b.box[axis]);
  const boxes = new Map(nodes.map((node) => [node.id, { ...node.box }]));
  const sizeKey = axis === "x" ? "width" : "height";
  const bounds = boundsFor(sorted);
  const totalSize = sorted.reduce((sum, node) => sum + node.box[sizeKey], 0);
  const available = (axis === "x" ? bounds.width : bounds.height) - totalSize;
  const gap = available / (sorted.length - 1);
  let cursor = axis === "x" ? bounds.x : bounds.y;
  for (const node of sorted) {
    const box = boxes.get(node.id);
    box[axis] = cursor;
    cursor += node.box[sizeKey] + gap;
  }
  return boxes;
}

function normalizeResizeTarget(request, sourceBounds) {
  const rawBounds = request.targetBounds ?? request.bounds ?? null;
  const targetX = Number(rawBounds?.x ?? rawBounds?.[0] ?? request.targetX ?? sourceBounds.x);
  const targetY = Number(rawBounds?.y ?? rawBounds?.[1] ?? request.targetY ?? sourceBounds.y);
  const targetWidth = Number(
    rawBounds?.width
      ?? rawBounds?.[2]
      ?? request.targetWidth
      ?? request.resizeWidth,
  );
  const targetHeight = Number(
    rawBounds?.height
      ?? rawBounds?.[3]
      ?? request.targetHeight
      ?? request.resizeHeight,
  );
  if (!Number.isFinite(sourceBounds.width) || sourceBounds.width <= 0
    || !Number.isFinite(sourceBounds.height) || sourceBounds.height <= 0) {
    return { ok: false, reason: "Group resize source bounds must be positive." };
  }
  if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) {
    return { ok: false, reason: "Group resize requires targetWidth and targetHeight or targetBounds." };
  }
  if (targetWidth <= 0 || targetHeight <= 0) {
    return { ok: false, reason: "Group resize target bounds must be positive." };
  }
  return {
    ok: true,
    box: {
      x: Number.isFinite(targetX) ? targetX : sourceBounds.x,
      y: Number.isFinite(targetY) ? targetY : sourceBounds.y,
      width: Math.max(4, targetWidth),
      height: Math.max(4, targetHeight),
    },
  };
}

function boxToLayoutPosition(node, box) {
  const parent = node.parentBox ?? { x: 0, y: 0, width: 1, height: 1 };
  const offsetX = inverseAlignOffset({
    start: box.x,
    size: box.width,
    parentStart: parent.x,
    parentSize: parent.width,
    align: node.box.align?.horizontal ?? "left",
  });
  const offsetY = inverseAlignOffset({
    start: box.y,
    size: box.height,
    parentStart: parent.y,
    parentSize: parent.height,
    align: node.box.align?.vertical ?? "top",
  });
  return [
    formatLayoutNumber(node.box.exact?.positionX ? offsetX : offsetX / parent.width),
    formatLayoutNumber(node.box.exact?.positionY ? offsetY : offsetY / parent.height),
  ];
}

function boxToLayoutSize(node, box) {
  const parent = node.parentBox ?? { width: 1, height: 1 };
  return [
    formatLayoutNumber(node.box.exact?.sizeX ? box.width : box.width / parent.width),
    formatLayoutNumber(node.box.exact?.sizeY ? box.height : box.height / parent.height),
  ];
}

function inverseAlignOffset({ start, size, parentStart, parentSize, align }) {
  if (align === "center") return start - (parentStart + ((parentSize - size) / 2));
  if (align === "right" || align === "bottom") return parentStart + parentSize - size - start;
  return start - parentStart;
}

function resolveSelection(model, ids, names) {
  const byId = new Map(model.nodes.map((node) => [node.id, node]));
  const byLowerName = new Map();
  for (const node of model.nodes) {
    const key = node.name.toLowerCase();
    if (!byLowerName.has(key)) byLowerName.set(key, []);
    byLowerName.get(key).push(node);
  }

  const nodes = [];
  const seen = new Set();
  const missing = [];
  for (const id of ids) {
    const node = byId.get(id);
    if (!node) {
      missing.push(id);
      continue;
    }
    if (!seen.has(node.id)) {
      seen.add(node.id);
      nodes.push(node);
    }
  }
  for (const name of names) {
    const matches = byLowerName.get(name.toLowerCase()) ?? [];
    if (matches.length === 0) {
      missing.push(name);
      continue;
    }
    for (const node of matches) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        nodes.push(node);
      }
    }
  }
  return { nodes, missing };
}

function normalizeSelection(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (value === undefined || value === null) return [];
  return String(value).split(/[|,\n]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeDelta(request) {
  const delta = Array.isArray(request.delta) ? request.delta : null;
  const x = Number(request.deltaX ?? request.dx ?? delta?.[0] ?? 0);
  const y = Number(request.deltaY ?? request.dy ?? delta?.[1] ?? 0);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function boundsFor(nodes) {
  const left = Math.min(...nodes.map((node) => node.box.x));
  const top = Math.min(...nodes.map((node) => node.box.y));
  const right = Math.max(...nodes.map((node) => node.box.x + node.box.width));
  const bottom = Math.max(...nodes.map((node) => node.box.y + node.box.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
  };
}

function samePair(a, b) {
  return Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001;
}

function formatLayoutNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(6));
}

function normalizeTransformAction(value) {
  const compact = String(value ?? "").trim().replace(/[-_\s.]/g, "").toLowerCase();
  if (["left", "alignleft"].includes(compact)) return "align-left";
  if (["hcenter", "horizontalcenter", "alignhcenter", "alignhorizontalcenter"].includes(compact)) return "align-hcenter";
  if (["right", "alignright"].includes(compact)) return "align-right";
  if (["top", "aligntop"].includes(compact)) return "align-top";
  if (["vcenter", "verticalcenter", "alignvcenter", "alignverticalcenter"].includes(compact)) return "align-vcenter";
  if (["bottom", "alignbottom"].includes(compact)) return "align-bottom";
  if (["distributehorizontal", "distributeh", "spacehorizontal"].includes(compact)) return "distribute-horizontal";
  if (["distributevertical", "distributev", "spacevertical"].includes(compact)) return "distribute-vertical";
  if (["translate", "move", "groupmove"].includes(compact)) return "translate";
  if (["resize", "resizegroup", "groupsize", "scale", "scalegroup"].includes(compact)) return "resize-group";
  throw new Error(`Unsupported layout transform action: ${value}`);
}
