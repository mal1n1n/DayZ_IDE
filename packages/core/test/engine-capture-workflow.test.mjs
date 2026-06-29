import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildEngineCapturePlan,
  encodePngRgba,
  runEngineCaptureWorkflow,
} from "../src/index.mjs";

test("runEngineCaptureWorkflow executes a capture command and writes diff reports", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-capture-"));
  const projectRoot = path.join(root, "ClientMods");
  const layoutPath = path.join(projectRoot, "layouts", "pda.layout");
  const fakeCapture = path.join(root, "fake-capture.mjs");
  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  fs.writeFileSync(layoutPath, `FrameWidgetClass PDAFrame {
 position 0 0
 size 1 1
 {
  ImageWidgetClass Body {
   position 0.1 0.1
   size 0.5 0.5
  }
 }
}
`);
  const expectedPng = encodePngRgba({
    width: 2,
    height: 1,
    rgba: Buffer.from([10, 10, 10, 255, 20, 20, 20, 255]),
  }).toString("base64");
  const actualPng = encodePngRgba({
    width: 2,
    height: 1,
    rgba: Buffer.from([10, 10, 10, 255, 25, 20, 20, 255]),
  }).toString("base64");
  fs.writeFileSync(fakeCapture, `
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync(path.dirname(process.env.DZUI_CAPTURE_EXPECTED_SCREENSHOT), { recursive: true });
fs.writeFileSync(process.env.DZUI_CAPTURE_EXPECTED_SCREENSHOT, Buffer.from("${expectedPng}", "base64"));
fs.writeFileSync(process.env.DZUI_CAPTURE_ACTUAL_SCREENSHOT, Buffer.from("${actualPng}", "base64"));
fs.writeFileSync(process.env.DZUI_CAPTURE_GEOMETRY_DUMP, JSON.stringify({
  kind: "DzuiEngineGeometryDump",
  widgets: [
    { id: "PDAFrame:0", name: "PDAFrame", typeClass: "FrameWidgetClass", box: { x: 0, y: 0, width: 1280, height: 720 } },
    { id: "PDAFrame:0/Body:0", name: "Body", typeClass: "ImageWidgetClass", box: { x: 128, y: 72, width: 640, height: 360 } }
  ]
}, null, 2));
console.log("capture complete");
`);

  const plan = buildEngineCapturePlan({
    projectRoot,
    layoutPath,
    command: {
      executable: process.execPath,
      args: [fakeCapture],
      cwd: root,
    },
  });
  const run = runEngineCaptureWorkflow({ plan, timeoutMs: 30000 });

  assert.equal(run.ok, true);
  assert.equal(run.exitCode, 0);
  assert.equal(run.outputs.actualScreenshot, true);
  assert.equal(run.outputs.geometryDump, true);
  assert.equal(run.pixelReport.passed, false);
  assert.equal(run.pixelReport.summary.differingPixels, 1);
  assert.equal(run.geometryReport.passed, true);
  assert.equal(fs.existsSync(run.plan.paths.pixelDiff), true);
  assert.match(fs.readFileSync(run.logPath, "utf8"), /capture complete/);
});
