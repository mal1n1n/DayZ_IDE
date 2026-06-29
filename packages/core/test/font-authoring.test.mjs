import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractBmFontPageRefs,
  importFontAsset,
} from "../src/index.mjs";

test("extractBmFontPageRefs reads text and XML BMFont page refs", () => {
  const refs = extractBmFontPageRefs(`
page id=0 file="Tiny_0.png"
<page id="1" file="Tiny_1.png" />
page id=2 file=Tiny_2.tga
`);

  assert.deepEqual(refs, ["Tiny_0.png", "Tiny_1.png", "Tiny_2.tga"]);
});

test("importFontAsset copies BMFont files, page textures, and reports sample glyph coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-font-import-"));
  const sourceDir = path.join(root, "source");
  const projectRoot = path.join(root, "project");
  const sourceFont = path.join(sourceDir, "Tiny.fnt");
  const sourcePage = path.join(sourceDir, "Tiny_0.png");
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(sourceFont, `info face="Tiny"
page id=0 file="Tiny_0.png"
chars count=2
char id=32 x=0 y=0 width=4 height=8
char id=65 x=4 y=0 width=8 height=8
`);
  fs.writeFileSync(sourcePage, "png-bytes");

  const result = importFontAsset({
    projectRoot,
    sourceFont,
    fontVirtualPath: "gui/fonts/Tiny.fnt",
    sampleText: "AZ",
  });

  assert.equal(result.written, true);
  assert.equal(result.fontRef, "gui/fonts/Tiny");
  assert.equal(result.coverage.known, true);
  assert.equal(result.coverage.glyphCount, 2);
  assert.deepEqual(result.missingGlyphs.map((glyph) => glyph.hex), ["U+005A"]);
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].virtualPath, "gui/fonts/Tiny_0.png");
  assert.equal(result.pages[0].written, true);
  assert.equal(fs.existsSync(path.join(projectRoot, "gui/fonts/Tiny.fnt")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "gui/fonts/Tiny_0.png")), true);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === "font.coverage.sample-missing-glyphs"), true);
});

test("importFontAsset can dry-run without writing target files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-font-import-dry-"));
  const sourceFont = path.join(root, "Tiny.fnt");
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(sourceFont, `info face="Tiny"
chars count=1
char id=65 x=0 y=0 width=8 height=8
`);

  const result = importFontAsset({
    projectRoot,
    sourceFont,
    fontVirtualPath: "gui/fonts/Tiny.fnt",
    write: false,
  });

  assert.equal(result.written, false);
  assert.equal(fs.existsSync(path.join(projectRoot, "gui/fonts/Tiny.fnt")), false);
  assert.equal(result.coverage.known, true);
});
