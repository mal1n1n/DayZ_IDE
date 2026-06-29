import { hashSource } from "../history/snapshots.mjs";
import { parseLayout } from "./parser.mjs";

export function diffLayoutSources(beforeSource, afterSource, options = {}) {
  return buildLayoutDiffReport(
    parseLayout(beforeSource, { filePath: options.beforeFilePath ?? null }),
    parseLayout(afterSource, { filePath: options.afterFilePath ?? null }),
    options,
  );
}

export function buildLayoutDiffReport(beforeDocument, afterDocument, options = {}) {
  const beforeRecords = collectWidgetRecords(beforeDocument);
  const afterRecords = collectWidgetRecords(afterDocument);
  const matches = matchWidgetRecords(beforeRecords, afterRecords);
  const matchedBefore = new Set(matches.map((match) => match.before.id));
  const matchedAfter = new Set(matches.map((match) => match.after.id));
  const addedWidgets = afterRecords
    .filter((record) => !matchedAfter.has(record.id))
    .map((record) => describeRecord(record));
  const removedWidgets = beforeRecords
    .filter((record) => !matchedBefore.has(record.id))
    .map((record) => describeRecord(record));
  const changedWidgets = [];
  let propertyChangeCount = 0;
  let typeChangeCount = 0;
  let nameChangeCount = 0;
  let parentChangeCount = 0;

  for (const { before, after, confidence } of matches) {
    const changes = [];
    if (before.typeClass !== after.typeClass) {
      typeChangeCount += 1;
      changes.push({
        kind: "widget.type.changed",
        before: before.typeClass,
        after: after.typeClass,
      });
    }
    if (before.name !== after.name) {
      nameChangeCount += 1;
      changes.push({
        kind: "widget.name.changed",
        before: before.name,
        after: after.name,
      });
    }
    if (before.parentPath !== after.parentPath) {
      parentChangeCount += 1;
      changes.push({
        kind: "widget.parent.changed",
        before: before.parent ? describeRecord(before.parent) : null,
        after: after.parent ? describeRecord(after.parent) : null,
      });
    }

    const propertyChanges = diffProperties(before.props, after.props);
    propertyChangeCount += propertyChanges.length;
    changes.push(...propertyChanges);

    if (changes.length > 0) {
      changedWidgets.push({
        before: describeRecord(before),
        after: describeRecord(after),
        confidence,
        changes,
      });
    }
  }

  const totalChanges = addedWidgets.length
    + removedWidgets.length
    + typeChangeCount
    + nameChangeCount
    + parentChangeCount
    + propertyChangeCount;
  const diagnostics = [
    ...beforeDocument.diagnostics.map((diagnostic) => ({ side: "before", ...diagnostic })),
    ...afterDocument.diagnostics.map((diagnostic) => ({ side: "after", ...diagnostic })),
  ];

  return {
    kind: "LayoutDiffReport",
    passed: totalChanges === 0 && diagnostics.length === 0,
    before: describeDocument(beforeDocument, beforeRecords),
    after: describeDocument(afterDocument, afterRecords),
    summary: {
      matchedWidgets: matches.length,
      addedWidgets: addedWidgets.length,
      removedWidgets: removedWidgets.length,
      changedWidgets: changedWidgets.length,
      typeChanges: typeChangeCount,
      nameChanges: nameChangeCount,
      parentChanges: parentChangeCount,
      propertyChanges: propertyChangeCount,
      diagnostics: diagnostics.length,
      totalChanges,
    },
    addedWidgets,
    removedWidgets,
    changedWidgets,
    diagnostics,
    ...(options.includeUnchanged === true
      ? { unchangedWidgets: matches.filter((match) => !changedWidgets.some((changed) => changed.before.id === match.before.id)).map((match) => describeRecord(match.before)) }
      : {}),
  };
}

function collectWidgetRecords(document) {
  const records = [];
  const byPath = new Map();

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
      parent,
      parentPath: parent?.path ?? null,
      line: node.line,
      column: node.column,
      span: node.span,
      props: normalizeProperties(node.props),
    };
    records.push(record);
    byPath.set(path, record);

    for (const [childIndex, child] of node.children.entries()) {
      visit(child, record, childIndex, depth + 1, [...pathParts, segment], [...ordinalParts, ordinalSegment]);
    }
  }

  for (const [index, root] of document.roots.entries()) {
    visit(root, null, index, 0, [], []);
  }

  return records.map((record) => ({
    ...record,
    parent: record.parentPath ? byPath.get(record.parentPath) ?? null : null,
  }));
}

function matchWidgetRecords(beforeRecords, afterRecords) {
  const matches = [];
  const beforeLeft = new Set(beforeRecords);
  const afterLeft = new Set(afterRecords);

  matchBy((record) => record.path, "path");
  matchBy(
    (record) => `${record.ordinalPath}\0${record.typeClass}`,
    "ordinal-type",
    { requireUnique: true },
  );
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

function diffProperties(beforeProps, afterProps) {
  const changes = [];
  const keys = [...new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)])].sort();
  for (const key of keys) {
    const before = beforeProps[key] ?? null;
    const after = afterProps[key] ?? null;
    if (!before) {
      changes.push({
        kind: "property.added",
        key: after.key,
        after: after.occurrences,
      });
      continue;
    }
    if (!after) {
      changes.push({
        kind: "property.removed",
        key: before.key,
        before: before.occurrences,
      });
      continue;
    }
    if (propertyFingerprint(before) !== propertyFingerprint(after)) {
      changes.push({
        kind: "property.changed",
        key: after.key,
        before: before.occurrences,
        after: after.occurrences,
      });
    }
  }
  return changes;
}

function normalizeProperties(props) {
  const out = {};
  for (const prop of props) {
    const normalizedKey = prop.key.toLowerCase();
    out[normalizedKey] ??= {
      key: prop.key,
      occurrences: [],
    };
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

function describeDocument(document, records) {
  return {
    filePath: document.filePath,
    hash: hashSource(document.source ?? ""),
    widgetCount: records.length,
    diagnostics: document.diagnostics.length,
  };
}

function describeRecord(record) {
  return {
    id: record.id,
    path: record.path,
    ordinalPath: record.ordinalPath,
    typeClass: record.typeClass,
    name: record.name,
    parentId: record.parentPath,
    depth: record.depth,
    line: record.line,
    column: record.column,
    span: record.span,
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
