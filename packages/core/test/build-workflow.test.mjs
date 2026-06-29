import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildPboWorkflowPlan,
  discoverDayzTools,
  runPboWorkflow,
} from "../src/index.mjs";

test("buildPboWorkflowPlan creates a safe AddonBuilder command and manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-build-"));
  const toolsRoot = path.join(root, "DayZ Tools");
  const addonBuilder = path.join(toolsRoot, "Bin/AddonBuilder/AddonBuilder.exe");
  const projectRoot = path.join(root, "ClientMods");
  fs.mkdirSync(path.dirname(addonBuilder), { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(addonBuilder, "");
  fs.writeFileSync(path.join(projectRoot, "config.cpp"), "class CfgPatches {};");

  const tools = discoverDayzTools({ toolsRoot, env: {} });
  const plan = buildPboWorkflowPlan({
    projectRoot,
    tools,
    allowDiagnostics: true,
  });

  assert.equal(plan.ready, true);
  assert.equal(plan.command.executable, addonBuilder);
  assert.equal(plan.command.args.includes("-clear"), true);
  assert.equal(plan.manifest.validationDiagnostics, 0);
});

test("runPboWorkflow executes a plan, captures logs, and verifies produced PBO", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-build-run-"));
  const projectRoot = path.join(root, "ClientMods");
  const addonSource = path.join(projectRoot, "MyAddon");
  const outputRoot = path.join(root, "out");
  const fakeBuilder = path.join(root, "fake-addon-builder.mjs");
  fs.mkdirSync(addonSource, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "config.cpp"), "class CfgPatches {};");
  fs.writeFileSync(fakeBuilder, `
import fs from "node:fs";
import path from "node:path";
const addonSource = process.argv[2];
const outputRoot = process.argv[3];
fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, path.basename(addonSource) + ".pbo"), "pbo");
console.log("built " + addonSource);
`);

  const plan = buildPboWorkflowPlan({
    projectRoot,
    addonSource,
    outputRoot,
    tools: { addonBuilder: process.execPath },
    allowDiagnostics: true,
  });
  plan.command.args = [fakeBuilder, ...plan.command.args];
  const run = runPboWorkflow({ plan, timeoutMs: 30000 });

  assert.equal(run.ok, true);
  assert.equal(run.exitCode, 0);
  assert.equal(run.pboExists, true);
  assert.equal(fs.existsSync(run.pboPath), true);
  assert.match(fs.readFileSync(run.logPath, "utf8"), /built /);
});
