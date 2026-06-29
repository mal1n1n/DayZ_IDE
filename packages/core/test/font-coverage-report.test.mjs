import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildFontCoverageReport,
} from "../src/index.mjs";

test("buildFontCoverageReport aggregates missing glyphs by target language and atlas page", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-font-coverage-report-"));
  fs.mkdirSync(path.join(root, "gui/fonts"), { recursive: true });
  fs.mkdirSync(path.join(root, "gui/layouts"), { recursive: true });
  fs.writeFileSync(path.join(root, "gui/fonts/Tiny_0.png"), "png", "utf8");
  fs.writeFileSync(path.join(root, "gui/fonts/Tiny.fnt"), `info face="Tiny"
page id=0 file="Tiny_0.png"
chars count=10
char id=32 x=0 y=0 width=3 height=8
char id=65 x=3 y=0 width=6 height=8
char id=66 x=9 y=0 width=6 height=8
char id=69 x=15 y=0 width=6 height=8
char id=78 x=21 y=0 width=6 height=8
char id=82 x=27 y=0 width=6 height=8
char id=97 x=33 y=0 width=6 height=8
char id=101 x=39 y=0 width=6 height=8
char id=110 x=45 y=0 width=6 height=8
char id=114 x=51 y=0 width=6 height=8
`, "utf8");
  fs.writeFileSync(path.join(root, "stringtable.csv"), "Key,English,Russian\nSTR_TITLE,Arena,Арена\n", "utf8");
  fs.writeFileSync(path.join(root, "gui/layouts/menu.layout"), `FrameWidgetClass Root {
 size 1 1
 {
  TextWidgetClass Title {
   font gui/fonts/Tiny
   text "#STR_TITLE"
  }
 }
}
`, "utf8");

  const report = buildFontCoverageReport({
    projectRoot: root,
    languages: ["English", "Russian"],
  });
  const font = report.fonts.find((candidate) => candidate.ref === "gui/fonts/Tiny");
  const english = font.languages.find((item) => item.language === "English");
  const russian = font.languages.find((item) => item.language === "Russian");

  assert.equal(report.fontCount, 1);
  assert.equal(report.usedFontCount, 1);
  assert.equal(font.atlasPages[0].exists, true);
  assert.equal(english.missingGlyphCount, 0);
  assert.equal(russian.missingGlyphCount > 0, true);
  assert.equal(font.missingGlyphs.some((glyph) => glyph.hex === "U+0410"), true);
  assert.equal(report.ready, false);
  assert.equal(report.diagnostics.some((diagnostic) => diagnostic.code === "font.coverage.missing-glyphs"), true);
});
