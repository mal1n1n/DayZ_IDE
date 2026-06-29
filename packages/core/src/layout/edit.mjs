import { parseLayout } from "./parser.mjs";

export function createWidget(source, request) {
  const document = request.document ?? parseLayout(source, { filePath: request.filePath ?? null });
  const parent = findRequestedWidget(document, request.parentWidgetId, request.parentWidgetName);
  const hasParentRequest = Boolean(request.parentWidgetId || request.parentWidgetName);
  if (!parent && hasParentRequest) {
    return { ok: false, reason: "Parent widget not found." };
  }
  if (!parent && request.asRoot !== true) return { ok: false, reason: "Parent widget is required unless asRoot=true." };

  const typeClass = requireNonEmptyString(request.typeClass, "typeClass");
  const name = requireNonEmptyString(request.name, "name");
  const props = normalizeProps(mergeDefaultProps(typeClass, request.props));
  const indent = parent ? inferChildIndent(source, parent) : "";
  const block = formatWidgetBlock({ source, indent, typeClass, name, props });
  const edit = parent
    ? insertChildWidget(source, parent, block)
    : insertRootWidget(source, block);
  const nextSource = source.slice(0, edit.start) + edit.text + source.slice(edit.end);

  return {
    ok: true,
    source: nextSource,
    edit: {
      type: "create-widget",
      start: edit.start,
      end: edit.end,
      oldText: source.slice(edit.start, edit.end),
      newText: edit.text,
    },
    widget: {
      name,
      typeClass,
      parentName: parent?.name ?? null,
    },
  };
}

export function deleteWidget(source, request) {
  const document = request.document ?? parseLayout(source, { filePath: request.filePath ?? null });
  const widget = findRequestedWidget(document, request.widgetId, request.widgetName);
  if (!widget) return { ok: false, reason: "Widget not found." };
  if (isDocumentOnlyRoot(document, widget) && request.allowDeleteLastRoot !== true) {
    return { ok: false, reason: "Refusing to delete the only root widget." };
  }

  const range = fullWidgetLineRange(source, widget);
  const nextSource = source.slice(0, range.start) + source.slice(range.end);
  return {
    ok: true,
    source: nextSource,
    edit: {
      type: "delete-widget",
      start: range.start,
      end: range.end,
      oldText: source.slice(range.start, range.end),
      newText: "",
    },
    widget: {
      name: widget.name,
      typeClass: widget.typeClass,
      line: widget.line,
    },
  };
}

export function insertWidgetSource(source, request) {
  const document = request.document ?? parseLayout(source, { filePath: request.filePath ?? null });
  const parent = findRequestedWidget(document, request.parentWidgetId, request.parentWidgetName);
  const hasParentRequest = Boolean(request.parentWidgetId || request.parentWidgetName);
  if (!parent && hasParentRequest) return { ok: false, reason: "Parent widget not found." };
  if (!parent && request.asRoot !== true) return { ok: false, reason: "Parent widget is required unless asRoot=true." };

  const widgetSource = requireNonEmptyString(request.widgetSource, "widgetSource");
  const widgetDocument = parseLayout(widgetSource, { filePath: request.sourceFilePath ?? null });
  if (widgetDocument.roots.length !== 1 || widgetDocument.diagnostics.length > 0) {
    return { ok: false, reason: "widgetSource must contain exactly one parseable root widget." };
  }

  const indent = parent ? inferChildIndent(source, parent) : "";
  const block = reindentBlock(trimWidgetSource(widgetSource), inferBlockIndent(widgetSource), indent);
  const edit = parent
    ? insertChildWidget(source, parent, block)
    : insertRootWidget(source, block);
  const nextSource = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  const widget = widgetDocument.roots[0];
  return {
    ok: true,
    source: nextSource,
    edit: {
      type: "insert-widget-source",
      start: edit.start,
      end: edit.end,
      oldText: source.slice(edit.start, edit.end),
      newText: edit.text,
    },
    widget: {
      name: widget.name,
      typeClass: widget.typeClass,
      parentName: parent?.name ?? null,
    },
  };
}

export function replaceWidgetSource(source, request) {
  const document = request.document ?? parseLayout(source, { filePath: request.filePath ?? null });
  const widget = findRequestedWidget(document, request.widgetId, request.widgetName);
  if (!widget) return { ok: false, reason: "Widget not found." };

  const widgetSource = requireNonEmptyString(request.widgetSource, "widgetSource");
  const widgetDocument = parseLayout(widgetSource, { filePath: request.sourceFilePath ?? null });
  if (widgetDocument.roots.length !== 1 || widgetDocument.diagnostics.length > 0) {
    return { ok: false, reason: "widgetSource must contain exactly one parseable root widget." };
  }

  const range = fullWidgetLineRange(source, widget);
  const indent = source.slice(findLineStart(source, widget.span.start), widget.span.start);
  const block = reindentBlock(trimWidgetSource(widgetSource), inferBlockIndent(widgetSource), indent);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const oldText = source.slice(range.start, range.end);
  const newText = oldText.endsWith("\n") ? `${block}${newline}` : block;
  const nextSource = source.slice(0, range.start) + newText + source.slice(range.end);
  const replacement = widgetDocument.roots[0];
  return {
    ok: true,
    source: nextSource,
    edit: {
      type: "replace-widget-source",
      start: range.start,
      end: range.end,
      oldText,
      newText,
    },
    widget: {
      name: replacement.name,
      typeClass: replacement.typeClass,
      previousName: widget.name,
      previousTypeClass: widget.typeClass,
      line: widget.line,
    },
  };
}

export function reparentWidget(source, request) {
  const document = request.document ?? parseLayout(source, { filePath: request.filePath ?? null });
  const widget = findRequestedWidget(document, request.widgetId, request.widgetName);
  const parent = findRequestedWidget(document, request.parentWidgetId, request.parentWidgetName);
  if (!widget) return { ok: false, reason: "Widget not found." };
  if (!parent) return { ok: false, reason: "Target parent widget not found." };
  if (widget === parent) return { ok: false, reason: "Cannot reparent a widget into itself." };
  if (containsWidget(widget, parent)) {
    return { ok: false, reason: "Cannot reparent a widget into its own descendant." };
  }

  const deleteRange = fullWidgetLineRange(source, widget);
  const originalBlock = source.slice(deleteRange.start, deleteRange.end).replace(/\r?\n$/, "");
  const fromIndent = source.slice(findLineStart(source, widget.span.start), widget.span.start);
  const toIndent = inferChildIndent(source, parent);
  const movedBlock = reindentBlock(originalBlock, fromIndent, toIndent);
  const insertEdit = insertChildWidget(source, parent, movedBlock);
  const withoutWidget = source.slice(0, deleteRange.start) + source.slice(deleteRange.end);
  const adjustedInsert = insertEdit.start > deleteRange.start
    ? insertEdit.start - (deleteRange.end - deleteRange.start)
    : insertEdit.start;
  const nextSource = withoutWidget.slice(0, adjustedInsert) + insertEdit.text + withoutWidget.slice(adjustedInsert);

  return {
    ok: true,
    source: nextSource,
    edit: {
      type: "reparent-widget",
      widget: widget.name,
      parent: parent.name,
      delete: {
        start: deleteRange.start,
        end: deleteRange.end,
        oldText: source.slice(deleteRange.start, deleteRange.end),
        newText: "",
      },
      insert: {
        start: adjustedInsert,
        end: adjustedInsert,
        oldText: "",
        newText: insertEdit.text,
      },
    },
    widget: {
      name: widget.name,
      typeClass: widget.typeClass,
      line: widget.line,
    },
    parent: {
      name: parent.name,
      typeClass: parent.typeClass,
      line: parent.line,
    },
  };
}

export function removeWidgetProperty(source, request) {
  const document = request.document ?? parseLayout(source, { filePath: request.filePath ?? null });
  const widget = request.widgetId
    ? findWidgetByPreviewId(document, request.widgetId)
    : findWidgetByName(document, request.widgetName);
  if (!widget) {
    return {
      ok: false,
      reason: request.widgetId
        ? `Widget id not found: ${request.widgetId}`
        : `Widget name not found: ${request.widgetName}`,
    };
  }

  const key = requireNonEmptyString(request.key, "key");
  const props = widget.props.filter((prop) => prop.key.toLowerCase() === key.toLowerCase());
  if (props.length === 0) return { ok: false, reason: `Property not found: ${key}` };

  let nextSource = source;
  const edits = props.map((prop) => ({
    start: findLineStart(source, prop.span.start),
    end: findLineEndIncludingNewline(source, prop.span.end),
  })).sort((a, b) => b.start - a.start);
  for (const edit of edits) {
    nextSource = nextSource.slice(0, edit.start) + nextSource.slice(edit.end);
  }

  return {
    ok: true,
    source: nextSource,
    edit: {
      type: "remove-property",
      key,
      count: props.length,
      edits: edits.map((edit) => ({
        start: edit.start,
        end: edit.end,
        oldText: source.slice(edit.start, edit.end),
        newText: "",
      })).reverse(),
    },
    widget: {
      id: request.widgetId ?? null,
      name: widget.name,
      typeClass: widget.typeClass,
      line: widget.line,
    },
  };
}

export function updateWidgetProperty(source, request) {
  const document = request.document ?? parseLayout(source, { filePath: request.filePath ?? null });
  const widget = request.widgetId
    ? findWidgetByPreviewId(document, request.widgetId)
    : findWidgetByName(document, request.widgetName);

  if (!widget) {
    return {
      ok: false,
      reason: request.widgetId
        ? `Widget id not found: ${request.widgetId}`
        : `Widget name not found: ${request.widgetName}`,
    };
  }

  const key = requireNonEmptyString(request.key, "key");
  const values = normalizeValues(request.values);
  const replacement = formatPropertyLine(source, widget, key, values);
  const existing = widget.props.find((prop) => prop.key.toLowerCase() === key.toLowerCase());
  const edit = existing
    ? replaceExistingProperty(source, existing, replacement)
    : insertNewProperty(source, widget, replacement);

  const nextSource = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return {
    ok: true,
    source: nextSource,
    edit: {
      start: edit.start,
      end: edit.end,
      oldText: source.slice(edit.start, edit.end),
      newText: edit.text,
    },
    widget: {
      id: request.widgetId ?? null,
      name: widget.name,
      typeClass: widget.typeClass,
      line: widget.line,
    },
  };
}

export function findWidgetByPreviewId(document, id) {
  const roots = document.roots;

  function visit(node, currentId) {
    if (currentId === id) return node;
    for (const [index, child] of node.children.entries()) {
      const childId = `${currentId}/${child.name || child.typeClass}:${index}`;
      const found = visit(child, childId);
      if (found) return found;
    }
    return null;
  }

  for (const [index, root] of roots.entries()) {
    const rootId = `${root.name || root.typeClass || "root"}:${index}`;
    const found = visit(root, rootId);
    if (found) return found;
  }
  return null;
}

export function findWidgetByName(document, name) {
  const normalized = String(name).toLowerCase();
  const stack = [...document.roots];
  while (stack.length) {
    const node = stack.shift();
    if (node.name.toLowerCase() === normalized) return node;
    stack.unshift(...node.children);
  }
  return null;
}

function findRequestedWidget(document, id, name) {
  if (id) return findWidgetByPreviewId(document, id);
  if (name) return findWidgetByName(document, name);
  return null;
}

function isDocumentOnlyRoot(document, widget) {
  return document.roots.length === 1 && document.roots[0] === widget;
}

function containsWidget(root, candidate) {
  for (const child of root.children) {
    if (child === candidate || containsWidget(child, candidate)) return true;
  }
  return false;
}

function insertChildWidget(source, parent, block) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const childGroup = parent.childGroups[0];
  if (childGroup) {
    const closeLineStart = findLineStart(source, childGroup.span.end - 1);
    return {
      start: closeLineStart,
      end: closeLineStart,
      text: `${block}${newline}`,
    };
  }

  const parentIndent = source.slice(findLineStart(source, parent.span.start), parent.span.start);
  const closeLineStart = findLineStart(source, parent.span.end - 1);
  const groupIndent = `${parentIndent} `;
  return {
    start: closeLineStart,
    end: closeLineStart,
    text: `${groupIndent}{${newline}${block}${newline}${groupIndent}}${newline}`,
  };
}

function insertRootWidget(source, block) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const prefix = source && !source.endsWith("\n") ? newline : "";
  return {
    start: source.length,
    end: source.length,
    text: `${prefix}${block}${newline}`,
  };
}

function formatWidgetBlock({ source, indent, typeClass, name, props }) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const propIndent = `${indent} `;
  const lines = [
    `${indent}${typeClass} ${name} {`,
    ...props.map((prop) => `${propIndent}${prop.key}${prop.values.length ? ` ${prop.values.map(formatValue).join(" ")}` : ""}`),
    `${indent}}`,
  ];
  return lines.join(newline);
}

function normalizeProps(props) {
  if (Array.isArray(props)) {
    return props.map((prop) => ({
      key: requireNonEmptyString(prop.key, "prop.key"),
      values: normalizeValues(prop.values),
    }));
  }
  return Object.entries(props).map(([key, values]) => ({
    key,
    values: normalizeValues(values),
  }));
}

function mergeDefaultProps(typeClass, props) {
  if (props === undefined || props === null) return defaultWidgetProps(typeClass);
  if (Array.isArray(props)) return props;
  return {
    ...defaultWidgetProps(typeClass),
    ...props,
  };
}

function defaultWidgetProps(typeClass) {
  const lower = String(typeClass).toLowerCase();
  if (lower.includes("text")) {
    return {
      position: [0, 0],
      size: [0.2, 0.05],
      text: "New text",
    };
  }
  return {
    position: [0, 0],
    size: [0.1, 0.1],
  };
}

function inferChildIndent(source, parent) {
  const firstChild = parent.children[0];
  if (firstChild) return source.slice(findLineStart(source, firstChild.span.start), firstChild.span.start);
  const parentIndent = source.slice(findLineStart(source, parent.span.start), parent.span.start);
  return `${parentIndent}  `;
}

function fullWidgetLineRange(source, widget) {
  const start = findLineStart(source, widget.span.start);
  return {
    start,
    end: findLineEndIncludingNewline(source, widget.span.end),
  };
}

function reindentBlock(block, fromIndent, toIndent) {
  return String(block).split(/\r?\n/).map((line) => {
    if (!line.trim()) return line;
    if (fromIndent && line.startsWith(fromIndent)) return `${toIndent}${line.slice(fromIndent.length)}`;
    if (!fromIndent) return `${toIndent}${line}`;
    return `${toIndent}${line.trimStart()}`;
  }).join(block.includes("\r\n") ? "\r\n" : "\n");
}

function trimWidgetSource(source) {
  return String(source).replace(/^\s*\r?\n/, "").replace(/\s*$/, "");
}

function inferBlockIndent(source) {
  const match = String(source).match(/^(?:\s*\r?\n)?([ \t]*)\S/);
  return match?.[1] ?? "";
}

function replaceExistingProperty(source, prop, replacement) {
  const lineStart = findLineStart(source, prop.span.start);
  const lineEnd = findLineEnd(source, prop.span.end);
  const trailing = source.slice(prop.span.end, lineEnd);
  return {
    start: lineStart,
    end: lineEnd,
    text: `${replacement}${trailing}`,
  };
}

function insertNewProperty(source, widget, replacement) {
  const insertAt = findFirstBodyLineStart(source, widget);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return {
    start: insertAt,
    end: insertAt,
    text: `${replacement}${newline}`,
  };
}

function formatPropertyLine(source, widget, key, values) {
  const indent = inferPropertyIndent(source, widget);
  return `${indent}${key} ${values.map(formatValue).join(" ")}`.trimEnd();
}

function formatValue(value) {
  if (typeof value === "number") return String(value);
  const text = String(value);
  if (text === "") return "\"\"";
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return text;
  if (/^[A-Za-z_][A-Za-z0-9_./:-]*$/.test(text) && !text.startsWith("#")) return text;
  return `"${text.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function normalizeValues(values) {
  if (Array.isArray(values)) return values;
  if (values === undefined || values === null) return [];
  return [values];
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value;
}

function inferPropertyIndent(source, widget) {
  const firstProp = widget.props[0];
  if (firstProp) return source.slice(findLineStart(source, firstProp.span.start), firstProp.span.start);
  const lineStart = findLineStart(source, widget.span.start);
  const widgetIndent = source.slice(lineStart, widget.span.start);
  return `${widgetIndent} `;
}

function findFirstBodyLineStart(source, widget) {
  const bodyStart = widget.bodySpan?.start ?? widget.span.start;
  const nextLine = source.indexOf("\n", bodyStart);
  if (nextLine < 0) return bodyStart;
  return nextLine + 1;
}

function findLineStart(source, offset) {
  const lf = source.lastIndexOf("\n", offset - 1);
  return lf < 0 ? 0 : lf + 1;
}

function findLineEnd(source, offset) {
  const lf = source.indexOf("\n", offset);
  return lf < 0 ? source.length : lf;
}

function findLineEndIncludingNewline(source, offset) {
  const lf = source.indexOf("\n", offset);
  return lf < 0 ? source.length : lf + 1;
}
