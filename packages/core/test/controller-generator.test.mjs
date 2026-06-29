import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  generateControllerSkeleton,
  parseLayout,
} from "../src/index.mjs";

test("generateControllerSkeleton creates typed fields and FindAnyWidget bindings", () => {
  const filePath = path.resolve("fixtures/layouts/arena_bot_minimal.layout");
  const document = parseLayout(fs.readFileSync(filePath, "utf8"), { filePath });
  const skeleton = generateControllerSkeleton(document, {
    className: "ArenaMenu",
    layoutPath: "layouts/arena_bot_minimal.layout",
  });

  assert.equal(skeleton.className, "ArenaMenu");
  assert.equal(skeleton.widgets.length, 4);
  assert.match(skeleton.source, /class ArenaMenu extends UIScriptedMenu/);
  assert.match(skeleton.source, /protected TextWidget m_Title;/);
  assert.match(skeleton.source, /m_Title = TextWidget\.Cast\(m_Root\.FindAnyWidget\("Title"\)\);/);
  assert.match(skeleton.source, /CreateWidgets\("layouts\/arena_bot_minimal\.layout"\)/);
});
