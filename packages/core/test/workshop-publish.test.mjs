import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildWorkshopPublishPlan,
  discoverDayzTools,
  runWorkshopPublishWorkflow,
} from "../src/index.mjs";

test("buildWorkshopPublishPlan creates a PublisherCmd update command", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-workshop-plan-"));
  const toolsRoot = path.join(root, "DayZ Tools");
  const publisherCmd = path.join(toolsRoot, "Bin/Publisher/PublisherCmd.exe");
  const projectRoot = path.join(root, "ClientMods");
  const addonSource = path.join(projectRoot, "MyAddon");
  const outputRoot = path.join(root, "out");
  const pboPath = path.join(outputRoot, "MyAddon.pbo");
  fs.mkdirSync(path.dirname(publisherCmd), { recursive: true });
  fs.mkdirSync(addonSource, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(publisherCmd, "");
  fs.writeFileSync(path.join(projectRoot, "config.cpp"), "class CfgPatches {};");
  fs.writeFileSync(pboPath, "pbo");

  const tools = discoverDayzTools({ toolsRoot, env: {} });
  const plan = buildWorkshopPublishPlan({
    projectRoot,
    addonSource,
    outputRoot,
    tools,
    workshopItemId: "123456",
    changeNote: "DZUI smoke update",
    allowDiagnostics: true,
  });

  assert.equal(plan.ready, true);
  assert.equal(plan.tools.publisherCmd, publisherCmd);
  assert.equal(plan.command.executable, publisherCmd);
  assert.deepEqual(plan.command.args.slice(0, 4), [
    "update",
    "/id:123456",
    "/changeNote:DZUI smoke update",
    `/path:${outputRoot}`,
  ]);
  assert.equal(plan.pboPath, pboPath);
});

test("runWorkshopPublishWorkflow executes a templated publish command and captures logs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-workshop-run-"));
  const projectRoot = path.join(root, "ClientMods");
  const contentRoot = path.join(root, "workshop-content");
  const pboPath = path.join(contentRoot, "MyAddon.pbo");
  const fakePublisher = path.join(root, "fake-publisher.mjs");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(contentRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "config.cpp"), "class CfgPatches {};");
  fs.writeFileSync(pboPath, "pbo");
  fs.writeFileSync(fakePublisher, `
import fs from "node:fs";
import path from "node:path";
const [pboPath, contentRoot, itemId] = process.argv.slice(2);
fs.writeFileSync(path.join(contentRoot, "publish-marker.json"), JSON.stringify({
  pboPath,
  contentRoot,
  itemId,
  envItemId: process.env.DZUI_WORKSHOP_ITEM_ID
}));
console.log("published " + itemId);
`);

  const run = runWorkshopPublishWorkflow({
    projectRoot,
    outputRoot: contentRoot,
    pboPath,
    contentRoot,
    workshopItemId: "987654",
    changeNote: "Smoke publish",
    command: {
      executable: process.execPath,
      args: [fakePublisher, "{pboPath}", "{contentRoot}", "{workshopItemId}"],
    },
    allowDiagnostics: true,
    timeoutMs: 30000,
  });

  assert.equal(run.ok, true);
  assert.equal(run.exitCode, 0);
  assert.match(run.stdout, /published 987654/);
  assert.equal(fs.existsSync(run.logPath), true);
  assert.match(fs.readFileSync(run.logPath, "utf8"), /fake-publisher/);
  const marker = JSON.parse(fs.readFileSync(path.join(contentRoot, "publish-marker.json"), "utf8"));
  assert.equal(marker.pboPath, pboPath);
  assert.equal(marker.itemId, "987654");
  assert.equal(marker.envItemId, "987654");
});
