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

test("parseStyleFile extracts Workbench XML widget styles with state items", () => {
  const parsed = parseStyleFile(`<WidgetStyles>
 <Widget Name="ButtonWidget">
  <Style Name="MGS_button2" ImageSet="elements_img" Font="gui/fonts/metron.font" Color="0xFFFFFFFF">
   <State Name="Normal">
    <Item Name="LeftTop" Image="4LeftTop" />
    <Item Name="Center" Image="4Center" />
   </State>
  </Style>
 </Widget>
 <Widget Name="CheckBoxWidget">
  <Style Name="Default" ImageSet="checkbox_gui">
   <State Name="Normal">
    <Item Name="CheckBox" Image="cb" />
   </State>
  </Style>
 </Widget>
</WidgetStyles>`);

  assert.equal(parsed.styles.length, 2);
  const button = parsed.styles.find((style) => style.widgetType === "ButtonWidget");
  assert.equal(button.name, "MGS_button2");
  assert.equal(button.props.find((prop) => prop.key === "imageset").values[0], "elements_img");
  assert.equal(button.xmlStyle.states[0].items[1].image, "4Center");
});

test("preview resolves XML style by widget type and emits style render refs", () => {
  const styles = parseStyleFile(`<WidgetStyles>
 <Widget Name="ButtonWidget">
  <Style Name="Default" ImageSet="button_set">
   <State Name="Normal">
    <Item Name="LeftTop" Image="btn_lt" />
    <Item Name="Center" Image="btn_c" />
   </State>
  </Style>
 </Widget>
 <Widget Name="CheckBoxWidget">
  <Style Name="Default" ImageSet="checkbox_set">
   <State Name="Normal">
    <Item Name="CheckBox" Image="cb" />
   </State>
  </Style>
 </Widget>
</WidgetStyles>`);
  const styleRegistry = registryFromParsed(styles);
  const document = parseLayout(`PanelWidgetClass Root {
 {
  ButtonWidgetClass Action {
   style Default
  }
  CheckBoxWidgetClass Toggle {
   style Default
  }
 }
}`);

  const model = buildLayoutPreviewModel(document, { styleRegistry });
  const button = model.nodes.find((node) => node.name === "Action");
  const checkbox = model.nodes.find((node) => node.name === "Toggle");

  assert.equal(button.styleRender.imageSet, "button_set");
  assert.deepEqual(button.styleRender.items.map((item) => item.ref), [
    "set:button_set image:btn_lt",
    "set:button_set image:btn_c",
  ]);
  assert.equal(checkbox.styleRender.imageSet, "checkbox_set");
  assert.equal(checkbox.styleRender.items[0].ref, "set:checkbox_set image:cb");
});

test("preview consumes style exact layout flags and priority", () => {
  const styles = parseStyleFile(`StyleClass PixelBox {
 position 10 20
 size 30 40
 hexactpos 1
 vexactpos 1
 hexactsize 1
 vexactsize 1
 priority 7
}
`);
  const styleRegistry = registryFromParsed(styles);
  const document = parseLayout(`PanelWidgetClass Box {
 style PixelBox
}
`);

  const model = buildLayoutPreviewModel(document, {
    width: 100,
    height: 100,
    styleRegistry,
  });
  const node = model.nodes[0];

  assertBoxClose(node.box, { x: 10, y: 20, width: 30, height: 40 });
  assert.equal(node.box.exact.positionX, true);
  assert.equal(node.box.exact.positionY, true);
  assert.equal(node.box.exact.sizeX, true);
  assert.equal(node.box.exact.sizeY, true);
  assert.equal(node.priority, 7);
  assert.ok(node.stylePreview.appliedProperties.includes("exact"));
});

function registryFromParsed(parsed) {
  const byName = new Map(parsed.styles.map((style) => [style.name.toLowerCase(), style]));
  const byWidgetAndName = new Map(parsed.styles
    .filter((style) => style.widgetType)
    .map((style) => [`${style.widgetType.toLowerCase()}:${style.name.toLowerCase()}`, style]));
  return {
    byName,
    byWidgetAndName,
    has(name, lookup = {}) {
      return Boolean(this.get(name, lookup));
    },
    get(name, lookup = {}) {
      const widgetType = typeof lookup === "string" ? lookup : lookup?.widgetType;
      return (widgetType ? byWidgetAndName.get(`${String(widgetType).replace(/Class$/i, "").toLowerCase()}:${String(name).toLowerCase()}`) : null)
        ?? byName.get(String(name).toLowerCase())
        ?? null;
    },
  };
}

function assertBoxClose(actual, expected) {
  for (const key of ["x", "y", "width", "height"]) {
    assert.equal(Number(actual[key].toFixed(3)), Number(expected[key].toFixed(3)));
  }
}
