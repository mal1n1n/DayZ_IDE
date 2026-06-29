import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLayoutPreviewModel,
  parseLayout,
  parseStyleFile,
  resolveStyleInheritance,
  styleFileToJson,
  upsertStyleProperty,
  validateLayoutDocument,
  validateStyleFile,
} from "../src/index.mjs";

test("parseStyleFile extracts style properties with spans", () => {
  const parsed = parseStyleFile(`StyleClass Normal {
 color 1 1 1 1
 font "gui/fonts/Metron-Bold28"
}
`);

  assert.equal(parsed.styles.length, 1);
  assert.equal(parsed.styles[0].name, "Normal");
  assert.equal(parsed.styles[0].props.length, 2);
  assert.deepEqual(parsed.styles[0].props[0].values, ["1", "1", "1", "1"]);
  assert.deepEqual(parsed.styles[0].props[1].values, ["gui/fonts/Metron-Bold28"]);
  assert.ok(parsed.styles[0].span.end > parsed.styles[0].span.start);
});

test("upsertStyleProperty updates and inserts style properties", () => {
  const source = `StyleClass Normal {
 color 1 1 1 1
}
`;
  const updated = upsertStyleProperty(source, {
    styleName: "Normal",
    key: "color",
    values: [0.8, 0.7, 0.6, 1],
  });

  assert.equal(updated.ok, true);
  assert.equal(updated.insertedProperty, false);
  assert.match(updated.source, /color 0\.8 0\.7 0\.6 1/);

  const inserted = upsertStyleProperty(updated.source, {
    styleName: "Normal",
    key: "font",
    values: ["gui/fonts/Metron-Bold28"],
  });
  assert.equal(inserted.insertedProperty, true);
  assert.match(inserted.source, /font gui\/fonts\/Metron-Bold28/);
  assert.equal(parseStyleFile(inserted.source).styles[0].props.length, 2);
});

test("upsertStyleProperty creates a missing style block", () => {
  const created = upsertStyleProperty("", {
    styleName: "PDA Highlight",
    typeClass: "StyleClass",
    key: "color",
    values: [1, 0.5, 0.2, 1],
  });

  assert.equal(created.ok, true);
  assert.equal(created.insertedStyle, true);
  assert.match(created.source, /StyleClass "PDA Highlight" \{/);
  assert.match(created.source, /color 1 0\.5 0\.2 1/);
  const parsed = parseStyleFile(created.source);
  assert.equal(parsed.styles[0].name, "PDA Highlight");
});

test("resolveStyleInheritance merges parent properties and marks inherited sources", () => {
  const parsed = parseStyleFile(`StyleClass Base {
 font gui/fonts/Base28
 color 1 0 0 1
}
StyleClass Child {
 base Base
 color 0 1 0 1
}
`);

  const resolved = resolveStyleInheritance(parsed, "Child");
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.chain.map((style) => style.name), ["Base", "Child"]);
  assert.equal(resolved.properties.find((prop) => prop.key === "font").sourceStyle, "Base");
  assert.equal(resolved.properties.find((prop) => prop.key === "font").inherited, true);
  assert.deepEqual(resolved.properties.find((prop) => prop.key === "color").values, ["0", "1", "0", "1"]);

  const json = styleFileToJson(parsed, { includePreviewDiagnostics: false });
  const child = json.styles.find((style) => style.name === "Child");
  assert.deepEqual(child.parentStyles, ["Base"]);
  assert.equal(child.effectiveProps.length, 2);
});

test("validateStyleFile reports schema problems, duplicate keys, and inheritance errors", () => {
  const parsed = parseStyleFile(`StyleClass A {
 base B
 color 1 nope 0
 color 0 0 0 1
}
StyleClass B {
 base A
 halign sideways
}
StyleClass C {
 base Missing
}
`);
  const diagnostics = validateStyleFile(parsed);
  const codes = diagnostics.map((diagnostic) => diagnostic.code);

  assert.ok(codes.includes("style.schema.too-few-values"));
  assert.ok(codes.includes("style.schema.invalid-number"));
  assert.ok(codes.includes("style.schema.invalid-enum"));
  assert.ok(codes.includes("style.property.duplicate"));
  assert.ok(codes.includes("style.inheritance.cycle"));
  assert.ok(codes.includes("style.inheritance.missing-parent"));
});

test("preview and validation consume inherited style font and color", () => {
  const styles = parseStyleFile(`StyleClass Base {
 font MissingFont
 color 0.2 0.3 0.4 1
}
StyleClass Child {
 base Base
}
`);
  const styleRegistry = registryFromParsed(styles);
  const document = parseLayout(`TextWidgetClass Label {
 style Child
 text "Hello"
 size 0.2 0.1
}
`);

  const model = buildLayoutPreviewModel(document, { styleRegistry });
  assert.equal(model.nodes[0].font, "MissingFont");
  assert.deepEqual(model.nodes[0].color, [0.2, 0.3, 0.4, 1]);
  assert.equal(model.nodes[0].styleResolved.chain.length, 2);

  const diagnostics = validateLayoutDocument(document, {
    styleRegistry,
    fontRegistry: {
      fonts: [{ virtualPath: "known.font" }],
      resolve: () => null,
    },
  });
  assert.equal(diagnostics.find((diagnostic) => diagnostic.code === "layout.font.unresolved").context.style, "Child");
});

test("preview applies style layout, state, image, and color metadata", () => {
  const styles = parseStyleFile(`StyleClass StyledBox {
 position 0.25 0.25
 size 0.5 0.25
 halign center
 valign bottom
 textcolor 0.1 0.2 0.3 1
 hovercolor 0.2 0.5 0.8 1
 selectedcolor 1 0.8 0.2 1
 disabledcolor 0.4 0.4 0.4 1
 alpha 0.5
 visible 0
 ignorepointer 1
 image "gui/data/background.png"
}
`);
  const styleRegistry = registryFromParsed(styles);
  const document = parseLayout(`TextWidgetClass Label {
 style StyledBox
 text "Hello"
}
`);

  const model = buildLayoutPreviewModel(document, {
    width: 100,
    height: 100,
    styleRegistry,
  });
  const node = model.nodes[0];

  assertBoxClose(node.box, { x: 50, y: 50, width: 50, height: 25 });
  assert.equal(node.visible, false);
  assert.equal(node.ignorePointer, true);
  assert.equal(node.alpha, 0.5);
  assert.deepEqual(node.color, [0.1, 0.2, 0.3, 1]);
  assert.deepEqual(node.stateColors.hover, [0.2, 0.5, 0.8, 1]);
  assert.deepEqual(node.stateColors.selected, [1, 0.8, 0.2, 1]);
  assert.deepEqual(node.stateColors.disabled, [0.4, 0.4, 0.4, 1]);
  assert.equal(node.images[0].ref, "gui/data/background.png");
  assert.equal(node.images[0].source, "style");
  assert.ok(node.stylePreview.appliedProperties.includes("position"));
  assert.ok(node.stylePreview.appliedProperties.includes("image"));
});

function registryFromParsed(parsed) {
  const byName = new Map(parsed.styles.map((style) => [style.name.toLowerCase(), style]));
  return {
    byName,
    has(name) {
      return byName.has(String(name).toLowerCase());
    },
    get(name) {
      return byName.get(String(name).toLowerCase()) ?? null;
    },
  };
}

function assertBoxClose(actual, expected) {
  for (const key of ["x", "y", "width", "height"]) {
    assert.equal(Number(actual[key].toFixed(3)), Number(expected[key].toFixed(3)));
  }
}
