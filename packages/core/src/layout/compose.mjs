import { hashSource } from "../history/snapshots.mjs";
import { parseLayout, walkWidgets } from "./parser.mjs";

export function composeLayoutSource(spec, options = {}) {
  const normalized = normalizeLayoutSpec(spec);
  const newline = options.newline === "\r\n" ? "\r\n" : "\n";
  const indentUnit = typeof options.indent === "string" ? options.indent : " ";
  const source = `${normalized.roots.map((root) => formatWidget(root, {
    level: 0,
    indentUnit,
    newline,
  })).join(newline)}${newline}`;
  const document = parseLayout(source, { filePath: options.filePath ?? null });
  const widgets = walkWidgets(document);

  return {
    kind: "LayoutComposeResult",
    ok: document.diagnostics.length === 0,
    source,
    hash: hashSource(source),
    rootCount: document.roots.length,
    widgetCount: widgets.length,
    diagnostics: document.diagnostics,
  };
}

function normalizeLayoutSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("spec must be an object.");
  }

  const roots = Array.isArray(spec.roots)
    ? spec.roots
    : spec.root
      ? [spec.root]
      : [];
  if (roots.length === 0) {
    throw new Error("spec.root or spec.roots must contain at least one widget.");
  }

  return {
    roots: roots.map((widget, index) => normalizeWidgetSpec(widget, `roots[${index}]`)),
  };
}

function normalizeWidgetSpec(widget, path) {
  if (!widget || typeof widget !== "object" || Array.isArray(widget)) {
    throw new Error(`${path} must be a widget object.`);
  }

  const typeClass = requireIdentifierLike(widget.typeClass ?? widget.type, `${path}.typeClass`);
  const name = requireIdentifierLike(widget.name, `${path}.name`);
  const props = normalizeProps(widget.props ?? widget.properties ?? {}, `${path}.props`);
  const childrenInput = widget.children ?? widget.widgets ?? [];
  if (!Array.isArray(childrenInput)) {
    throw new Error(`${path}.children must be an array when provided.`);
  }

  return {
    typeClass,
    name,
    props,
    children: childrenInput.map((child, index) => normalizeWidgetSpec(child, `${path}.children[${index}]`)),
  };
}

function normalizeProps(props, path) {
  if (Array.isArray(props)) {
    return props.map((prop, index) => {
      if (!prop || typeof prop !== "object" || Array.isArray(prop)) {
        throw new Error(`${path}[${index}] must be a property object.`);
      }
      return {
        key: requireIdentifierLike(prop.key, `${path}[${index}].key`),
        values: normalizeValues(prop.values, `${path}[${index}].values`),
      };
    });
  }

  if (!props || typeof props !== "object") {
    throw new Error(`${path} must be an object or array.`);
  }

  return Object.entries(props).map(([key, values]) => ({
    key: requireIdentifierLike(key, `${path}.${key}`),
    values: normalizeValues(values, `${path}.${key}`),
  }));
}

function normalizeValues(values, path) {
  const list = Array.isArray(values) ? values : [values];
  return list.map((value, index) => normalizeValue(value, `${path}[${index}]`));
}

function normalizeValue(value, path) {
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null) return "";
  throw new Error(`${path} must be a string, number, boolean, or null.`);
}

function formatWidget(widget, { level, indentUnit, newline }) {
  const indent = indentUnit.repeat(level);
  const propIndent = indentUnit.repeat(level + 1);
  const childIndent = indentUnit.repeat(level + 1);
  const lines = [
    `${indent}${widget.typeClass} ${widget.name} {`,
    ...widget.props.map((prop) => formatProperty(prop, propIndent)),
  ];

  if (widget.children.length > 0) {
    lines.push(`${childIndent}{`);
    lines.push(...widget.children.map((child) => formatWidget(child, {
      level: level + 2,
      indentUnit,
      newline,
    })));
    lines.push(`${childIndent}}`);
  }

  lines.push(`${indent}}`);
  return lines.join(newline);
}

function formatProperty(prop, indent) {
  return `${indent}${prop.key}${prop.values.length ? ` ${prop.values.map(formatValue).join(" ")}` : ""}`;
}

function formatValue(value) {
  if (typeof value === "number") return String(value);
  const text = String(value);
  if (text === "") return "\"\"";
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return text;
  if (/^[A-Za-z_][A-Za-z0-9_./:-]*$/.test(text) && !text.startsWith("#")) return text;
  return `"${text.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function requireIdentifierLike(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) {
    throw new Error(`${name} must not contain whitespace.`);
  }
  return trimmed;
}
