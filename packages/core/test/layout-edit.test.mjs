import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createEditTransaction,
  createWidget,
  deleteWidget,
  parseLayout,
  redoTransaction,
  reparentWidget,
  undoTransaction,
  updateWidgetProperty,
} from "../src/index.mjs";

const pdaLayoutSource = `FrameWidgetClass PDAFrame {
 position 0 0
 size 1 1
 {
  ImageWidgetClass Body {
   position 0.1 0.08
   size 0.656786 0.650686
   image0 "MG_StalkerPDA/gui/data/kpk_1280.edds"
  }
  ImageWidgetClass Scratches {
   position 0.099167 0.078521
   size 0.650126 0.563424
   image0 "MG_StalkerPDA/gui/data/kpk_1280_potertosti.edds"
  }
  ImageWidgetClass Battery {
   position 0.74 0.14
   size 0.04 0.025
   image0 "set:data image:battery"
  }
 }
}
`;

test("updateWidgetProperty replaces an existing property by preview id", () => {
  const filePath = path.resolve("fixtures/layouts/arena_bot_minimal.layout");
  const source = fs.readFileSync(filePath, "utf8");
  const updated = updateWidgetProperty(source, {
    widgetId: "rootFrame:0/Title:1",
    key: "text",
    values: ["Arena live"],
  });

  assert.equal(updated.ok, true);
  assert.match(updated.source, /text "Arena live"/);
  assert.match(updated.source, /\n   text "Arena live"\r?\n/);
  assert.doesNotMatch(updated.source, /\n      text "Arena live"/);
  assert.doesNotMatch(updated.source, /text "Arena queue"/);

  const document = parseLayout(updated.source, { filePath });
  assert.deepEqual(document.diagnostics, []);
});

test("updateWidgetProperty inserts a missing property using widget indentation", () => {
  const filePath = "inline-pda.layout";
  const source = pdaLayoutSource;
  const updated = updateWidgetProperty(source, {
    widgetId: "PDAFrame:0/Battery:2",
    key: "visible",
    values: [0],
  });

  assert.equal(updated.ok, true);
  assert.match(updated.source, /ImageWidgetClass Battery \{\r?\n   visible 0\r?\n   position /);
});

test("edit transactions carry undo and redo source snapshots", () => {
  const filePath = path.resolve("fixtures/layouts/arena_bot_minimal.layout");
  const source = fs.readFileSync(filePath, "utf8");
  const updated = updateWidgetProperty(source, {
    widgetId: "rootFrame:0/Title:1",
    key: "text",
    values: ["Arena live"],
  });
  const transaction = createEditTransaction({
    filePath,
    beforeSource: source,
    afterSource: updated.source,
    edit: updated.edit,
    label: "Update title text",
  });

  assert.equal(undoTransaction(transaction).source, source);
  assert.equal(redoTransaction(transaction).source, updated.source);
  assert.notEqual(transaction.before.hash, transaction.after.hash);
});

test("createWidget inserts a child widget into an existing child group", () => {
  const filePath = "inline-pda.layout";
  const source = pdaLayoutSource;
  const created = createWidget(source, {
    parentWidgetId: "PDAFrame:0",
    typeClass: "TextWidgetClass",
    name: "StatusText",
    props: {
      position: [0.2, 0.2],
      size: [0.2, 0.05],
      text: "Ready",
    },
  });

  assert.equal(created.ok, true);
  assert.match(created.source, /TextWidgetClass StatusText \{\r?\n   position 0\.2 0\.2\r?\n   size 0\.2 0\.05\r?\n   text Ready\r?\n  \}/);
  const document = parseLayout(created.source, { filePath });
  assert.deepEqual(document.diagnostics, []);
  assert.ok(document.roots[0].children.some((child) => child.name === "StatusText"));
});

test("deleteWidget removes a widget block and keeps layout parseable", () => {
  const filePath = "inline-pda.layout";
  const source = pdaLayoutSource;
  const deleted = deleteWidget(source, {
    widgetId: "PDAFrame:0/Scratches:1",
  });

  assert.equal(deleted.ok, true);
  assert.doesNotMatch(deleted.source, /ImageWidgetClass Scratches/);
  const document = parseLayout(deleted.source, { filePath });
  assert.deepEqual(document.diagnostics, []);
  assert.equal(document.roots[0].children.length, 2);
});

test("reparentWidget moves a widget into another widget and reindents the block", () => {
  const filePath = "inline-pda.layout";
  const source = pdaLayoutSource;
  const moved = reparentWidget(source, {
    widgetId: "PDAFrame:0/Battery:2",
    parentWidgetId: "PDAFrame:0/Body:0",
  });

  assert.equal(moved.ok, true);
  assert.match(moved.source, /ImageWidgetClass Body \{[\s\S]*    ImageWidgetClass Battery \{/);
  const document = parseLayout(moved.source, { filePath });
  assert.deepEqual(document.diagnostics, []);
  const body = document.roots[0].children.find((child) => child.name === "Body");
  assert.equal(body.children[0].name, "Battery");
});
