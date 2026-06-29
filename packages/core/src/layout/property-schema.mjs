const commonProperties = [
  { key: "position", label: "Position", type: "numberPair", category: "Layout", units: "relative-or-px", axes: ["x", "y"], defaultValues: [0, 0] },
  { key: "size", label: "Size", type: "numberPair", category: "Layout", units: "relative-or-px", axes: ["w", "h"], defaultValues: [1, 1] },
  { key: "hexactpos", label: "Exact X", type: "boolean", category: "Layout", defaultValues: [0] },
  { key: "vexactpos", label: "Exact Y", type: "boolean", category: "Layout", defaultValues: [0] },
  { key: "hexactsize", label: "Exact W", type: "boolean", category: "Layout", defaultValues: [0] },
  { key: "vexactsize", label: "Exact H", type: "boolean", category: "Layout", defaultValues: [0] },
  { key: "halign", label: "H Align", type: "enum", category: "Layout", options: ["left", "center", "right"], defaultValues: ["left"] },
  { key: "valign", label: "V Align", type: "enum", category: "Layout", options: ["top", "center", "bottom"], defaultValues: ["top"] },
  { key: "visible", label: "Visible", type: "boolean", category: "State", defaultValues: [1] },
  { key: "ignorepointer", label: "Ignore Pointer", type: "boolean", category: "State", defaultValues: [0] },
  { key: "priority", label: "Priority", type: "number", category: "State", defaultValues: [0] },
  { key: "style", label: "Style", type: "string", category: "Style" },
  { key: "font", label: "Font", type: "string", category: "Style" },
  { key: "color", label: "Color", type: "color", category: "Style", defaultValues: [1, 1, 1, 1] },
];

const textProperties = [
  { key: "text", label: "Text", type: "string", category: "Content" },
];

const imageProperties = [
  imageSchemaForKey("image0"),
];

const explicitTypes = new Map([
  ...commonProperties,
  ...textProperties,
  ...imageProperties,
].map((schema) => [schema.key, schema]));

export function describeWidgetProperties(node) {
  const existing = new Map(node.props.map((prop) => [prop.key.toLowerCase(), prop]));
  const descriptors = [];
  const seen = new Set();

  for (const schema of schemasForWidget(node)) {
    descriptors.push(describeProperty(schema, existing.get(schema.key), false));
    seen.add(schema.key);
  }

  for (const prop of node.props) {
    const key = prop.key.toLowerCase();
    if (seen.has(key)) continue;
    const schema = inferPropertySchema(prop);
    descriptors.push(describeProperty(schema, prop, true));
    seen.add(key);
  }

  return descriptors;
}

export function describeBatchWidgetProperties(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const descriptorSets = nodes.map((node) => describeWidgetProperties(node));
  const commonKeys = new Set(descriptorSets[0].map((descriptor) => descriptor.key.toLowerCase()));
  for (const descriptors of descriptorSets.slice(1)) {
    const keys = new Set(descriptors.map((descriptor) => descriptor.key.toLowerCase()));
    for (const key of [...commonKeys]) {
      if (!keys.has(key)) commonKeys.delete(key);
    }
  }

  return descriptorSets[0]
    .filter((descriptor) => commonKeys.has(descriptor.key.toLowerCase()))
    .map((descriptor) => {
      const matches = descriptorSets.map((descriptors) => (
        descriptors.find((item) => item.key.toLowerCase() === descriptor.key.toLowerCase())
      ));
      const signatures = matches.map(propertySignature);
      const mixed = signatures.some((signature) => signature !== signatures[0]);
      return {
        ...descriptor,
        batch: true,
        selectedCount: nodes.length,
        mixed,
        valuesByWidget: matches.map((item, index) => ({
          widgetId: nodes[index].id ?? null,
          widgetName: nodes[index].name ?? null,
          values: item.values,
          effectiveValues: item.effectiveValues,
          exists: item.exists,
        })),
      };
    });
}

export function schemaForProperty(key) {
  const normalized = String(key).toLowerCase();
  if (/^image\d*$/i.test(normalized)) {
    return imageSchemaForKey(normalized);
  }
  return explicitTypes.get(normalized) ?? {
    key: normalized,
    label: toLabel(normalized),
    type: "string",
    category: "Raw",
  };
}

function schemasForWidget(node) {
  const lowerType = node.typeClass.toLowerCase();
  const schemas = [...commonProperties];
  if (lowerType.includes("text") || hasProp(node, "text")) schemas.push(...textProperties);
  if (lowerType.includes("image") || node.props.some((prop) => /^image\d*$/i.test(prop.key))) {
    schemas.push(...imageProperties);
  }
  return schemas;
}

function describeProperty(schema, prop, rawOnly) {
  const values = prop?.values.map((value) => value.value) ?? [];
  return {
    ...schema,
    values,
    effectiveValues: values.length ? values : (schema.defaultValues ?? []),
    valueText: values.join(" "),
    exists: Boolean(prop),
    line: prop?.line ?? null,
    raw: prop?.raw ?? null,
    rawOnly,
  };
}

function propertySignature(descriptor) {
  const values = descriptor.effectiveValues?.length ? descriptor.effectiveValues : descriptor.values;
  return values.map((value) => String(value)).join("\u001f");
}

function inferPropertySchema(prop) {
  const normalized = prop.key.toLowerCase();
  if (/^image\d*$/i.test(normalized)) {
    return imageSchemaForKey(prop.key);
  }
  if (explicitTypes.has(normalized)) return { ...explicitTypes.get(normalized), key: prop.key };
  if (prop.values.length > 1 && prop.values.every((value) => Number.isFinite(Number(value.value)))) {
    return { key: prop.key, label: toLabel(prop.key), type: "numberList", category: "Raw" };
  }
  return { key: prop.key, label: toLabel(prop.key), type: "string", category: "Raw" };
}

function hasProp(node, key) {
  const normalized = key.toLowerCase();
  return node.props.some((prop) => prop.key.toLowerCase() === normalized);
}

function imageLabel(key) {
  const slot = String(key).match(/\d+$/)?.[0] ?? "0";
  return `Image ${slot}`;
}

function imageSchemaForKey(key) {
  const slot = Number(String(key).match(/\d+$/)?.[0] ?? 0);
  return {
    key,
    label: imageLabel(key),
    type: "imageRef",
    category: "Content",
    slot,
  };
}

function toLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());
}
