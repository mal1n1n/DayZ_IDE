import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildEngineLaunchPlan,
  buildEnginePreviewPlan,
  buildEnginePreviewWorkspace,
  discoverDayzTools,
  writeEnginePreviewWorkspace,
} from "../src/index.mjs";

test("discoverDayzTools finds explicitly configured tool executables", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-engine-"));
  const toolsRoot = path.join(root, "DayZ Tools");
  const dayzRoot = path.join(root, "DayZ");
  const workbench = path.join(toolsRoot, "Bin/Workbench/WorkbenchApp.exe");
  const dayzDiag = path.join(dayzRoot, "DayZDiag_x64.exe");
  fs.mkdirSync(path.dirname(workbench), { recursive: true });
  fs.mkdirSync(path.dirname(dayzDiag), { recursive: true });
  fs.writeFileSync(workbench, "");
  fs.writeFileSync(dayzDiag, "");

  const tools = discoverDayzTools({ toolsRoot, dayzRoot, env: {} });
  const plan = buildEnginePreviewPlan({
    projectRoot: root,
    layoutPath: path.join(root, "test.layout"),
    tools,
  });

  assert.equal(tools.workbench, workbench);
  assert.equal(tools.dayzDiag, dayzDiag);
  assert.equal(plan.ready, true);
  assert.equal(plan.steps.length > 0, true);
});

test("buildEngineLaunchPlan creates explicit Workbench and DayZDiag commands", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-engine-launch-"));
  const toolsRoot = path.join(root, "DayZ Tools");
  const dayzRoot = path.join(root, "DayZ");
  const projectRoot = path.join(root, "ClientMods");
  const layoutPath = path.join(projectRoot, "gui", "test.layout");
  const workbench = path.join(toolsRoot, "Bin/Workbench/WorkbenchApp.exe");
  const dayzDiag = path.join(dayzRoot, "DayZDiag_x64.exe");
  fs.mkdirSync(path.dirname(workbench), { recursive: true });
  fs.mkdirSync(path.dirname(dayzDiag), { recursive: true });
  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  fs.writeFileSync(workbench, "");
  fs.writeFileSync(dayzDiag, "");
  fs.writeFileSync(layoutPath, "");

  const tools = discoverDayzTools({ toolsRoot, dayzRoot, env: {} });
  const diagPlan = buildEngineLaunchPlan({
    mode: "dayzDiag",
    projectRoot,
    layoutPath,
    tools,
  });
  const workbenchPlan = buildEngineLaunchPlan({
    mode: "workbench",
    projectRoot,
    layoutPath,
    tools,
  });

  assert.equal(diagPlan.ready, true);
  assert.equal(diagPlan.command.executable, dayzDiag);
  assert.equal(diagPlan.command.args.includes("-filePatching"), true);
  assert.equal(diagPlan.command.args.some((arg) => arg.startsWith("-mission=")), true);
  assert.equal(workbenchPlan.ready, true);
  assert.equal(workbenchPlan.command.executable, workbench);
  assert.equal(workbenchPlan.command.args.includes(projectRoot), true);
});

test("engine preview workspace generates and writes a temporary mission scaffold", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-engine-workspace-"));
  const projectRoot = path.join(root, "ClientMods");
  const layoutPath = path.join(projectRoot, "gui", "layouts", "menu.layout");
  fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
  fs.writeFileSync(layoutPath, "FrameWidgetClass rootFrame {}\n");

  const workspace = buildEnginePreviewWorkspace({
    projectRoot,
    layoutPath,
    width: 1920,
    height: 1080,
    language: "English",
  });

  const initFile = workspace.files.find((file) => file.role === "mission-init");
  assert.equal(workspace.layoutRef, "gui/layouts/menu.layout");
  assert.equal(workspace.viewport.width, 1920);
  assert.match(initFile.source, /CreateWidgets\(DZUI_PREVIEW_LAYOUT\)/);
  assert.match(initFile.source, /class DzuiPreviewMission: MissionGameplay/);

  const written = writeEnginePreviewWorkspace({ projectRoot, layoutPath });
  assert.equal(written.written, true);
  assert.equal(fs.existsSync(path.join(written.missionPath, "init.c")), true);
  assert.equal(fs.existsSync(path.join(written.previewRoot, "dzui-preview-workspace.json")), true);
  assert.equal(fs.existsSync(path.join(written.previewRoot, "launch-dayzdiag.cmd")), true);
});
