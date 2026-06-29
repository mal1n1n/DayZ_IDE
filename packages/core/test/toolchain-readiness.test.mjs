import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildToolchainReadinessReport,
  encodePngRgba,
} from "../src/index.mjs";

test("buildToolchainReadinessReport scores a fully wired local toolchain", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-readiness-ready-"));
  const projectRoot = path.join(root, "project");
  const toolsRoot = path.join(root, "DayZ Tools");
  const dayzRoot = path.join(root, "DayZ");
  const pDrive = path.join(root, "P");
  const outputRoot = path.join(root, "build");
  const layoutPath = path.join(root, "preview.layout");
  const sourceImage = path.join(root, "atlas.png");

  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.mkdirSync(pDrive, { recursive: true });
  fs.mkdirSync(dayzRoot, { recursive: true });
  fs.writeFileSync(path.join(dayzRoot, "DayZDiag_x64.exe"), "");
  fs.writeFileSync(layoutPath, "");
  fs.writeFileSync(sourceImage, makePng(4, 4));
  touchTool(toolsRoot, "Bin/AddonBuilder/AddonBuilder.exe");
  touchTool(toolsRoot, "Bin/ImageToPAA/ImageToPAA.exe");
  touchTool(toolsRoot, "Bin/Publisher/Publisher.exe");
  touchTool(toolsRoot, "Bin/Publisher/PublisherCmd.exe");
  touchTool(toolsRoot, "Bin/Workbench/WorkbenchApp.exe");
  touchTool(toolsRoot, "Bin/TexView/TexView.exe");

  const report = buildToolchainReadinessReport({
    projectRoot,
    layoutPath,
    outputRoot,
    contentRoot: outputRoot,
    toolsRoot,
    dayzRoot,
    pDrive,
    sourceImage,
    workshopItemId: "123456",
    changeNote: "readiness test",
    requirePbo: false,
  });

  assert.equal(report.ready, true);
  assert.equal(report.percent, 100);
  assert.equal(report.workflows.build.ready, true);
  assert.equal(report.workflows.workshop.ready, true);
  assert.equal(report.workflows.textureConversion.ready, true);
  assert.equal(report.workflows.engineLaunch.ready, true);
  assert.equal(report.workflows.capture.ready, true);
  assert.equal(report.checks.find((check) => check.id === "tool.imageToPaa").status, "ready");
});

test("buildToolchainReadinessReport reports missing project and tools", () => {
  const report = buildToolchainReadinessReport({ tools: {} });

  assert.equal(report.ready, false);
  assert.equal(report.percent, 0);
  assert.equal(report.workflows.build.skipped, true);
  assert.equal(report.checks.find((check) => check.id === "project.root").status, "missing");
  assert.equal(report.checks.find((check) => check.id === "tool.addonBuilder").status, "missing");
  assert.ok(report.nextActions.length > 0);
});

function touchTool(root, relativePath) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "");
}

function makePng(width, height) {
  const rgba = Buffer.alloc(width * height * 4, 255);
  return encodePngRgba({ width, height, rgba });
}
