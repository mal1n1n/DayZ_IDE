import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildProjectAssetIndex,
  parseLayout,
  validateLayoutDocument,
  validateProject,
} from "../src/index.mjs";

test("validateLayoutDocument reports duplicates, bad sizes, unresolved images, and string refs", () => {
  const filePath = path.resolve("fixtures/layouts/invalid_minimal.layout");
  const document = parseLayout(fs.readFileSync(filePath, "utf8"), { filePath });
  const projectIndex = buildProjectAssetIndex(path.resolve("fixtures"));
  const diagnostics = validateLayoutDocument(document, {
    projectIndex,
    stringTable: new Set(),
  });
  const codes = diagnostics.map((diagnostic) => diagnostic.code).sort();

  assert.deepEqual(codes, [
    "layout.image.asset-unresolved",
    "layout.text.stringtable-unresolved",
    "layout.widget.duplicate-name",
    "layout.widget.non-positive-size",
  ]);
  assert.equal(diagnostics.every((diagnostic) => diagnostic.filePath === filePath), true);
});

test("validateProject reports unresolved script widget and stringtable refs", () => {
  const report = validateProject(path.resolve("fixtures"));
  const scriptCodes = report.scripts.diagnostics.map((diagnostic) => diagnostic.code).sort();

  assert.deepEqual(scriptCodes, [
    "script.text.stringtable-unresolved",
    "script.widget.findanywidget-unresolved",
  ]);
});

test("validateLayoutDocument reports missing glyphs for direct and style font refs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-font-coverage-"));
  const fontPath = path.join(root, "gui/fonts/Tiny.fnt");
  const stylePath = path.join(root, "gui/styles/test.styles");
  const layoutPath = path.join(root, "gui/layouts/font.layout");
  fs.mkdirSync(path.dirname(fontPath), { recursive: true });
  fs.mkdirSync(path.dirname(stylePath), { recursive: true });
  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  fs.writeFileSync(fontPath, `info face="Tiny"
chars count=2
char id=32 x=0 y=0 width=4 height=8
char id=65 x=4 y=0 width=8 height=8
`);
  fs.writeFileSync(stylePath, `StyleClass Normal {
 font gui/fonts/Tiny
}
`);
  fs.writeFileSync(layoutPath, `FrameWidgetClass Root {
 size 1 1
 {
  TextWidgetClass Direct {
   font gui/fonts/Tiny
   text AZ
  }
  TextWidgetClass Styled {
   style Normal
   text AZ
  }
 }
}
`);

  const projectIndex = buildProjectAssetIndex(root);
  const document = parseLayout(fs.readFileSync(layoutPath, "utf8"), { filePath: layoutPath });
  const diagnostics = validateLayoutDocument(document, { projectIndex })
    .filter((diagnostic) => diagnostic.code === "layout.font.glyph-missing");

  assert.equal(diagnostics.length, 2);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.context.missingGlyphs[0].hex), ["U+005A", "U+005A"]);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.context.fontSource), ["font", "style"]);
});
