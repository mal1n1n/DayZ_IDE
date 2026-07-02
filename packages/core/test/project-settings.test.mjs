import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  readProjectSettings,
  writeProjectSettings,
} from "../src/index.mjs";

test("project settings read defaults and persist normalized patches", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-settings-"));
  const initial = readProjectSettings(projectRoot);

  assert.equal(initial.exists, false);
  assert.equal(initial.settings.preview.width, 1280);
  assert.equal(initial.settings.preview.state, "normal");
  assert.equal("build" in initial.settings, false);
  assert.equal("legacyRelease" in initial.settings, false);

  const written = writeProjectSettings(projectRoot, {
    layoutPath: "layouts/menu.layout",
    preview: {
      width: "1920",
      height: 1080,
      language: "Russian",
      state: "disabled",
    },
    build: {
      outputRoot: ".dzui/out",
    },
    legacyRelease: {
      itemId: "123",
    },
  });

  assert.equal(written.written, true);
  assert.equal(fs.existsSync(written.filePath), true);
  assert.equal(written.settings.layoutPath, "layouts/menu.layout");
  assert.equal(written.settings.preview.width, 1920);
  assert.equal(written.settings.preview.height, 1080);
  assert.equal(written.settings.preview.language, "Russian");
  assert.equal(written.settings.preview.state, "disabled");
  assert.equal("build" in written.settings, false);
  assert.equal("legacyRelease" in written.settings, false);
  assert.deepEqual(written.settings.recent.layoutPaths, ["layouts/menu.layout"]);

  const reloaded = readProjectSettings(projectRoot);
  assert.equal(reloaded.exists, true);
  assert.equal(reloaded.settings.layoutPath, "layouts/menu.layout");
  assert.equal(reloaded.settings.preview.language, "Russian");
  assert.equal(reloaded.settings.preview.state, "disabled");
});
