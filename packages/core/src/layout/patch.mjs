import { hashSource } from "../history/snapshots.mjs";
import { buildLayoutDiffReport } from "./diff.mjs";
import {
  createWidget,
  deleteWidget,
  insertWidgetSource,
  removeWidgetProperty,
  replaceWidgetSource,
  reparentWidget,
  updateWidgetProperty,
} from "./edit.mjs";
import { parseLayout } from "./parser.mjs";

export function generateLayoutPatchFromSources(beforeSource, afterSource, options = {}) {
  return generateLayoutPatch(
    parseLayout(beforeSource, { filePath: options.beforeFilePath ?? null }),
    parseLayout(afterSource, { filePath: options.afterFilePath ?? null }),
    options,
  );
}

export function generateLayoutPatch(beforeDocument, afterDocument, options = {}) {
  const beforeRecords = collectPatchRecords(beforeDocument);
  const afterRecords = collectPatchRecords(afterDocument);
  const matches = matchPatchRecords(beforeRecords, afterRecords);
  const beforeById = new Map(beforeRecords.map((record) => [record.id, record]));
  const afterById = new Map(afterRecords.map((record) => [record.id, record]));
  const matchByBeforeId = new Map(matches.map((match) => [match.before.id, match]));
  const matchByAfterId = new Map(matches.map((match) => [match.after.id, match]));
  const matchedBefore = new Set(matches.map((match) => match.before.id));
  const matchedAfter = new Set(matches.map((match) => match.after.id));
  const removedIds = new Set(beforeRecords.filter((record) => !matchedBefore.has(record.id)).map((record) => record.id));
  const addedIds = new Set(afterRecords.filter((record) => !matchedAfter.has(record.id)).map((record) => record.id));
  const changesByBeforeId = new Map(matches.map((match) => [
    match.before.id,
    directPatchChanges(match.before, match.after),
  ]));
  const replacementIds = new Set(matches
    .filter((match) => {
      const changes = changesByBeforeId.get(match.before.id);
      return match.before.typeClass !== match.after.typeClass
        || match.before.name !== match.after.name
        || changes.requiresReplace;
    })
    .map((match) => match.before.id));
  const topReplacementIds = new Set([...replacementIds]
    .filter((id) => !hasAncestorId(id, replacementIds)));
  const operations = [];
  const conflicts = [];

  const topRemoved = [...removedIds]
    .map((id) => beforeById.get(id))
    .filter((record) => !record.parentPath || !removedIds.has(record.parentPath))
    .filter((record) => !hasReplacedBeforeAncestor(record, topReplacementIds))
    .sort((a, b) => b.depth - a.depth);
  for (const record of topRemoved) {
    operations.push({
      op: "deleteWidget",
      ...targetSelector(record, beforeRecords),
      allowDeleteLastRoot: options.allowDeleteLastRoot === true,
      meta: {
        reason: "removed-widget",
        beforeId: record.id,
      },
    });
  }

  const topAdded = [...addedIds]
    .map((id) => afterById.get(id))
    .filter((record) => !record.parentPath || !addedIds.has(record.parentPath))
    .filter((record) => !hasReplacedAfterAncestor(record, topReplacementIds, matchByAfterId))
    .sort((a, b) => a.depth - b.depth);
  for (const record of topAdded) {
    const parent = record.parentPath ? afterById.get(record.parentPath) : null;
    const parentMatch = parent ? matchByAfterId.get(parent.id) : null;
    if (parent && !parentMatch) {
      conflicts.push(conflict("insert.parent-unmatched", record, "Cannot insert widget under a parent that is not present before the patch."));
      continue;
    }
    operations.push({
      op: "insertWidgetSource",
      ...(parentMatch ? parentSelector(parentMatch.before, beforeRecords) : { asRoot: true }),
      widgetSource: widgetSource(afterDocument, record),
      meta: {
        reason: "added-widget",
        afterId: record.id,
      },
    });
  }

  for (const match of matches) {
    const { before, after } = match;
    if (hasReplacedBeforeAncestor(before, topReplacementIds)) continue;
    const changes = changesByBeforeId.get(before.id);
    if (before.parentPath !== after.parentPath) {
      const afterParent = after.parentPath ? afterById.get(after.parentPath) : null;
      const parentMatch = afterParent ? matchByAfterId.get(afterParent.id) : null;
      if (!afterParent || !parentMatch) {
        conflicts.push(conflict("reparent.target-unmatched", after, "Cannot safely reparent to a root or unmatched added parent."));
      } else {
        operations.push({
          op: "reparentWidget",
          ...targetSelector(before, beforeRecords),
          ...parentSelector(parentMatch.before, beforeRecords),
          meta: {
            reason: "parent-changed",
            beforeId: before.id,
            afterId: after.id,
          },
        });
      }
    }

    if (topReplacementIds.has(before.id)) {
      operations.push({
        op: "replaceWidgetSource",
        ...targetSelector(before, beforeRecords),
        widgetSource: widgetSource(afterDocument, after),
        meta: {
          reason: before.typeClass !== after.typeClass || before.name !== after.name
            ? "identity-changed"
            : "property-conflict-replace",
          beforeId: before.id,
          afterId: after.id,
        },
      });
      continue;
    }

    for (const change of changes.propertyChanges) {
      if (change.kind === "property.removed") {
        operations.push({
          op: "removeProperty",
          ...targetSelector(before, beforeRecords),
          key: change.key,
          meta: {
            reason: "property-removed",
            beforeId: before.id,
            afterId: after.id,
          },
        });
      } else {
        operations.push({
          op: "updateProperty",
          ...targetSelector(before, beforeRecords),
          key: change.key,
          values: change.after[0].values,
          meta: {
            reason: change.kind === "property.added" ? "property-added" : "property-changed",
            beforeId: before.id,
            afterId: after.id,
          },
        });
      }
    }
  }

  return {
    kind: "LayoutPatch",
    label: options.label ?? `Generated layout patch ${new Date().toISOString()}`,
    beforeHash: hashSource(beforeDocument.source ?? ""),
    afterHash: hashSource(afterDocument.source ?? ""),
    operations,
    conflicts,
    generatedFrom: {
      beforeFilePath: beforeDocument.filePath,
      afterFilePath: afterDocument.filePath,
      diff: buildLayoutDiffReport(beforeDocument, afterDocument).summary,
    },
  };
}

export function applyLayoutPatch(source, patch, options = {}) {
  const normalized = normalizeLayoutPatch(patch);
  const beforeHash = hashSource(source);
  const allowHashMismatch = options.allowHashMismatch === true || normalized.allowHashMismatch === true;
  if (normalized.beforeHash && normalized.beforeHash !== beforeHash && !allowHashMismatch) {
    return {
      kind: "LayoutPatchResult",
      ok: false,
      reason: "Patch beforeHash does not match the current source.",
      label: normalized.label,
      beforeHash,
      expectedHash: normalized.beforeHash,
      afterHash: beforeHash,
      operationCount: normalized.operations.length,
      appliedCount: 0,
      operations: [],
      diagnostics: [],
      ...(options.includeSource === true ? { source } : {}),
    };
  }

  let nextSource = source;
  const operationResults = [];

  for (const [index, operation] of normalized.operations.entries()) {
    const operationBeforeHash = hashSource(nextSource);
    const applied = applyPatchOperation(nextSource, operation, options);
    if (!applied.ok) {
      return {
        kind: "LayoutPatchResult",
        ok: false,
        reason: applied.reason,
        label: normalized.label,
        beforeHash,
        expectedHash: normalized.beforeHash ?? null,
        afterHash: operationBeforeHash,
        failedAt: index,
        operationCount: normalized.operations.length,
        appliedCount: operationResults.length,
        operations: [
          ...operationResults,
          {
            index,
            op: operation.op,
            ok: false,
            reason: applied.reason,
            beforeHash: operationBeforeHash,
            afterHash: operationBeforeHash,
          },
        ],
        diagnostics: parseLayout(nextSource, { filePath: options.filePath ?? null }).diagnostics,
        ...(options.includeSource === true ? { source: nextSource } : {}),
      };
    }

    nextSource = applied.source;
    operationResults.push({
      index,
      op: operation.op,
      ok: true,
      beforeHash: operationBeforeHash,
      afterHash: hashSource(nextSource),
      edit: applied.edit,
      widget: applied.widget ?? null,
      parent: applied.parent ?? null,
      updates: applied.updates ?? null,
    });
  }

  const diagnostics = parseLayout(nextSource, { filePath: options.filePath ?? null }).diagnostics;
  const afterHash = hashSource(nextSource);
  return {
    kind: "LayoutPatchResult",
    ok: diagnostics.length === 0 || options.allowDiagnostics === true,
    reason: diagnostics.length === 0 || options.allowDiagnostics === true
      ? null
      : "Patched layout has parser diagnostics.",
    label: normalized.label,
    beforeHash,
    expectedHash: normalized.beforeHash ?? null,
    afterHash,
    changed: beforeHash !== afterHash,
    operationCount: normalized.operations.length,
    appliedCount: operationResults.length,
    operations: operationResults,
    diagnostics,
    ...(options.includeSource === true ? { source: nextSource } : {}),
  };
}

export function resolveLayoutPatchConflicts(patch, options = {}) {
  if (!patch || typeof patch !== "object") throw new Error("Layout patch must be an object.");
  const conflicts = Array.isArray(patch.conflicts) ? patch.conflicts : [];
  const decisions = Array.isArray(options.decisions) ? options.decisions : [];
  const resolvedAt = options.resolvedAt ?? new Date().toISOString();
  const defaultAction = normalizeConflictAction(options.defaultAction ?? "skip");
  const resolved = [];
  const unresolved = [];

  for (const [index, item] of conflicts.entries()) {
    const decision = findConflictDecision(index, item, decisions);
    const action = normalizeConflictAction(decision?.action ?? defaultAction);
    if (action === "unresolved") {
      unresolved.push(item);
      continue;
    }
    resolved.push({
      ...item,
      resolution: {
        action,
        note: decision?.note ?? options.note ?? null,
        resolvedAt,
      },
    });
  }

  const existingResolved = Array.isArray(patch.resolvedConflicts) ? patch.resolvedConflicts : [];
  return {
    ...patch,
    conflicts: unresolved,
    resolvedConflicts: [
      ...existingResolved,
      ...resolved,
    ],
    resolutionSummary: {
      totalConflicts: conflicts.length,
      resolvedConflicts: resolved.length,
      unresolvedConflicts: unresolved.length,
      defaultAction,
    },
  };
}

export function normalizeLayoutPatch(patch) {
  if (!patch || typeof patch !== "object") {
    throw new Error("Layout patch must be an object.");
  }
  const operations = Array.isArray(patch.operations)
    ? patch.operations
    : Array.isArray(patch.ops)
      ? patch.ops
      : null;
  if (!operations) throw new Error("Layout patch requires an operations array.");
  return {
    kind: patch.kind ?? "LayoutPatch",
    label: patch.label ?? null,
    beforeHash: patch.beforeHash ?? patch.expectedHash ?? null,
    allowHashMismatch: patch.allowHashMismatch === true,
    operations: operations.map(normalizePatchOperation),
  };
}

function findConflictDecision(index, conflict, decisions) {
  return decisions.find((decision) => {
    if (!decision || typeof decision !== "object") return false;
    if (decision.index !== undefined && Number(decision.index) === index) return true;
    if (decision.code && decision.code === conflict.code) return true;
    if (decision.widgetId && decision.widgetId === conflict.widget?.id) return true;
    if (decision.widgetName && decision.widgetName === conflict.widget?.name) return true;
    return false;
  }) ?? null;
}

function normalizeConflictAction(value) {
  const normalized = String(value ?? "").trim().replace(/[-_\s]/g, "").toLowerCase();
  if (["skip", "ignore", "omit"].includes(normalized)) return "skip";
  if (["acceptgenerated", "acceptgeneratedoperations", "partial", "acceptpartial"].includes(normalized)) {
    return "acceptGeneratedOperations";
  }
  if (["unresolved", "keep", "keepunresolved"].includes(normalized)) return "unresolved";
  throw new Error(`Unsupported conflict resolution action: ${value}`);
}

function applyPatchOperation(source, operation, options) {
  if (operation.op === "updateProperty") {
    return updateWidgetProperty(source, {
      filePath: options.filePath,
      widgetId: operation.widgetId,
      widgetName: operation.widgetName,
      key: operation.key,
      values: operation.values,
    });
  }
  if (operation.op === "removeProperty") {
    return removeWidgetProperty(source, {
      filePath: options.filePath,
      widgetId: operation.widgetId,
      widgetName: operation.widgetName,
      key: operation.key,
    });
  }
  if (operation.op === "updateBox") {
    return applyBoxOperation(source, operation, options);
  }
  if (operation.op === "insertWidgetSource") {
    return insertWidgetSource(source, {
      filePath: options.filePath,
      parentWidgetId: operation.parentWidgetId,
      parentWidgetName: operation.parentWidgetName,
      asRoot: operation.asRoot === true,
      widgetSource: operation.widgetSource,
    });
  }
  if (operation.op === "replaceWidgetSource") {
    return replaceWidgetSource(source, {
      filePath: options.filePath,
      widgetId: operation.widgetId,
      widgetName: operation.widgetName,
      widgetSource: operation.widgetSource,
    });
  }
  if (operation.op === "createWidget") {
    return createWidget(source, {
      filePath: options.filePath,
      parentWidgetId: operation.parentWidgetId,
      parentWidgetName: operation.parentWidgetName,
      asRoot: operation.asRoot === true,
      typeClass: operation.typeClass,
      name: operation.name,
      props: operation.props,
    });
  }
  if (operation.op === "deleteWidget") {
    return deleteWidget(source, {
      filePath: options.filePath,
      widgetId: operation.widgetId,
      widgetName: operation.widgetName,
      allowDeleteLastRoot: operation.allowDeleteLastRoot === true,
    });
  }
  if (operation.op === "reparentWidget") {
    return reparentWidget(source, {
      filePath: options.filePath,
      widgetId: operation.widgetId,
      widgetName: operation.widgetName,
      parentWidgetId: operation.parentWidgetId,
      parentWidgetName: operation.parentWidgetName,
    });
  }
  return { ok: false, reason: `Unsupported patch operation: ${operation.op}` };
}

function applyBoxOperation(source, operation, options) {
  const updates = [];
  if (Array.isArray(operation.position)) updates.push(["position", operation.position]);
  if (Array.isArray(operation.size)) updates.push(["size", operation.size]);
  if (updates.length === 0) {
    return { ok: false, reason: "updateBox requires position and/or size." };
  }

  let nextSource = source;
  const editResults = [];
  for (const [key, values] of updates) {
    const updated = updateWidgetProperty(nextSource, {
      filePath: options.filePath,
      widgetId: operation.widgetId,
      widgetName: operation.widgetName,
      key,
      values,
    });
    if (!updated.ok) return updated;
    nextSource = updated.source;
    editResults.push({ key, edit: updated.edit });
  }
  return {
    ok: true,
    source: nextSource,
    edit: {
      type: "update-box",
      widgetId: operation.widgetId ?? null,
      widgetName: operation.widgetName ?? null,
      edits: editResults,
    },
    updates: editResults.map((result) => result.key),
  };
}

function normalizePatchOperation(operation) {
  if (!operation || typeof operation !== "object") throw new Error("Patch operation must be an object.");
  const op = normalizeOperationName(operation.op ?? operation.type ?? operation.kind);
  return {
    ...operation,
    op,
  };
}

function normalizeOperationName(value) {
  const normalized = String(value ?? "").trim();
  const compact = normalized.replace(/[-_\s.]/g, "").toLowerCase();
  if (["updateproperty", "setproperty", "property"].includes(compact)) return "updateProperty";
  if (["removeproperty", "deleteproperty", "unsetproperty"].includes(compact)) return "removeProperty";
  if (["updatebox", "setbox", "box"].includes(compact)) return "updateBox";
  if (["insertwidgetsource", "insertwidget", "addwidgetsource"].includes(compact)) return "insertWidgetSource";
  if (["replacewidgetsource", "replacewidget"].includes(compact)) return "replaceWidgetSource";
  if (["createwidget", "create"].includes(compact)) return "createWidget";
  if (["deletewidget", "delete", "removewidget", "remove"].includes(compact)) return "deleteWidget";
  if (["reparentwidget", "reparent", "movewidget", "move"].includes(compact)) return "reparentWidget";
  return normalized;
}

function collectPatchRecords(document) {
  const records = [];

  function visit(node, parent, index, depth, pathParts, ordinalParts) {
    const segment = `${node.name || node.typeClass}:${index}`;
    const ordinalSegment = String(index);
    const path = [...pathParts, segment].join("/");
    const ordinalPath = [...ordinalParts, ordinalSegment].join("/");
    const record = {
      id: path,
      path,
      ordinalPath,
      typeClass: node.typeClass,
      name: node.name,
      depth,
      parentPath: parent?.path ?? null,
      node,
      props: normalizeRecordProps(node.props),
    };
    records.push(record);
    for (const [childIndex, child] of node.children.entries()) {
      visit(child, record, childIndex, depth + 1, [...pathParts, segment], [...ordinalParts, ordinalSegment]);
    }
  }

  for (const [index, root] of document.roots.entries()) visit(root, null, index, 0, [], []);
  return records;
}

function matchPatchRecords(beforeRecords, afterRecords) {
  const matches = [];
  const beforeLeft = new Set(beforeRecords);
  const afterLeft = new Set(afterRecords);

  matchBy((record) => record.path, "path");
  matchBy((record) => `${record.ordinalPath}\0${record.typeClass}`, "ordinal-type", { requireUnique: true });
  matchBy((record) => `${record.typeClass}\0${record.name.toLowerCase()}`, "type-name", { requireUnique: true });
  matchBy((record) => record.name.toLowerCase(), "name", { requireUnique: true });
  return matches;

  function matchBy(keyFn, confidence, options = {}) {
    const beforeIndex = groupBy([...beforeLeft], keyFn);
    const afterIndex = groupBy([...afterLeft], keyFn);
    for (const [key, beforeGroup] of beforeIndex.entries()) {
      const afterGroup = afterIndex.get(key);
      if (!afterGroup) continue;
      if (options.requireUnique && (beforeGroup.length !== 1 || afterGroup.length !== 1)) continue;
      const count = Math.min(beforeGroup.length, afterGroup.length);
      for (let index = 0; index < count; index += 1) {
        const before = beforeGroup[index];
        const after = afterGroup[index];
        if (!beforeLeft.has(before) || !afterLeft.has(after)) continue;
        beforeLeft.delete(before);
        afterLeft.delete(after);
        matches.push({ before, after, confidence });
      }
    }
  }
}

function directPatchChanges(before, after) {
  const propertyChanges = [];
  let requiresReplace = false;
  const keys = [...new Set([...Object.keys(before.props), ...Object.keys(after.props)])].sort();
  for (const key of keys) {
    const beforeProp = before.props[key] ?? null;
    const afterProp = after.props[key] ?? null;
    if (!beforeProp && afterProp) {
      if (afterProp.occurrences.length !== 1) requiresReplace = true;
      propertyChanges.push({
        kind: "property.added",
        key: afterProp.key,
        after: afterProp.occurrences,
      });
      continue;
    }
    if (beforeProp && !afterProp) {
      propertyChanges.push({
        kind: "property.removed",
        key: beforeProp.key,
        before: beforeProp.occurrences,
      });
      continue;
    }
    if (beforeProp && afterProp && propertyFingerprint(beforeProp) !== propertyFingerprint(afterProp)) {
      if (beforeProp.occurrences.length !== 1 || afterProp.occurrences.length !== 1) requiresReplace = true;
      propertyChanges.push({
        kind: "property.changed",
        key: afterProp.key,
        before: beforeProp.occurrences,
        after: afterProp.occurrences,
      });
    }
  }
  return { propertyChanges, requiresReplace };
}

function normalizeRecordProps(props) {
  const out = {};
  for (const prop of props) {
    const normalizedKey = prop.key.toLowerCase();
    out[normalizedKey] ??= { key: prop.key, occurrences: [] };
    out[normalizedKey].occurrences.push({
      key: prop.key,
      values: prop.values.map((value) => String(value.value)),
      raw: prop.raw,
      line: prop.line,
      span: prop.span,
    });
  }
  return out;
}

function targetSelector(record, records) {
  return isUniqueName(record, records)
    ? { widgetName: record.name }
    : { widgetId: record.id };
}

function parentSelector(record, records) {
  return isUniqueName(record, records)
    ? { parentWidgetName: record.name }
    : { parentWidgetId: record.id };
}

function isUniqueName(record, records) {
  const normalized = record.name.toLowerCase();
  return records.filter((candidate) => candidate.name.toLowerCase() === normalized).length === 1;
}

function hasAncestorId(id, ids) {
  for (const candidate of ids) {
    if (candidate !== id && id.startsWith(`${candidate}/`)) return true;
  }
  return false;
}

function hasReplacedBeforeAncestor(record, topReplacementIds) {
  return hasAncestorId(record.id, topReplacementIds);
}

function hasReplacedAfterAncestor(record, topReplacementIds, matchByAfterId) {
  const parts = record.id.split("/");
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const ancestorAfterId = parts.slice(0, index).join("/");
    const ancestorMatch = matchByAfterId.get(ancestorAfterId);
    if (ancestorMatch && topReplacementIds.has(ancestorMatch.before.id)) return true;
  }
  return false;
}

function widgetSource(document, record) {
  const range = fullWidgetLineRange(document.source, record.node);
  return document.source.slice(range.start, range.end);
}

function fullWidgetLineRange(source, widget) {
  const start = findLineStart(source, widget.span.start);
  return {
    start,
    end: findLineEndIncludingNewline(source, widget.span.end),
  };
}

function findLineStart(source, offset) {
  const lf = source.lastIndexOf("\n", offset - 1);
  return lf < 0 ? 0 : lf + 1;
}

function findLineEndIncludingNewline(source, offset) {
  const lf = source.indexOf("\n", offset);
  return lf < 0 ? source.length : lf + 1;
}

function conflict(code, record, message) {
  return {
    code,
    message,
    widget: {
      id: record.id,
      name: record.name,
      typeClass: record.typeClass,
    },
  };
}

function propertyFingerprint(prop) {
  return JSON.stringify(prop.occurrences.map((occurrence) => occurrence.values));
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}
