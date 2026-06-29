export function buildGeometryDiffReport(previewModel, engineDump, options = {}) {
  const tolerancePx = positiveNumber(options.tolerancePx, 1);
  const previewNodes = Array.isArray(previewModel?.nodes) ? previewModel.nodes : [];
  const engineNodes = normalizeEngineNodes(engineDump);
  const previewIndex = buildPreviewIndex(previewNodes);
  const matchedPreviewIds = new Set();
  const matches = [];
  const mismatches = [];
  const missingInPreview = [];

  for (const engineNode of engineNodes) {
    const previewNode = findPreviewMatch(engineNode, previewIndex);
    if (!previewNode) {
      missingInPreview.push(engineNodeSummary(engineNode));
      continue;
    }

    matchedPreviewIds.add(previewNode.id);
    const boxDelta = diffBox(previewNode.box, engineNode.box);
    const typeMismatch = Boolean(engineNode.typeClass && previewNode.typeClass !== engineNode.typeClass);
    const maxDelta = Math.max(...Object.values(boxDelta));
    const match = {
      id: previewNode.id,
      name: previewNode.name,
      typeClass: previewNode.typeClass,
      engineId: engineNode.id,
      enginePath: engineNode.path,
      previewBox: roundBox(previewNode.box),
      engineBox: roundBox(engineNode.box),
      delta: boxDelta,
      maxDelta,
      typeMismatch,
      passed: maxDelta <= tolerancePx && !typeMismatch,
    };
    matches.push(match);
    if (!match.passed) mismatches.push(match);
  }

  const missingInEngine = previewNodes
    .filter((node) => !matchedPreviewIds.has(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      typeClass: node.typeClass,
      box: roundBox(node.box),
    }));
  const maxDelta = matches.reduce((max, match) => Math.max(max, match.maxDelta), 0);

  return {
    kind: "DzuiGeometryDiffReport",
    tolerancePx,
    passed: mismatches.length === 0 && missingInEngine.length === 0 && missingInPreview.length === 0,
    preview: {
      filePath: previewModel?.filePath ?? null,
      viewport: previewModel?.viewport ?? null,
      count: previewNodes.length,
    },
    engine: {
      kind: engineDump?.kind ?? null,
      viewport: engineDump?.viewport ?? null,
      count: engineNodes.length,
    },
    summary: {
      matched: matches.length,
      mismatches: mismatches.length,
      missingInEngine: missingInEngine.length,
      missingInPreview: missingInPreview.length,
      maxDelta,
    },
    matches,
    mismatches,
    missingInEngine,
    missingInPreview,
  };
}

export function normalizeEngineNodes(engineDump) {
  const nodes = Array.isArray(engineDump)
    ? engineDump
    : Array.isArray(engineDump?.widgets)
      ? engineDump.widgets
      : Array.isArray(engineDump?.nodes)
        ? engineDump.nodes
        : [];
  return nodes.map((node, index) => ({
    id: optionalString(node.id),
    path: optionalString(node.path ?? node.widgetPath),
    name: optionalString(node.name ?? node.widgetName) ?? `engine:${index}`,
    typeClass: optionalString(node.typeClass ?? node.type),
    box: normalizeBox(node.box ?? node),
    raw: node,
  }));
}

function buildPreviewIndex(nodes) {
  const byId = new Map();
  const byName = new Map();
  const duplicates = new Set();
  for (const node of nodes) {
    byId.set(node.id, node);
    const name = String(node.name).toLowerCase();
    if (byName.has(name)) duplicates.add(name);
    else byName.set(name, node);
  }
  for (const duplicate of duplicates) byName.delete(duplicate);
  return { byId, byName };
}

function findPreviewMatch(engineNode, index) {
  if (engineNode.id && index.byId.has(engineNode.id)) return index.byId.get(engineNode.id);
  if (engineNode.path && index.byId.has(engineNode.path)) return index.byId.get(engineNode.path);
  const name = String(engineNode.name).toLowerCase();
  return index.byName.get(name) ?? null;
}

function normalizeBox(value) {
  return {
    x: numberOrZero(value.x ?? value.left),
    y: numberOrZero(value.y ?? value.top),
    width: numberOrZero(value.width ?? value.w),
    height: numberOrZero(value.height ?? value.h),
  };
}

function diffBox(previewBox, engineBox) {
  return {
    x: round(Math.abs(numberOrZero(previewBox.x) - numberOrZero(engineBox.x))),
    y: round(Math.abs(numberOrZero(previewBox.y) - numberOrZero(engineBox.y))),
    width: round(Math.abs(numberOrZero(previewBox.width) - numberOrZero(engineBox.width))),
    height: round(Math.abs(numberOrZero(previewBox.height) - numberOrZero(engineBox.height))),
  };
}

function roundBox(box) {
  return {
    x: round(numberOrZero(box.x)),
    y: round(numberOrZero(box.y)),
    width: round(numberOrZero(box.width)),
    height: round(numberOrZero(box.height)),
  };
}

function engineNodeSummary(node) {
  return {
    id: node.id,
    path: node.path,
    name: node.name,
    typeClass: node.typeClass,
    box: roundBox(node.box),
  };
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value) {
  return Number(numberOrZero(value).toFixed(3));
}
