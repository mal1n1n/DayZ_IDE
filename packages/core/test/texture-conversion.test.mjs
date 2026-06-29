import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildTextureConversionPlan,
  encodePngRgba,
  runTextureConversionWorkflow,
} from "../src/index.mjs";

test("buildTextureConversionPlan creates an ImageToPAA command and warns for non-power-of-two PNGs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-conversion-plan-"));
  const source = path.join(root, "atlas.png");
  const imageToPaa = path.join(root, "ImageToPAA.exe");
  fs.writeFileSync(source, makePng(3, 2));
  fs.writeFileSync(imageToPaa, "");

  const plan = buildTextureConversionPlan({
    sourceImage: source,
    tools: {
      imageToPaa,
      texView: null,
      toolsRoot: root,
    },
  });

  assert.equal(plan.ready, true);
  assert.equal(plan.format, "paa");
  assert.equal(plan.outputPath, path.join(root, "atlas.paa"));
  assert.equal(plan.command.executable, imageToPaa);
  assert.deepEqual(plan.command.args, [source, path.join(root, "atlas.paa")]);
  assert.match(plan.warnings[0], /not powers of two/);
});

test("buildTextureConversionPlan requires a command template for EDDS output", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-conversion-edds-"));
  const source = path.join(root, "atlas.png");
  fs.writeFileSync(source, makePng(4, 4));

  const missing = buildTextureConversionPlan({
    sourceImage: source,
    outputPath: path.join(root, "atlas.edds"),
    tools: { imageToPaa: null, texView: null, toolsRoot: null },
  });
  const templated = buildTextureConversionPlan({
    sourceImage: source,
    outputPath: path.join(root, "atlas.edds"),
    command: {
      executable: "converter",
      args: ["{source}", "{out}", "{format}"],
    },
  });

  assert.equal(missing.ready, false);
  assert.ok(missing.missing.includes("EDDS converter command template"));
  assert.equal(templated.ready, true);
  assert.deepEqual(templated.command.args, [source, path.join(root, "atlas.edds"), "edds"]);
});

test("runTextureConversionWorkflow executes a custom converter and verifies output", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-conversion-run-"));
  const source = path.join(root, "atlas.png");
  const outputPath = path.join(root, "atlas.paa");
  fs.writeFileSync(source, makePng(4, 4));

  const run = runTextureConversionWorkflow({
    sourceImage: source,
    outputPath,
    command: {
      executable: process.execPath,
      args: [
        "-e",
        "require('fs').copyFileSync(process.argv[1], process.argv[2])",
        "{source}",
        "{out}",
      ],
    },
  });

  assert.equal(run.ok, true);
  assert.equal(run.outputExists, true);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.existsSync(run.logPath), true);
});

function makePng(width, height) {
  const rgba = Buffer.alloc(width * height * 4, 255);
  return encodePngRgba({ width, height, rgba });
}
