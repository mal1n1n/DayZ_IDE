import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLayoutPatch,
  buildLayoutPreviewModel,
  buildLayoutTransformPatch,
  parseLayout,
} from "../src/index.mjs";

const source = `FrameWidgetClass Root {
 position 0 0
 size 1 1
 {
  ImageWidgetClass A {
   position 0.1 0.1
   size 0.1 0.1
  }
  ImageWidgetClass B {
   position 0.4 0.2
   size 0.1 0.1
  }
  ImageWidgetClass C {
   position 0.8 0.3
   size 0.1 0.1
  }
 }
}
`;

test("buildLayoutTransformPatch aligns selected widgets through updateBox operations", () => {
  const document = parseLayout(source, { filePath: "inline.layout" });
  const transformed = buildLayoutTransformPatch(document, {
    action: "align-left",
    width: 1000,
    height: 500,
    widgetIds: ["Root:0/A:0", "Root:0/B:1"],
  });

  assert.equal(transformed.ok, true);
  assert.equal(transformed.operationCount, 1);
  assert.deepEqual(transformed.patch.operations[0].position, [0.1, 0.2]);

  const applied = applyLayoutPatch(source, transformed.patch, { includeSource: true });
  assert.equal(applied.ok, true);
  const model = buildLayoutPreviewModel(parseLayout(applied.source), { width: 1000, height: 500 });
  const a = model.nodes.find((node) => node.name === "A");
  const b = model.nodes.find((node) => node.name === "B");
  assert.equal(b.box.x, a.box.x);
});

test("buildLayoutTransformPatch distributes selected widgets with equal gaps", () => {
  const document = parseLayout(source, { filePath: "inline.layout" });
  const transformed = buildLayoutTransformPatch(document, {
    action: "distribute-horizontal",
    width: 1000,
    height: 500,
    widgetIds: ["Root:0/A:0", "Root:0/B:1", "Root:0/C:2"],
  });

  assert.equal(transformed.ok, true);
  assert.equal(transformed.operationCount, 1);
  assert.deepEqual(transformed.patch.operations[0].position, [0.45, 0.2]);

  const applied = applyLayoutPatch(source, transformed.patch, { includeSource: true });
  assert.equal(applied.ok, true);
  const model = buildLayoutPreviewModel(parseLayout(applied.source), { width: 1000, height: 500 });
  const [a, b, c] = ["A", "B", "C"].map((name) => model.nodes.find((node) => node.name === name));
  const firstGap = b.box.x - (a.box.x + a.box.width);
  const secondGap = c.box.x - (b.box.x + b.box.width);
  assert.equal(firstGap, secondGap);
});

test("buildLayoutTransformPatch translates a group by pixel delta", () => {
  const document = parseLayout(source, { filePath: "inline.layout" });
  const transformed = buildLayoutTransformPatch(document, {
    action: "translate",
    width: 1000,
    height: 500,
    widgetIds: ["Root:0/A:0", "Root:0/B:1"],
    delta: [50, 25],
  });

  assert.equal(transformed.ok, true);
  assert.equal(transformed.operationCount, 2);
  assert.deepEqual(transformed.patch.operations.map((operation) => operation.position), [
    [0.15, 0.15],
    [0.45, 0.25],
  ]);
});

test("buildLayoutTransformPatch resizes a group by scaling positions and sizes", () => {
  const document = parseLayout(source, { filePath: "inline.layout" });
  const transformed = buildLayoutTransformPatch(document, {
    action: "resize-group",
    width: 1000,
    height: 500,
    widgetIds: ["Root:0/A:0", "Root:0/B:1"],
    targetBounds: { x: 100, y: 50, width: 800, height: 200 },
  });

  assert.equal(transformed.ok, true);
  assert.equal(transformed.operationCount, 2);
  assert.deepEqual(transformed.patch.operations[0].size, [0.2, 0.2]);
  assert.deepEqual(transformed.patch.operations[1].position, [0.7, 0.3]);
  assert.deepEqual(transformed.patch.operations[1].size, [0.2, 0.2]);

  const applied = applyLayoutPatch(source, transformed.patch, { includeSource: true });
  assert.equal(applied.ok, true);
  const model = buildLayoutPreviewModel(parseLayout(applied.source), { width: 1000, height: 500 });
  const [a, b] = ["A", "B"].map((name) => model.nodes.find((node) => node.name === name));
  assert.equal(a.box.width, 200);
  assert.equal(a.box.height, 100);
  assert.equal(b.box.x, 700);
  assert.equal(b.box.y, 150);
  assert.equal(b.box.width, 200);
  assert.equal(b.box.height, 100);
});
