import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getProperty,
  parseLayout,
  serializeLayout,
  summarizeLayout,
  tokenizeLayout,
  walkWidgets,
} from "../src/index.mjs";

const fixturesDir = path.resolve("fixtures/layouts");

test("tokenizeLayout keeps strings, braces, and line positions", () => {
  const source = 'FrameWidgetClass rootFrame {\n image0 "set:data image:battery"\n}\n';
  const tokens = tokenizeLayout(source);

  assert.equal(tokens[0].type, "identifier");
  assert.equal(tokens[0].value, "FrameWidgetClass");
  assert.equal(tokens[2].type, "braceOpen");
  assert.equal(tokens.find((token) => token.type === "string").value, "set:data image:battery");
  assert.equal(tokens.at(-1).type, "newline");
});

test("parseLayout builds a widget tree and preserves exact source", () => {
  const filePath = path.join(fixturesDir, "arena_bot_minimal.layout");
  const source = fs.readFileSync(filePath, "utf8");
  const document = parseLayout(source, { filePath });
  const widgets = walkWidgets(document);

  assert.deepEqual(document.diagnostics, []);
  assert.equal(document.roots.length, 1);
  assert.equal(document.roots[0].name, "rootFrame");
  assert.equal(widgets.length, 4);
  assert.equal(widgets[1].node.typeClass, "ImageWidgetClass");
  assert.equal(getProperty(widgets[1].node, "image0").values[0].value, "{759C43E52C345E70}MG_Arena/gui/data/header.edds");
  assert.equal(serializeLayout(document), source);
});

test("summarizeLayout reports image refs needed by preview work", () => {
  const document = parseLayout(`FrameWidgetClass PDAFrame {
 {
  ImageWidgetClass Body {
   image0 "MG_StalkerPDA/gui/data/kpk_1280.edds"
  }
  ImageWidgetClass Scratches {
   image0 "MG_StalkerPDA/gui/data/kpk_1280_potertosti.edds"
  }
  ImageWidgetClass Battery {
   image0 "set:data image:battery"
  }
 }
}`, { filePath: "inline-pda.layout" });
  const summary = summarizeLayout(document);

  assert.deepEqual(document.diagnostics, []);
  assert.equal(summary.widgetCount, 4);
  assert.equal(summary.imageRefCount, 3);
  assert.deepEqual(
    summary.imageRefs.map((ref) => ref.ref),
    [
      "MG_StalkerPDA/gui/data/kpk_1280.edds",
      "MG_StalkerPDA/gui/data/kpk_1280_potertosti.edds",
      "set:data image:battery",
    ],
  );
});
