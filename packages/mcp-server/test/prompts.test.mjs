import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("MCP stdio exposes prompt templates and renders prompt arguments", async () => {
  const child = spawn(process.execPath, [
    "packages/mcp-server/src/server.mjs",
    "--project",
    "fixtures",
  ], {
    cwd: path.resolve("."),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  try {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "prompts/list", params: {} })}\n`);
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "prompts/get",
      params: {
        name: "dayz_ui_layout_review",
        arguments: {
          projectRoot: "fixtures",
          layoutFile: "fixtures/layouts/pda_minimal.layout",
        },
      },
    })}\n`);
    const responses = await waitForResponses(() => stdout, 2, stderr);
    const listed = responses.find((message) => message.id === 1);
    const rendered = responses.find((message) => message.id === 2);

    assert.equal(listed.result.prompts.some((prompt) => prompt.name === "dayz_ui_layout_review"), true);
    assert.equal(listed.result.prompts.some((prompt) => prompt.name.includes("engine")), false);
    assert.match(rendered.result.messages[0].content.text, /layout_validate/);
    assert.match(rendered.result.messages[0].content.text, /fixtures\/layouts\/pda_minimal\.layout/);
  } finally {
    child.kill();
  }
});

test("MCP stdio emits resource notifications for subscribed project writes", async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-mcp-resources-"));
  const layoutDir = path.join(projectRoot, "layouts");
  fs.mkdirSync(layoutDir, { recursive: true });
  const layoutPath = path.join(layoutDir, "test.layout");
  fs.writeFileSync(layoutPath, `FrameWidgetClass Root {
 position 0 0
 size 1 1
 {
  TextWidgetClass Label {
   position 0 0
   size 0.2 0.05
   text "Old"
  }
 }
}
`, "utf8");

  const child = spawn(process.execPath, [
    "packages/mcp-server/src/server.mjs",
    "--project",
    projectRoot,
  ], {
    cwd: path.resolve("."),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  try {
    const fileUri = `dayzui://project/file?path=${encodeURIComponent("layouts/test.layout")}`;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: "init", method: "initialize", params: {} })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: "subscribe", method: "resources/subscribe", params: { uri: fileUri } })}\n`);
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: "update",
      method: "tools/call",
      params: {
        name: "layout_update_property",
        arguments: {
          file: layoutPath,
          widgetId: "Root:0/Label:0",
          key: "text",
          values: ["New"],
          write: true,
        },
      },
    })}\n`);

    const updatedMessages = await waitForMessages(() => stdout, (messages) => (
      messages.some((message) => message.id === "init" && message.result?.capabilities?.resources?.subscribe === true)
        && messages.some((message) => message.id === "subscribe" && message.result)
        && messages.some((message) => message.id === "update" && message.result?.structuredContent?.written === true)
        && messages.some((message) => message.method === "notifications/resources/updated" && message.params?.uri === fileUri)
    ), stderr);
    assert.equal(updatedMessages.some((message) => message.method === "notifications/resources/updated"), true);

    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: "imageset",
      method: "tools/call",
      params: {
        name: "imageset_upsert",
        arguments: {
          file: path.join(projectRoot, "gui", "imagesets", "generated.imageset"),
          setName: "generated",
          textureRef: "gui/data/generated.edds",
          imageName: "slot",
          size: [32, 32],
          write: true,
        },
      },
    })}\n`);

    const listChangedMessages = await waitForMessages(() => stdout, (messages) => (
      messages.some((message) => message.id === "imageset" && message.result?.structuredContent?.written === true)
        && messages.some((message) => message.method === "notifications/resources/list_changed")
    ), stderr);
    assert.equal(listChangedMessages.some((message) => message.method === "notifications/resources/list_changed"), true);
  } finally {
    child.kill();
  }
});

async function waitForResponses(readStdout, count, stderr) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const responses = readStdout()
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if (responses.length >= count) return responses;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for MCP stdio responses. ${stderr}`);
}

async function waitForMessages(readStdout, predicate, stderr) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const messages = readStdout()
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if (predicate(messages)) return messages;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for MCP stdio messages. ${stderr}\n${readStdout()}`);
}
