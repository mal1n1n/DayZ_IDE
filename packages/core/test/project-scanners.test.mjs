import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildProjectAssetIndex,
  findMissingGlyphs,
  localizeStringValue,
  parseFontCoverage,
  parseStringTableCsv,
  scanScriptContent,
  stringTableToGrid,
  updateStringTableCsv,
} from "../src/index.mjs";

test("parseStringTableCsv indexes #STR keys with localized columns", () => {
  const table = parseStringTableCsv(fs.readFileSync("fixtures/stringtable.csv", "utf8"), {
    filePath: path.resolve("fixtures/stringtable.csv"),
  });

  assert.equal(table.entries.length, 2);
  assert.equal(table.byKey.has("str_arena_title"), true);
  assert.equal(table.byKey.has("#str_arena_title"), true);
  assert.equal(table.byKey.get("str_pda_battery").values.English, "Battery");

  const grid = stringTableToGrid(table);
  assert.deepEqual(grid.columns, ["English", "Russian"]);
  assert.equal(grid.rows[0].values.English, "Arena queue");
  assert.equal(localizeStringValue("#STR_PDA_BATTERY", { get: (key) => table.byKey.get(key.toLowerCase()) }, "English"), "Battery");
});

test("parseFontCoverage reads BMFont char ids and reports missing glyphs", () => {
  const coverage = parseFontCoverage(`info face="Tiny"
chars count=3
char id=32 x=0 y=0 width=4 height=8
char id=65 x=4 y=0 width=8 height=8
<char id="66" x="12" y="0" width="8" height="8" />
`);

  assert.equal(coverage.known, true);
  assert.equal(coverage.glyphCount, 3);
  assert.deepEqual(findMissingGlyphs("ABZ", coverage).map((glyph) => glyph.hex), ["U+005A"]);
});

test("updateStringTableCsv appends and updates localized values", () => {
  const appended = updateStringTableCsv("Key,English\nSTR_EXISTING,Old\n", {
    key: "#STR_NEW",
    values: {
      English: "Hello, world",
      Russian: "Привет",
    },
  });
  const updated = updateStringTableCsv(appended.source, {
    key: "STR_EXISTING",
    values: {
      English: "New",
    },
  });

  assert.match(appended.source, /STR_NEW,"Hello, world",/);
  assert.match(appended.source, /Russian/);
  assert.match(updated.source, /STR_EXISTING,New,/);
});

test("scanScriptContent extracts DayZ UI script references", () => {
  const script = scanScriptContent(fs.readFileSync("fixtures/scripts/MenuController.c", "utf8"), {
    filePath: path.resolve("fixtures/scripts/MenuController.c"),
  });

  assert.deepEqual(script.refs.createWidgets.map((ref) => ref.ref), ["layouts/arena_bot_minimal.layout"]);
  assert.deepEqual(script.refs.findWidgets.map((ref) => ref.ref), ["Title", "MissingWidget"]);
  assert.deepEqual(script.refs.setText.map((ref) => ref.ref), ["#STR_ARENA_TITLE", "#STR_SCRIPT_MISSING"]);
  assert.equal(script.refs.loadImages.length, 1);
});

test("buildProjectAssetIndex includes style, font, stringtable, and script indexes", () => {
  const index = buildProjectAssetIndex(path.resolve("fixtures"));

  assert.equal(index.styles.has("Normal"), true);
  assert.equal(index.fonts.resolve("gui/fonts/Metron-Bold28").virtualPath, "gui/fonts/Metron-Bold28.fnt");
  assert.equal(index.stringTable.has("#STR_ARENA_TITLE"), true);
  assert.equal(index.scripts.refs.findWidgets.length, 2);
});
