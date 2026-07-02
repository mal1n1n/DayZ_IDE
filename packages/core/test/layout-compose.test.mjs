import assert from "node:assert/strict";
import test from "node:test";

import {
  composeLayoutSource,
  parseLayout,
  walkWidgets,
} from "../src/index.mjs";

test("composeLayoutSource builds a parseable nested layout from a widget spec", () => {
  const result = composeLayoutSource({
    root: {
      typeClass: "FrameWidgetClass",
      name: "RootFrame",
      props: {
        position: [0, 0],
        size: [1, 1],
        visible: true,
      },
      children: [
        {
          typeClass: "ImageWidgetClass",
          name: "Logo",
          props: {
            position: [0.1, 0.12],
            size: [0.2, 0.2],
            image0: "set:data image:logo",
          },
        },
        {
          type: "TextWidgetClass",
          name: "Title",
          properties: [
            { key: "position", values: [0.35, 0.12] },
            { key: "size", values: [0.4, 0.08] },
            { key: "text", values: ["Arena ready"] },
          ],
        },
      ],
    },
  }, { filePath: "generated.layout" });

  assert.equal(result.ok, true);
  assert.equal(result.rootCount, 1);
  assert.equal(result.widgetCount, 3);
  assert.match(result.source, /visible 1/);
  assert.match(result.source, /image0 "set:data image:logo"/);
  assert.match(result.source, /text "Arena ready"/);

  const document = parseLayout(result.source, { filePath: "generated.layout" });
  assert.deepEqual(document.diagnostics, []);
  assert.deepEqual(walkWidgets(document).map((entry) => entry.node.name), ["RootFrame", "Logo", "Title"]);
});

test("composeLayoutSource rejects invalid widget specs before writing source", () => {
  assert.throws(() => composeLayoutSource({
    root: {
      typeClass: "FrameWidgetClass",
      name: "Bad Root",
    },
  }), /name must not contain whitespace/);
});
