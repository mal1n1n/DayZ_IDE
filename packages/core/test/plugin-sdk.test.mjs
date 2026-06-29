import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildPluginRuntimePackage,
  buildPluginRuntimeRegistry,
  buildPluginSdkReport,
  discoverPluginManifests,
  installPluginRuntimeTrust,
  runPluginRuntimeCommand,
  verifyPluginRuntimePackage,
  writePluginRuntimePackage,
} from "../src/index.mjs";

test("buildPluginSdkReport discovers valid plugin manifests and counts contributions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-plugins-"));
  const pluginRoot = path.join(root, "dzui-plugins", "sample");
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, "index.mjs"), "export default {};\n", "utf8");
  fs.writeFileSync(path.join(pluginRoot, "panel.html"), "<div>Sample</div>\n", "utf8");
  fs.writeFileSync(path.join(pluginRoot, "dzui.plugin.json"), JSON.stringify({
    id: "sample.ui",
    name: "Sample UI",
    version: "0.1.0",
    apiVersion: "0.1",
    entry: "./index.mjs",
    contributes: {
      commands: [{ id: "sample.refresh", title: "Refresh sample" }],
      widgetPresets: [{ id: "sample.badge", label: "Sample Badge", typeClass: "TextWidgetClass" }],
      panels: [{ id: "sample.panel", title: "Sample", entry: "./panel.html" }],
    },
  }, null, 2), "utf8");

  assert.deepEqual(discoverPluginManifests(root).map((filePath) => path.basename(filePath)), ["dzui.plugin.json"]);
  const report = buildPluginSdkReport(root);
  assert.equal(report.ready, true);
  assert.equal(report.pluginCount, 1);
  assert.equal(report.enabledCount, 1);
  assert.deepEqual(report.contributionCounts, {
    commands: 1,
    widgetPresets: 1,
    panels: 1,
    validators: 0,
  });
  assert.deepEqual(report.plugins[0].capabilities, ["commands", "panels", "widgetPresets"]);
  assert.equal(report.plugins[0].entryVirtualPath, "dzui-plugins/sample/index.mjs");
});

test("buildPluginRuntimeRegistry namespaces runtime contributions and packages files", () => {
  const report = buildPluginRuntimeRegistry("fixtures");

  assert.equal(report.kind, "PluginRuntimeRegistry");
  assert.equal(report.ready, true);
  assert.equal(report.pluginCount, 1);
  assert.equal(report.contributionCounts.widgetPresets, 1);
  assert.equal(report.widgetPresets[0].id, "sample.tools/sample.tools.badge");
  assert.equal(report.widgetPresets[0].typeClass, "TextWidgetClass");
  assert.equal(report.panels[0].entry.virtualPath, "dzui-plugins/sample/panel.html");
  assert.equal(report.package.files.some((file) => file.virtualPath === "dzui-plugins/sample/dzui.plugin.json" && file.sha256.length === 64), true);
  assert.equal(report.package.files.some((file) => file.virtualPath === "dzui-plugins/sample/index.mjs" && file.role === "entry"), true);
});

test("plugin runtime package manifests verify file integrity and detect drift", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-plugin-package-"));
  const pluginRoot = path.join(root, "dzui-plugins", "sample");
  fs.mkdirSync(pluginRoot, { recursive: true });
  const entryPath = path.join(pluginRoot, "index.mjs");
  fs.writeFileSync(entryPath, "export default { activate() { return { ok: true }; } };\n", "utf8");
  fs.writeFileSync(path.join(pluginRoot, "panel.html"), "<div>Panel</div>\n", "utf8");
  fs.writeFileSync(path.join(pluginRoot, "dzui.plugin.json"), JSON.stringify({
    id: "sample.package",
    name: "Sample Package",
    version: "0.1.0",
    apiVersion: "0.1",
    entry: "./index.mjs",
    contributes: {
      commands: [{ id: "refresh", title: "Refresh" }],
      panels: [{ id: "panel", title: "Panel", entry: "./panel.html" }],
    },
  }, null, 2), "utf8");

  const manifest = buildPluginRuntimePackage(root);
  assert.equal(manifest.kind, "PluginRuntimePackageManifest");
  assert.equal(manifest.ready, true);
  assert.equal(manifest.packageSha256.length, 64);
  assert.equal(verifyPluginRuntimePackage(root, manifest).passed, true);

  const written = writePluginRuntimePackage(root);
  assert.equal(written.written, true);
  assert.equal(fs.existsSync(written.filePath), true);
  assert.equal(verifyPluginRuntimePackage(root, written.filePath).passed, true);

  fs.appendFileSync(entryPath, "\n// changed after package\n", "utf8");
  const drifted = verifyPluginRuntimePackage(root, written.filePath);
  const codes = drifted.diagnostics.map((diagnostic) => diagnostic.code);
  assert.equal(drifted.passed, false);
  assert.equal(codes.includes("plugin.package.hash.mismatch"), true);
  assert.equal(codes.includes("plugin.package.file.hash.mismatch"), true);
});

test("plugin runtime package signatures enforce trusted install policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-plugin-signed-package-"));
  const pluginRoot = path.join(root, "dzui-plugins", "signed");
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, "index.mjs"), "export default { activate() { return {}; } };\n", "utf8");
  fs.writeFileSync(path.join(pluginRoot, "dzui.plugin.json"), JSON.stringify({
    id: "signed.plugin",
    name: "Signed Plugin",
    version: "0.1.0",
    apiVersion: "0.1",
    entry: "./index.mjs",
    contributes: {
      commands: [{ id: "refresh", title: "Refresh" }],
    },
  }, null, 2), "utf8");

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const manifest = buildPluginRuntimePackage(root, {
    signPrivateKeyPem: privateKeyPem,
    signPublicKeyPem: publicKeyPem,
    signKeyId: "test-signing-key",
  });

  assert.equal(manifest.integrity.signed, true);
  assert.equal(manifest.signature.keyId, "test-signing-key");
  assert.equal(manifest.signature.value.length > 32, true);

  const trusted = verifyPluginRuntimePackage(root, manifest, {
    requireTrusted: true,
    trustPolicy: {
      requireTrusted: true,
      trustedKeys: [{ id: "test-signing-key", publicKeyPem }],
    },
  });
  assert.equal(trusted.passed, true);
  assert.equal(trusted.signature.verified, true);
  assert.equal(trusted.signature.trusted, true);

  const untrusted = verifyPluginRuntimePackage(root, manifest, { requireTrusted: true });
  assert.equal(untrusted.passed, false);
  assert.equal(untrusted.signature.verified, true);
  assert.equal(untrusted.signature.trusted, false);
  assert.equal(untrusted.diagnostics.some((diagnostic) => diagnostic.code === "plugin.package.signature.untrusted"), true);

  const unsigned = buildPluginRuntimePackage(root);
  const unsignedRequired = verifyPluginRuntimePackage(root, unsigned, { requireSignature: true });
  assert.equal(unsignedRequired.passed, false);
  assert.equal(unsignedRequired.diagnostics.some((diagnostic) => diagnostic.code === "plugin.package.signature.missing"), true);

  const trustPath = path.join(root, ".dzui", "plugin-trust-policy.json");
  const installed = installPluginRuntimeTrust(root, manifest, { trustPolicyPath: trustPath });
  assert.equal(installed.ready, true);
  assert.equal(installed.installed, true);
  assert.equal(installed.policy.trustedKeyCount, 1);
  assert.equal(fs.existsSync(trustPath), true);
  const trustedFromFile = verifyPluginRuntimePackage(root, manifest, {
    requireTrusted: true,
    trustPolicyPath: trustPath,
  });
  assert.equal(trustedFromFile.passed, true);
  assert.equal(trustedFromFile.signature.trusted, true);
  const installedAgain = installPluginRuntimeTrust(root, manifest, { trustPolicyPath: trustPath });
  assert.equal(installedAgain.installed, false);
  assert.equal(installedAgain.alreadyTrusted, true);
  assert.equal(installedAgain.policy.trustedKeyCount, 1);

  const tampered = JSON.parse(JSON.stringify(manifest));
  const tamperedSignature = Buffer.from(manifest.signature.value, "base64");
  tamperedSignature[0] ^= 0xff;
  tampered.signature.value = tamperedSignature.toString("base64");
  const invalid = verifyPluginRuntimePackage(root, tampered, {
    requireSignature: true,
    trustPolicy: { trustedKeys: [{ id: "test-signing-key", publicKeyPem }] },
  });
  assert.equal(invalid.passed, false);
  assert.equal(invalid.diagnostics.some((diagnostic) => diagnostic.code === "plugin.package.signature.invalid"), true);
});

test("plugin runtime commands plan, execute after verification, and reject drift", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-plugin-command-"));
  const pluginRoot = path.join(root, "dzui-plugins", "commands");
  fs.mkdirSync(pluginRoot, { recursive: true });
  const entryPath = path.join(pluginRoot, "index.mjs");
  fs.writeFileSync(entryPath, `export default {
  activate(context) {
    return {
      commands: {
        ping({ args, plugin, command }) {
          return { ok: true, pluginId: plugin.id, commandId: command.id, value: args.value };
        }
      }
    };
  }
};\n`, "utf8");
  fs.writeFileSync(path.join(pluginRoot, "dzui.plugin.json"), JSON.stringify({
    id: "command.plugin",
    name: "Command Plugin",
    version: "0.1.0",
    apiVersion: "0.1",
    entry: "./index.mjs",
    contributes: {
      commands: [{ id: "ping", title: "Ping" }],
    },
  }, null, 2), "utf8");

  const planned = await runPluginRuntimeCommand(root, { commandId: "command.plugin/ping" });
  assert.equal(planned.kind, "PluginRuntimeCommandPlan");
  assert.equal(planned.execute, false);
  assert.equal(planned.command.id, "command.plugin/ping");

  const written = writePluginRuntimePackage(root);
  const executed = await runPluginRuntimeCommand(root, {
    commandId: "command.plugin/ping",
    packagePath: written.filePath,
    args: { value: 42 },
    execute: true,
  });
  assert.equal(executed.executed, true);
  assert.equal(executed.trusted, true);
  assert.deepEqual(executed.result, {
    ok: true,
    pluginId: "command.plugin",
    commandId: "command.plugin/ping",
    value: 42,
  });

  fs.appendFileSync(entryPath, "\n// drift\n", "utf8");
  const refused = await runPluginRuntimeCommand(root, {
    commandId: "command.plugin/ping",
    packagePath: written.filePath,
    execute: true,
  });
  assert.equal(refused.executed, false);
  assert.equal(refused.reason, "Plugin runtime package verification failed.");

  const untrusted = await runPluginRuntimeCommand(root, {
    commandId: "command.plugin/ping",
    args: { value: "manual" },
    execute: true,
    allowUntrusted: true,
  });
  assert.equal(untrusted.executed, true);
  assert.equal(untrusted.trusted, false);
  assert.equal(untrusted.result.value, "manual");
});

test("buildPluginSdkReport reports manifest, path, and contribution diagnostics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-plugins-bad-"));
  const pluginRoot = path.join(root, "plugins", "bad");
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, "dzui.plugin.json"), JSON.stringify({
    id: "bad plugin",
    name: "Bad Plugin",
    version: "1",
    entry: "../escape.mjs",
    contributes: {
      commands: [{ id: "bad.command" }, { id: "bad.command" }],
      widgetPresets: [{ id: "bad.widget" }],
      validators: [{ id: "bad.validator", entry: "./missing.mjs" }],
    },
  }, null, 2), "utf8");

  const report = buildPluginSdkReport(root);
  const codes = report.diagnostics.map((diagnostic) => diagnostic.code);
  assert.equal(report.ready, false);
  assert.equal(report.pluginCount, 1);
  assert.equal(codes.includes("plugin.manifest.id.invalid"), true);
  assert.equal(codes.includes("plugin.manifest.entry.outside-root"), true);
  assert.equal(codes.includes("plugin.contributes.commands.id.duplicate"), true);
  assert.equal(codes.includes("plugin.contributes.widgetPresets.typeClass.missing"), true);
  assert.equal(codes.includes("plugin.contributes.validators.entry.missing"), true);
});
