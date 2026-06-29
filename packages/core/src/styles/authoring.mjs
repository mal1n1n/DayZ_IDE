import { parseStyleFile } from "./registry.mjs";

export function upsertStyleProperty(source, request) {
  const parsed = request.parsed ?? parseStyleFile(source, { filePath: request.filePath ?? null });
  const styleName = requireNonEmptyString(request.styleName, "styleName");
  const key = requireNonEmptyString(request.key, "key");
  const values = normalizeValues(request.values);
  const style = parsed.styles.find((candidate) => candidate.name.toLowerCase() === styleName.toLowerCase());

  if (!style) {
    const typeClass = request.typeClass ?? "StyleClass";
    const block = formatStyleBlock(source, {
      typeClass,
      styleName,
      props: [{ key, values }],
    });
    const prefix = source && !source.endsWith("\n") ? newlineFor(source) : "";
    const separator = source.trim() ? newlineFor(source) : "";
    const text = `${prefix}${separator}${block}${newlineFor(source)}`;
    return {
      ok: true,
      source: `${source}${text}`,
      insertedStyle: true,
      insertedProperty: true,
      edit: {
        type: "style-create",
        start: source.length,
        end: source.length,
        oldText: "",
        newText: text,
      },
      style: {
        name: styleName,
        typeClass,
      },
    };
  }

  const replacement = formatPropertyLine(source, style, key, values);
  const prop = style.props.find((candidate) => candidate.key.toLowerCase() === key.toLowerCase());
  const edit = prop
    ? replaceExistingProperty(source, prop, replacement)
    : insertNewProperty(source, style, replacement);
  return {
    ok: true,
    source: source.slice(0, edit.start) + edit.text + source.slice(edit.end),
    insertedStyle: false,
    insertedProperty: !prop,
    edit: {
      type: prop ? "style-property-update" : "style-property-insert",
      start: edit.start,
      end: edit.end,
      oldText: source.slice(edit.start, edit.end),
      newText: edit.text,
    },
    style: {
      name: style.name,
      typeClass: style.typeClass,
      line: style.line,
    },
  };
}

function formatStyleBlock(source, { typeClass, styleName, props }) {
  const newline = newlineFor(source);
  const lines = [
    `${typeClass} ${formatName(styleName)} {`,
    ...props.map((prop) => ` ${prop.key}${prop.values.length ? ` ${prop.values.map(formatValue).join(" ")}` : ""}`),
    "}",
  ];
  return lines.join(newline);
}

function formatPropertyLine(source, style, key, values) {
  const indent = inferPropertyIndent(source, style);
  return `${indent}${key}${values.length ? ` ${values.map(formatValue).join(" ")}` : ""}`;
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

function insertNewProperty(source, style, replacement) {
  const newline = newlineFor(source);
  const closeLineStart = findLineStart(source, style.bodySpan.end);
  return {
    start: closeLineStart,
    end: closeLineStart,
    text: `${replacement}${newline}`,
  };
}

function inferPropertyIndent(source, style) {
  const firstProp = style.props[0];
  if (firstProp) return source.slice(findLineStart(source, firstProp.span.start), firstProp.span.start);
  const lineStart = findLineStart(source, style.span.start);
  const styleIndent = source.slice(lineStart, style.span.start);
  return `${styleIndent} `;
}

function formatName(name) {
  const text = String(name);
  return /^[A-Za-z_][A-Za-z0-9_./:-]*$/.test(text) ? text : `"${text.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
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

function newlineFor(source) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function findLineStart(source, offset) {
  const lf = source.lastIndexOf("\n", offset - 1);
  return lf < 0 ? 0 : lf + 1;
}

function findLineEnd(source, offset) {
  const lf = source.indexOf("\n", offset);
  return lf < 0 ? source.length : lf;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value;
}
