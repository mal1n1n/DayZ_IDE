import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import test from "node:test";

test("MCP HTTP transport serves JSON-RPC on loopback and rejects foreign origins", async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [
    "packages/mcp-server/src/server.mjs",
    "--http",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--project",
    "fixtures",
  ], {
    cwd: path.resolve("."),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  child.stdout.resume();

  try {
    await waitForHealth(port, stderr);

    const initialized = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    assert.equal(initialized.status, 200);
    assert.equal(initialized.body.result.serverInfo.name, "dzui-mcp");
    assert.equal(initialized.body.result.capabilities.resources.subscribe, true);
    assert.equal(initialized.body.result.capabilities.resources.listChanged, true);

    const listed = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "preview_model"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "plugin_sdk_report"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "plugin_runtime_registry"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "plugin_runtime_package"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "plugin_runtime_verify"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "plugin_runtime_command"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "plugin_runtime_trust"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "font_coverage_report"), true);
    assert.equal(listed.body.result.tools.some((tool) => tool.name === "layout_compose"), true);

    const preview = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "preview-state",
      method: "tools/call",
      params: {
        name: "preview_model",
        arguments: {
          file: "fixtures/layouts/arena_bot_minimal.layout",
          previewState: "hover",
          language: "English",
        },
      },
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.result.structuredContent.previewState, "hover");
    assert.equal(preview.body.result.structuredContent.nodes[0].state.requested, "hover");

    const composed = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "compose-layout",
      method: "tools/call",
      params: {
        name: "layout_compose",
        arguments: {
          file: "fixtures/layouts/generated_ai.layout",
          project: "fixtures",
          includeSource: true,
          spec: {
            root: {
              typeClass: "FrameWidgetClass",
              name: "GeneratedRoot",
              props: { position: [0, 0], size: [1, 1] },
              children: [
                {
                  typeClass: "TextWidgetClass",
                  name: "Title",
                  props: { position: [0.1, 0.1], size: [0.3, 0.05], text: "Generated title" },
                },
              ],
            },
          },
        },
      },
    });
    assert.equal(composed.status, 200);
    assert.equal(composed.body.result.structuredContent.written, false);
    assert.equal(composed.body.result.structuredContent.widgetCount, 2);
    assert.match(composed.body.result.structuredContent.source, /TextWidgetClass Title/);

    const prompts = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 3,
      method: "prompts/list",
      params: {},
    });
    assert.equal(prompts.status, 200);
    assert.equal(prompts.body.result.prompts.some((prompt) => prompt.name === "dayz_ui_safe_edit"), true);
    assert.equal(prompts.body.result.prompts.some((prompt) => prompt.name === "dayz_ui_layout_from_brief"), true);
    assert.equal(prompts.body.result.prompts.some((prompt) => prompt.name === "dayz_ui_image_port"), true);

    const resized = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "layout_transform",
        arguments: {
          file: "fixtures/layouts/arena_bot_minimal.layout",
          action: "resize-group",
          widgetIds: ["rootFrame:0/Header:0", "rootFrame:0/Title:1"],
          targetBounds: { x: 100, y: 80, width: 640, height: 160 },
          width: 1280,
          height: 720,
        },
      },
    });
    assert.equal(resized.status, 200);
    assert.equal(resized.body.result.structuredContent.transform.action, "resize-group");
    assert.equal(resized.body.result.structuredContent.transform.operationCount, 2);
    assert.equal(resized.body.result.structuredContent.written, false);

    const plugins = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "plugin_sdk_report",
        arguments: {
          projectRoot: "fixtures",
        },
      },
    });
    assert.equal(plugins.status, 200);
    assert.equal(plugins.body.result.structuredContent.kind, "PluginSdkReport");
    assert.equal(plugins.body.result.structuredContent.pluginCount, 1);
    assert.equal(plugins.body.result.structuredContent.contributionCounts.widgetPresets, 1);

    const pluginRuntime = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "plugin-runtime",
      method: "tools/call",
      params: {
        name: "plugin_runtime_registry",
        arguments: {
          projectRoot: "fixtures",
        },
      },
    });
    assert.equal(pluginRuntime.status, 200);
    assert.equal(pluginRuntime.body.result.structuredContent.kind, "PluginRuntimeRegistry");
    assert.equal(pluginRuntime.body.result.structuredContent.widgetPresets[0].id, "sample.tools/sample.tools.badge");

    const pluginPackage = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "plugin-package",
      method: "tools/call",
      params: {
        name: "plugin_runtime_package",
        arguments: {
          projectRoot: "fixtures",
        },
      },
    });
    assert.equal(pluginPackage.status, 200);
    assert.equal(pluginPackage.body.result.structuredContent.kind, "PluginRuntimePackageManifest");
    assert.equal(pluginPackage.body.result.structuredContent.packageSha256.length, 64);

    const pluginVerify = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "plugin-verify",
      method: "tools/call",
      params: {
        name: "plugin_runtime_verify",
        arguments: {
          projectRoot: "fixtures",
          manifest: pluginPackage.body.result.structuredContent,
        },
      },
    });
    assert.equal(pluginVerify.status, 200);
    assert.equal(pluginVerify.body.result.structuredContent.passed, true);

    const pluginCommand = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "plugin-command",
      method: "tools/call",
      params: {
        name: "plugin_runtime_command",
        arguments: {
          projectRoot: "fixtures",
          commandId: "sample.tools/sample.tools.refresh",
          args: { value: "http" },
          manifest: pluginPackage.body.result.structuredContent,
          execute: true,
        },
      },
    });
    assert.equal(pluginCommand.status, 200);
    assert.equal(pluginCommand.body.result.structuredContent.executed, true);
    assert.equal(pluginCommand.body.result.structuredContent.result.value, "http");

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
    const signedPackage = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "plugin-package-signed",
      method: "tools/call",
      params: {
        name: "plugin_runtime_package",
        arguments: {
          projectRoot: "fixtures",
          signPrivateKeyPem: privateKeyPem,
          signPublicKeyPem: publicKeyPem,
          signKeyId: "mcp-http-test",
        },
      },
    });
    assert.equal(signedPackage.status, 200);
    assert.equal(signedPackage.body.result.structuredContent.integrity.signed, true);

    const trustInstall = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "plugin-trust-install",
      method: "tools/call",
      params: {
        name: "plugin_runtime_trust",
        arguments: {
          projectRoot: "fixtures",
          manifest: signedPackage.body.result.structuredContent,
          write: false,
        },
      },
    });
    assert.equal(trustInstall.status, 200);
    assert.equal(trustInstall.body.result.structuredContent.ready, true);
    assert.equal(trustInstall.body.result.structuredContent.key.id, "mcp-http-test");

    const signedCommand = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "plugin-command-signed",
      method: "tools/call",
      params: {
        name: "plugin_runtime_command",
        arguments: {
          projectRoot: "fixtures",
          commandId: "sample.tools/sample.tools.refresh",
          args: { value: "signed-http" },
          manifest: signedPackage.body.result.structuredContent,
          execute: true,
          requireTrusted: true,
          trustPolicy: {
            requireTrusted: true,
            trustedKeys: [{ id: "mcp-http-test", publicKeyPem }],
          },
        },
      },
    });
    assert.equal(signedCommand.status, 200);
    assert.equal(signedCommand.body.result.structuredContent.executed, true);
    assert.equal(signedCommand.body.result.structuredContent.verification.signature.trusted, true);
    assert.equal(signedCommand.body.result.structuredContent.result.value, "signed-http");

    const resources = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "resources-list",
      method: "resources/list",
      params: {},
    });
    assert.equal(resources.status, 200);
    assert.equal(resources.body.result.resources.some((resource) => resource.uri === "dayzui://project/plugin-runtime"), true);
    assert.equal(resources.body.result.resources.some((resource) => resource.uri === "dayzui://project/widget-palette"), true);
    const layoutResource = resources.body.result.resources.find((resource) => resource.uri.includes("arena_bot_minimal.layout"));
    assert.ok(layoutResource);

    const runtimeResource = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "resources-read-runtime",
      method: "resources/read",
      params: {
        uri: "dayzui://project/plugin-runtime",
      },
    });
    assert.equal(runtimeResource.status, 200);
    assert.equal(JSON.parse(runtimeResource.body.result.contents[0].text).kind, "PluginRuntimeRegistry");

    const subscribed = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "resources-subscribe",
      method: "resources/subscribe",
      params: {
        uri: "dayzui://project/widget-palette",
      },
    });
    assert.equal(subscribed.status, 200);
    assert.deepEqual(subscribed.body.result, {});

    const unsubscribed = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "resources-unsubscribe",
      method: "resources/unsubscribe",
      params: {
        uri: "dayzui://project/widget-palette",
      },
    });
    assert.equal(unsubscribed.status, 200);
    assert.deepEqual(unsubscribed.body.result, {});

    const assetIndexResource = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "resources-read-asset-index",
      method: "resources/read",
      params: {
        uri: "dayzui://project/asset-index",
      },
    });
    assert.equal(assetIndexResource.status, 200);
    const assetIndex = JSON.parse(assetIndexResource.body.result.contents[0].text);
    assert.equal(assetIndex.kind, "ProjectAssetIndexResource");
    assert.ok(assetIndex.files.some((file) => file.endsWith("arena_bot_minimal.layout")));

    const paletteResource = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "resources-read-palette",
      method: "resources/read",
      params: {
        uri: "dayzui://project/widget-palette",
      },
    });
    assert.equal(paletteResource.status, 200);
    assert.equal(JSON.parse(paletteResource.body.result.contents[0].text).presets.some((preset) => preset.id === "sample.tools/sample.tools.badge"), true);

    const layoutFileResource = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: "resources-read-layout",
      method: "resources/read",
      params: {
        uri: layoutResource.uri,
      },
    });
    assert.equal(layoutFileResource.status, 200);
    assert.match(layoutFileResource.body.result.contents[0].text, /FrameWidgetClass rootFrame/);

    const fontCoverage = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "font_coverage_report",
        arguments: {
          projectRoot: "fixtures",
          layoutPath: "fixtures/layouts/arena_bot_minimal.layout",
          languages: ["English", "Russian"],
        },
      },
    });
    assert.equal(fontCoverage.status, 200);
    assert.equal(fontCoverage.body.result.structuredContent.kind, "FontCoverageReport");
    assert.equal(fontCoverage.body.result.structuredContent.fontCount > 0, true);

    const prompt = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 7,
      method: "prompts/get",
      params: {
        name: "dayz_ui_safe_edit",
        arguments: {
          layoutFile: "fixtures/layouts/pda_minimal.layout",
          changeRequest: "Move the battery icon 8px right.",
        },
      },
    });
    assert.equal(prompt.status, 200);
    assert.match(prompt.body.result.messages[0].content.text, /dry-run first/i);

    const rejected = await postJsonRpc(port, {
      jsonrpc: "2.0",
      id: 8,
      method: "ping",
      params: {},
    }, { Origin: "https://example.com" });
    assert.equal(rejected.status, 403);
  } finally {
    child.kill();
  }
});

function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForHealth(port, stderr) {
  const deadline = Date.now() + 5000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`MCP HTTP server did not become healthy. ${lastError?.message ?? ""} ${stderr}`);
}

async function postJsonRpc(port, payload, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}
