import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLayoutPreviewModel,
  describeBatchWidgetProperties,
  describeWidgetProperties,
  parseLayout,
} from "../src/index.mjs";

test("describeWidgetProperties adds typed common and widget-specific controls", () => {
  const document = parseLayout(`FrameWidgetClass Root {
 size 1 1
 visible 1
 {
  ImageWidgetClass Logo {
   image0 "gui/data/logo.png"
  }
  TextWidgetClass Title {
   text "#STR_TITLE"
   color 1 0.5 0.25 0.75
  }
 }
}`);
  const logo = document.roots[0].children[0];
  const title = document.roots[0].children[1];
  const logoProperties = describeWidgetProperties(logo);
  const titleProperties = describeWidgetProperties(title);

  assert.equal(logoProperties.find((prop) => prop.key === "size").type, "numberPair");
  assert.equal(logoProperties.find((prop) => prop.key === "visible").type, "boolean");
  assert.equal(logoProperties.find((prop) => prop.key === "image0").type, "imageRef");
  assert.equal(logoProperties.find((prop) => prop.key === "image0").slot, 0);
  assert.equal(titleProperties.find((prop) => prop.key === "color").type, "color");
  assert.deepEqual(titleProperties.find((prop) => prop.key === "color").values, ["1", "0.5", "0.25", "0.75"]);
  assert.equal(titleProperties.find((prop) => prop.key === "text").type, "string");
});

test("buildLayoutPreviewModel includes typed property descriptors", () => {
  const document = parseLayout(`TextWidgetClass Label {
 position 0.1 0.2
 size 0.3 0.4
 text "Hello"
}`);
  const model = buildLayoutPreviewModel(document, { width: 1000, height: 500 });
  const node = model.nodes[0];

  assert.equal(node.typedProperties.find((prop) => prop.key === "position").type, "numberPair");
  assert.deepEqual(node.typedProperties.find((prop) => prop.key === "position").values, ["0.1", "0.2"]);
  assert.equal(node.typedProperties.find((prop) => prop.key === "text").valueText, "Hello");
});

test("describeBatchWidgetProperties returns common descriptors and mixed value state", () => {
  const document = parseLayout(`FrameWidgetClass Root {
 {
  TextWidgetClass First {
   position 0 0
   size 0.2 0.05
   text "One"
  }
  TextWidgetClass Second {
   position 0 0
   size 0.2 0.05
   text "Two"
  }
 }
}`);
  const [first, second] = document.roots[0].children;
  const descriptors = describeBatchWidgetProperties([first, second]);
  const text = descriptors.find((prop) => prop.key === "text");
  const size = descriptors.find((prop) => prop.key === "size");

  assert.equal(text.batch, true);
  assert.equal(text.selectedCount, 2);
  assert.equal(text.mixed, true);
  assert.equal(size.mixed, false);
  assert.deepEqual(size.valuesByWidget.map((entry) => entry.widgetName), ["First", "Second"]);
});
