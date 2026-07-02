import fs from "node:fs";
import path from "node:path";

import { relativeVirtual } from "../project/path-utils.mjs";

const inheritanceKeys = new Set(["base", "parent", "extends", "inherit"]);

const stylePropertySchemas = [
  {
    key: "base",
    type: "style-ref",
    minValues: 1,
    maxValues: null,
    role: "inheritance",
    previewSupport: "metadata",
    description: "Inherited parent style name(s).",
  },
  {
    key: "parent",
    type: "style-ref",
    minValues: 1,
    maxValues: null,
    role: "inheritance",
    previewSupport: "metadata",
    description: "Inherited parent style name(s).",
  },
  {
    key: "extends",
    type: "style-ref",
    minValues: 1,
    maxValues: null,
    role: "inheritance",
    previewSupport: "metadata",
    description: "Inherited parent style name(s).",
  },
  {
    key: "inherit",
    type: "style-ref",
    minValues: 1,
    maxValues: null,
    role: "inheritance",
    previewSupport: "metadata",
    description: "Inherited parent style name(s).",
  },
  {
    key: "font",
    type: "font-ref",
    minValues: 1,
    maxValues: null,
    previewSupport: "applied",
    description: "Font reference used by text widgets.",
  },
  {
    key: "color",
    type: "rgba",
    minValues: 4,
    maxValues: 4,
    previewSupport: "applied",
    description: "RGBA color.",
  },
  {
    key: "textcolor",
    type: "rgba",
    minValues: 4,
    maxValues: 4,
    previewSupport: "applied",
    description: "Text RGBA color.",
  },
  {
    key: "hovercolor",
    type: "rgba",
    minValues: 4,
    maxValues: 4,
    previewSupport: "metadata",
    description: "Hover-state RGBA color.",
  },
  {
    key: "selectedcolor",
    type: "rgba",
    minValues: 4,
    maxValues: 4,
    previewSupport: "metadata",
    description: "Selected-state RGBA color.",
  },
  {
    key: "disabledcolor",
    type: "rgba",
    minValues: 4,
    maxValues: 4,
    previewSupport: "metadata",
    description: "Disabled-state RGBA color.",
  },
  {
    key: "alpha",
    type: "number",
    minValues: 1,
    maxValues: 1,
    previewSupport: "applied",
    description: "Opacity multiplier.",
  },
  {
    key: "size",
    type: "number-pair",
    minValues: 2,
    maxValues: 2,
    previewSupport: "applied",
    description: "Width and height values.",
  },
  {
    key: "position",
    type: "number-pair",
    minValues: 2,
    maxValues: 2,
    previewSupport: "applied",
    description: "X and Y position values.",
  },
  {
    key: "halign",
    type: "enum",
    values: ["left", "center", "right"],
    minValues: 1,
    maxValues: 1,
    previewSupport: "applied",
    description: "Horizontal alignment.",
  },
  {
    key: "valign",
    type: "enum",
    values: ["top", "center", "bottom"],
    minValues: 1,
    maxValues: 1,
    previewSupport: "applied",
    description: "Vertical alignment.",
  },
  {
    key: "visible",
    type: "boolean",
    minValues: 1,
    maxValues: 1,
    previewSupport: "applied",
    description: "Visibility flag.",
  },
  {
    key: "ignorepointer",
    type: "boolean",
    minValues: 1,
    maxValues: 1,
    previewSupport: "applied",
    description: "Pointer-hit testing flag.",
  },
  {
    key: "image",
    type: "asset-ref",
    minValues: 1,
    maxValues: null,
    previewSupport: "applied",
    description: "Image or imageset reference.",
  },
  {
    key: "imageset",
    type: "imageset-ref",
    minValues: 1,
    maxValues: 1,
    previewSupport: "applied",
    description: "Workbench widget style ImageSet reference.",
  },
  {
    key: "stylecolor",
    type: "raw-values",
    minValues: 1,
    maxValues: 1,
    previewSupport: "metadata",
    description: "Workbench widget style packed color value.",
  },
];

const schemaByKey = new Map(stylePropertySchemas.map((schema) => [schema.key, schema]));

export function parseStyleFile(content, options = {}) {
  const styles = [];
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*StyleClass|StyleClass|[A-Za-z_][A-Za-z0-9_]*)\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_./:-]*))\s*\{/g;

  for (const match of content.matchAll(pattern)) {
    const name = match[2] ?? match[3];
    if (!name) continue;
    const openBrace = content.indexOf("{", (match.index ?? 0) + match[0].length - 1);
    const closeBrace = findMatchingBrace(content, openBrace);
    const bodyStart = openBrace >= 0 ? openBrace + 1 : match.index + match[0].length;
    const bodyEnd = closeBrace >= 0 ? closeBrace : bodyStart;
    styles.push({
      name,
      typeClass: match[1],
      line: lineForOffset(content, match.index ?? 0),
      span: {
        start: match.index ?? 0,
        end: closeBrace >= 0 ? closeBrace + 1 : bodyEnd,
      },
      bodySpan: {
        start: bodyStart,
        end: bodyEnd,
      },
      props: parseStyleProps(content, bodyStart, bodyEnd),
    });
  }
  styles.push(...parseXmlStyleFile(content));

  return {
    filePath: options.filePath ?? null,
    virtualPath: options.virtualPath ?? null,
    styles,
  };
}

function parseXmlStyleFile(content) {
  const styles = [];
  const widgetPattern = /<Widget\b([^>]*)>([\s\S]*?)<\/Widget>/gi;
  for (const widgetMatch of content.matchAll(widgetPattern)) {
    const widgetAttrs = parseXmlAttrs(widgetMatch[1] ?? "");
    const widgetType = widgetAttrs.Name ?? widgetAttrs.name ?? null;
    const widgetBody = widgetMatch[2] ?? "";
    const widgetBodyStart = (widgetMatch.index ?? 0) + widgetMatch[0].indexOf(widgetBody);
    const stylePattern = /<Style\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Style>)/gi;
    for (const styleMatch of widgetBody.matchAll(stylePattern)) {
      const styleAttrs = parseXmlAttrs(styleMatch[1] ?? "");
      const name = styleAttrs.Name ?? styleAttrs.name ?? null;
      if (!name) continue;
      const styleBody = styleMatch[2] ?? "";
      const styleStart = widgetBodyStart + (styleMatch.index ?? 0);
      const bodyStart = styleBody
        ? widgetBodyStart + (styleMatch.index ?? 0) + styleMatch[0].indexOf(styleBody)
        : styleStart + styleMatch[0].length;
      const bodyEnd = styleBody ? bodyStart + styleBody.length : bodyStart;
      const xmlStyle = {
        widgetType,
        imageSet: styleAttrs.ImageSet ?? styleAttrs.imageset ?? null,
        font: styleAttrs.Font ?? styleAttrs.font ?? null,
        color: styleAttrs.Color ?? styleAttrs.color ?? null,
        attrs: styleAttrs,
        states: parseXmlStyleStates(styleBody, content, bodyStart),
      };
      styles.push({
        name,
        typeClass: "XmlWidgetStyle",
        widgetType,
        line: lineForOffset(content, styleStart),
        span: {
          start: styleStart,
          end: styleStart + styleMatch[0].length,
        },
        bodySpan: {
          start: bodyStart,
          end: bodyEnd,
        },
        props: xmlStyleProps(xmlStyle, content, styleStart),
        xmlStyle,
      });
    }
  }
  return styles;
}

function parseXmlStyleStates(styleBody, fullContent, bodyStart) {
  const states = [];
  const statePattern = /<State\b([^>]*?)(?:\/>|>([\s\S]*?)<\/State>)/gi;
  for (const stateMatch of styleBody.matchAll(statePattern)) {
    const stateAttrs = parseXmlAttrs(stateMatch[1] ?? "");
    const stateName = stateAttrs.Name ?? stateAttrs.name ?? "Normal";
    const stateBody = stateMatch[2] ?? "";
    const stateStart = bodyStart + (stateMatch.index ?? 0);
    const items = [];
    const itemPattern = /<Item\b([^>]*?)(?:\/>|>)/gi;
    for (const itemMatch of stateBody.matchAll(itemPattern)) {
      const attrs = parseXmlAttrs(itemMatch[1] ?? "");
      const itemName = attrs.Name ?? attrs.name ?? null;
      const image = attrs.Image ?? attrs.image ?? null;
      if (!itemName && !image) continue;
      const itemStart = stateStart + stateMatch[0].indexOf(stateBody) + (itemMatch.index ?? 0);
      items.push({
        name: itemName,
        image,
        attrs,
        line: lineForOffset(fullContent, itemStart),
        span: {
          start: itemStart,
          end: itemStart + itemMatch[0].length,
        },
      });
    }
    states.push({
      name: stateName,
      attrs: stateAttrs,
      items,
      line: lineForOffset(fullContent, stateStart),
      span: {
        start: stateStart,
        end: stateStart + stateMatch[0].length,
      },
    });
  }
  return states;
}

function xmlStyleProps(xmlStyle, content, styleStart) {
  const props = [];
  if (xmlStyle.font) {
    props.push(xmlStyleProp("font", [xmlStyle.font], content, styleStart));
  }
  if (xmlStyle.imageSet) {
    props.push(xmlStyleProp("imageset", [xmlStyle.imageSet], content, styleStart));
  }
  if (xmlStyle.color !== null && xmlStyle.color !== undefined && xmlStyle.color !== "") {
    props.push(xmlStyleProp("stylecolor", [xmlStyle.color], content, styleStart));
  }
  return props;
}

function xmlStyleProp(key, values, content, styleStart) {
  return {
    key,
    values,
    raw: `${key} ${values.join(" ")}`,
    line: lineForOffset(content, styleStart),
    span: { start: styleStart, end: styleStart },
  };
}

function parseXmlAttrs(text) {
  const attrs = {};
  const pattern = /([A-Za-z_][A-Za-z0-9_:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/g;
  for (const match of text.matchAll(pattern)) {
    attrs[match[1]] = unescapeXmlAttr(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function unescapeXmlAttr(value) {
  return String(value)
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseStyleProps(content, bodyStart, bodyEnd) {
  const props = [];
  const body = content.slice(bodyStart, bodyEnd);
  const linePattern = /^([ \t]*)([A-Za-z_][A-Za-z0-9_./:-]*)(?:[ \t]+([^\r\n{}]+?))?[ \t]*(?:\/\/.*)?$/gm;
  for (const match of body.matchAll(linePattern)) {
    const key = match[2];
    const valuesText = (match[3] ?? "").trim();
    if (!key) continue;
    const start = bodyStart + (match.index ?? 0) + match[1].length;
    const end = bodyStart + (match.index ?? 0) + match[0].length;
    props.push({
      key,
      values: parseValues(valuesText),
      raw: content.slice(start, end),
      line: lineForOffset(content, start),
      span: { start, end },
    });
  }
  return props;
}

function parseValues(text) {
  const values = [];
  const pattern = /"((?:\\.|[^"\\])*)"|(\S+)/g;
  for (const match of text.matchAll(pattern)) {
    values.push(unescapeValue(match[1] ?? match[2] ?? ""));
  }
  return values;
}

function unescapeValue(value) {
  return String(value).replace(/\\(["\\])/g, "$1");
}

function findMatchingBrace(content, openBrace) {
  if (openBrace < 0) return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openBrace; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function buildStyleRegistry(root, files, options = {}) {
  const filesByPath = [];
  const byName = new Map();
  const byWidgetAndName = new Map();

  for (const external of options.externalRegistries ?? []) {
    for (const parsed of external?.files ?? []) {
      filesByPath.push(parsed);
      for (const style of parsed.styles ?? []) {
        registerStyle(byName, byWidgetAndName, {
          ...style,
          filePath: style.filePath ?? parsed.filePath ?? null,
          virtualPath: style.virtualPath ?? parsed.virtualPath ?? null,
        });
      }
    }
  }

  for (const filePath of files.filter((candidate) => path.extname(candidate).toLowerCase() === ".styles")) {
    const parsed = parseStyleFile(fs.readFileSync(filePath, "utf8"), {
      filePath,
      virtualPath: relativeVirtual(root, filePath),
    });
    filesByPath.push(parsed);
    for (const style of parsed.styles) {
      registerStyle(byName, byWidgetAndName, {
        ...style,
        filePath,
        virtualPath: parsed.virtualPath,
      });
    }
  }

  const registry = {
    files: filesByPath,
    byName,
    byWidgetAndName,
    diagnostics: [],
    diagnosticCount: 0,
    has(name, lookup = {}) {
      return Boolean(this.get(name, lookup));
    },
    get(name, lookup = {}) {
      const widgetType = typeof lookup === "string" ? lookup : lookup?.widgetType;
      const exact = widgetType ? byWidgetAndName.get(styleLookupKey(widgetType, name)) : null;
      return exact ?? byName.get(normalizeStyleName(name)) ?? null;
    },
  };
  registry.diagnostics = filesByPath.flatMap((parsed) => validateStyleFile(parsed, { registry }));
  registry.diagnosticCount = registry.diagnostics.length;
  return registry;
}

export function listStylePropertySchemas() {
  return stylePropertySchemas.map((schema) => ({ ...schema, values: schema.values ? [...schema.values] : undefined }));
}

export function schemaForStyleProperty(key) {
  const normalized = normalizeStyleKey(key);
  const exact = schemaByKey.get(normalized);
  if (exact) return cloneSchema(exact);
  if (normalized.endsWith("color")) {
    return {
      key: String(key),
      type: "rgba",
      minValues: 4,
      maxValues: 4,
      previewSupport: "partial",
      inferred: true,
      description: "Inferred RGBA color property.",
    };
  }
  if (normalized.includes("font")) {
    return {
      key: String(key),
      type: "font-ref",
      minValues: 1,
      maxValues: null,
      previewSupport: "partial",
      inferred: true,
      description: "Inferred font reference property.",
    };
  }
  return {
    key: String(key),
    type: "raw-values",
    minValues: 0,
    maxValues: null,
    previewSupport: "unknown",
    known: false,
    description: "Unclassified style property.",
  };
}

export function getStyleParentNames(style) {
  return getStyleParentRefs(style).map((ref) => ref.name);
}

export function resolveStyleInheritance(registryOrParsed, styleName, options = {}) {
  const registry = normalizeStyleRegistry(registryOrParsed);
  const diagnostics = [];
  const chain = [];
  const active = [];
  const visited = new Set();
  const requested = String(styleName ?? "").trim();
  const requestedWidgetType = normalizeWidgetType(options.widgetType);

  function visit(name, referrer = null, refProp = null, widgetType = requestedWidgetType) {
    const normalized = normalizeStyleName(name);
    if (!normalized) return;
    const lookupKey = `${normalizeWidgetType(widgetType) ?? ""}:${normalized}`;
    const activeIndex = active.indexOf(lookupKey);
    if (activeIndex >= 0) {
      const cycle = [...active.slice(activeIndex), lookupKey]
        .map((candidate) => candidate.split(":").pop());
      diagnostics.push(makeStyleDiagnostic(registry.get(name, { widgetType }) ?? registry.get(referrer, { widgetType }), refProp, {
        code: "style.inheritance.cycle",
        severity: "error",
        message: `Style inheritance cycle detected: ${cycle.join(" -> ")}.`,
        context: {
          style: referrer ?? name,
          parent: name,
          cycle,
        },
      }));
      return;
    }
    if (visited.has(lookupKey)) return;

    const style = registry.get(name, { widgetType });
    if (!style) {
      diagnostics.push(makeStyleDiagnostic(registry.get(referrer, { widgetType }), refProp, {
        code: "style.inheritance.missing-parent",
        severity: "error",
        message: `Style "${referrer}" inherits missing style "${name}".`,
        context: {
          style: referrer,
          parent: name,
        },
      }));
      return;
    }

    visited.add(lookupKey);
    active.push(lookupKey);
    for (const parent of getStyleParentRefs(style)) {
      visit(parent.name, style.name, parent.prop, style.widgetType ?? widgetType);
    }
    active.pop();
    chain.push(style);
  }

  visit(requested);

  const sourceStyle = registry.get(requested, { widgetType: requestedWidgetType });
  const byProperty = new Map();
  for (const style of chain) {
    for (const prop of style.props ?? []) {
      if (isInheritanceKey(prop.key)) continue;
      byProperty.set(normalizeStyleKey(prop.key), {
        key: prop.key,
        values: [...prop.values],
        raw: prop.raw,
        line: prop.line,
        span: prop.span,
        sourceStyle: style.name,
        sourceFile: style.filePath ?? null,
        inherited: normalizeStyleName(style.name) !== normalizeStyleName(requested),
        schema: schemaForStyleProperty(prop.key),
      });
    }
  }

  return {
    styleName: requested,
    exists: Boolean(sourceStyle),
    ok: Boolean(sourceStyle) && !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    chain: chain.map((style) => ({
      name: style.name,
      typeClass: style.typeClass,
      widgetType: style.widgetType ?? null,
      line: style.line,
      filePath: style.filePath ?? null,
      virtualPath: style.virtualPath ?? null,
    })),
    properties: [...byProperty.values()],
    xmlStyle: mergeXmlStyleChain(chain),
    diagnostics,
  };
}

export function validateStyleFile(parsed, options = {}) {
  const registry = normalizeStyleRegistry(options.registry ?? parsed);
  const diagnostics = [];

  for (const style of parsed.styles ?? []) {
    diagnostics.push(...validateDuplicateStyleProperties(style, parsed));
    for (const prop of style.props ?? []) {
      diagnostics.push(...validateStyleProperty(style, prop, parsed, options));
    }
    diagnostics.push(...resolveStyleInheritance(registry, style.name, { widgetType: style.widgetType }).diagnostics);
  }

  return diagnostics;
}

export function styleFileToJson(parsed, options = {}) {
  const registry = normalizeStyleRegistry(options.registry ?? parsed);
  const diagnostics = validateStyleFile(parsed, {
    registry,
    includePreviewDiagnostics: options.includePreviewDiagnostics !== false,
  });
  const diagnosticsByStyle = new Map();
  for (const diagnostic of diagnostics) {
    const style = diagnostic.context?.style;
    if (!style) continue;
    const key = normalizeStyleName(style);
    if (!diagnosticsByStyle.has(key)) diagnosticsByStyle.set(key, []);
    diagnosticsByStyle.get(key).push(diagnostic);
  }

  return {
    ...parsed,
    styles: (parsed.styles ?? []).map((style) => {
      const resolved = resolveStyleInheritance(registry, style.name, { widgetType: style.widgetType });
      return {
        ...style,
        parentStyles: getStyleParentNames(style),
        effectiveProps: resolved.properties,
        inheritanceChain: resolved.chain,
        diagnostics: diagnosticsByStyle.get(normalizeStyleName(style.name)) ?? [],
      };
    }),
    diagnostics,
    diagnosticCount: diagnostics.length,
    propertySchemas: listStylePropertySchemas(),
  };
}

function lineForOffset(content, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content[index] === "\n") line += 1;
  }
  return line;
}

function validateDuplicateStyleProperties(style, parsed) {
  const byKey = new Map();
  for (const prop of style.props ?? []) {
    const key = normalizeStyleKey(prop.key);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(prop);
  }
  return [...byKey.entries()].flatMap(([, props]) => {
    if (props.length <= 1) return [];
    return props.slice(1).map((prop) => makeStyleDiagnostic(withParsedFile(style, parsed), prop, {
      code: "style.property.duplicate",
      severity: "warning",
      message: `Style "${style.name}" defines "${prop.key}" more than once; the last value wins in dzui previews.`,
      context: {
        style: style.name,
        property: prop.key,
        firstLine: props[0].line,
      },
    }));
  });
}

function validateStyleProperty(style, prop, parsed, options) {
  const diagnostics = [];
  const schema = schemaForStyleProperty(prop.key);
  const values = prop.values ?? [];

  if (values.length < schema.minValues) {
    diagnostics.push(makeStyleDiagnostic(withParsedFile(style, parsed), prop, {
      code: "style.schema.too-few-values",
      severity: "error",
      message: `Style "${style.name}" property "${prop.key}" expects at least ${schema.minValues} value(s).`,
      context: {
        style: style.name,
        property: prop.key,
        expected: schema.minValues,
        actual: values.length,
      },
    }));
  }
  if (schema.maxValues !== null && values.length > schema.maxValues) {
    diagnostics.push(makeStyleDiagnostic(withParsedFile(style, parsed), prop, {
      code: "style.schema.too-many-values",
      severity: "warning",
      message: `Style "${style.name}" property "${prop.key}" expects ${schema.maxValues} value(s).`,
      context: {
        style: style.name,
        property: prop.key,
        expected: schema.maxValues,
        actual: values.length,
      },
    }));
  }

  if (["rgba", "number", "number-pair"].includes(schema.type)) {
    const invalid = values.filter((value) => !Number.isFinite(Number(value)));
    if (invalid.length > 0) {
      diagnostics.push(makeStyleDiagnostic(withParsedFile(style, parsed), prop, {
        code: "style.schema.invalid-number",
        severity: "error",
        message: `Style "${style.name}" property "${prop.key}" contains non-numeric value(s): ${invalid.join(" ")}.`,
        context: {
          style: style.name,
          property: prop.key,
          invalid,
        },
      }));
    }
  }

  if (schema.type === "enum") {
    const allowed = new Set((schema.values ?? []).map((value) => value.toLowerCase()));
    const invalid = values.filter((value) => !allowed.has(String(value).toLowerCase()));
    if (invalid.length > 0) {
      diagnostics.push(makeStyleDiagnostic(withParsedFile(style, parsed), prop, {
        code: "style.schema.invalid-enum",
        severity: "warning",
        message: `Style "${style.name}" property "${prop.key}" uses unsupported value(s): ${invalid.join(" ")}.`,
        context: {
          style: style.name,
          property: prop.key,
          invalid,
          allowed: [...allowed],
        },
      }));
    }
  }

  if (schema.type === "boolean") {
    const invalid = values.filter((value) => !["0", "1", "true", "false"].includes(String(value).toLowerCase()));
    if (invalid.length > 0) {
      diagnostics.push(makeStyleDiagnostic(withParsedFile(style, parsed), prop, {
        code: "style.schema.invalid-boolean",
        severity: "warning",
        message: `Style "${style.name}" property "${prop.key}" expects 0/1 or true/false.`,
        context: {
          style: style.name,
          property: prop.key,
          invalid,
        },
      }));
    }
  }

  if (
    options.includePreviewDiagnostics
    && schema.previewSupport === "not-applied"
    && !isInheritanceKey(prop.key)
  ) {
    diagnostics.push(makeStyleDiagnostic(withParsedFile(style, parsed), prop, {
      code: "style.preview.not-applied",
      severity: "info",
      message: `Style property "${prop.key}" is parsed and editable, but is not yet applied by the dzui canvas preview.`,
      context: {
        style: style.name,
        property: prop.key,
        previewSupport: schema.previewSupport,
      },
    }));
  }

  return diagnostics;
}

function getStyleParentRefs(style) {
  const refs = [];
  for (const prop of style?.props ?? []) {
    if (!isInheritanceKey(prop.key)) continue;
    for (const value of prop.values ?? []) {
      const name = String(value).trim().replace(/,$/, "");
      if (name) refs.push({ name, prop });
    }
  }
  return refs;
}

function isInheritanceKey(key) {
  return inheritanceKeys.has(normalizeStyleKey(key));
}

function normalizeStyleRegistry(registryOrParsed) {
  if (registryOrParsed?.get && registryOrParsed?.has) return registryOrParsed;
  const styles = Array.isArray(registryOrParsed) ? registryOrParsed : registryOrParsed?.styles ?? [];
  const parsedFilePath = Array.isArray(registryOrParsed) ? null : registryOrParsed?.filePath ?? null;
  const parsedVirtualPath = Array.isArray(registryOrParsed) ? null : registryOrParsed?.virtualPath ?? null;
  const byName = new Map();
  const byWidgetAndName = new Map();
  for (const style of styles) {
    registerStyle(byName, byWidgetAndName, {
      ...style,
      filePath: style.filePath ?? parsedFilePath,
      virtualPath: style.virtualPath ?? parsedVirtualPath,
    });
  }
  return {
    byName,
    byWidgetAndName,
    has(name, lookup = {}) {
      return Boolean(this.get(name, lookup));
    },
    get(name, lookup = {}) {
      const widgetType = typeof lookup === "string" ? lookup : lookup?.widgetType;
      return (widgetType ? byWidgetAndName.get(styleLookupKey(widgetType, name)) : null)
        ?? byName.get(normalizeStyleName(name))
        ?? null;
    },
  };
}

function registerStyle(byName, byWidgetAndName, style) {
  byName.set(normalizeStyleName(style.name), style);
  if (style.widgetType) {
    byWidgetAndName.set(styleLookupKey(style.widgetType, style.name), style);
  }
}

function mergeXmlStyleChain(chain) {
  const xmlStyles = chain.map((style) => style.xmlStyle).filter(Boolean);
  if (xmlStyles.length === 0) return null;
  const merged = {
    widgetType: xmlStyles.at(-1).widgetType ?? null,
    imageSet: null,
    font: null,
    color: null,
    states: [],
  };
  const stateByName = new Map();
  for (const xmlStyle of xmlStyles) {
    merged.widgetType = xmlStyle.widgetType ?? merged.widgetType;
    merged.imageSet = xmlStyle.imageSet ?? merged.imageSet;
    merged.font = xmlStyle.font || merged.font;
    merged.color = xmlStyle.color ?? merged.color;
    for (const state of xmlStyle.states ?? []) {
      const key = normalizeStyleName(state.name);
      if (!stateByName.has(key)) {
        stateByName.set(key, { ...state, items: [] });
      }
      const target = stateByName.get(key);
      const itemsByName = new Map(target.items.map((item) => [normalizeStyleName(item.name ?? item.image), item]));
      for (const item of state.items ?? []) {
        itemsByName.set(normalizeStyleName(item.name ?? item.image), item);
      }
      target.items = [...itemsByName.values()];
    }
  }
  merged.states = [...stateByName.values()];
  return merged;
}

function makeStyleDiagnostic(style, prop, { code, severity, message, context }) {
  return {
    code,
    severity,
    message,
    filePath: style?.filePath ?? null,
    virtualPath: style?.virtualPath ?? null,
    line: prop?.line ?? style?.line ?? 1,
    column: 1,
    span: prop?.span ?? style?.span ?? null,
    context,
  };
}

function withParsedFile(style, parsed) {
  return {
    ...style,
    filePath: style.filePath ?? parsed.filePath ?? null,
    virtualPath: style.virtualPath ?? parsed.virtualPath ?? null,
  };
}

function cloneSchema(schema) {
  return {
    ...schema,
    values: schema.values ? [...schema.values] : undefined,
  };
}

function normalizeStyleKey(key) {
  return String(key ?? "").trim().toLowerCase();
}

function normalizeStyleName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function normalizeWidgetType(widgetType) {
  const value = String(widgetType ?? "").trim();
  return value ? value.replace(/Class$/i, "") : null;
}

function styleLookupKey(widgetType, styleName) {
  return `${normalizeWidgetType(widgetType) ?? ""}:${normalizeStyleName(styleName)}`;
}
