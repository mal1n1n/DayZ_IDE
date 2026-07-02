import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { mcpChildEnvironment, startDesktopServer } from "../../../apps/desktop/src/server.mjs";

test("desktop MCP launcher forces Electron helper into Node mode", () => {
  const env = mcpChildEnvironment({
    PATH: "example-path",
    ELECTRON_RUN_AS_NODE: "0",
  });

  assert.equal(env.PATH, "example-path");
  assert.equal(env.ELECTRON_RUN_AS_NODE, "1");
});

test("desktop native texture endpoint serves decoded preview PNG", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-desktop-texture-"));
  const texturePath = path.join(root, "broken.edds");
  const decoderPath = path.join(root, "fake-decoder.mjs");
  fs.writeFileSync(texturePath, "not a real dds");
  fs.writeFileSync(decoderPath, `
import fs from "node:fs";
const out = process.argv[3];
fs.writeFileSync(out, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5pq0wAAAABJRU5ErkJggg==", "base64"));
`);

  const previousDecoderJson = process.env.DZUI_PREVIEW_DECODER_JSON;
  process.env.DZUI_PREVIEW_DECODER_JSON = JSON.stringify({
    name: "fake-png-decoder",
    command: process.execPath,
    args: [decoderPath, "{input}", "{output}"],
  });

  const started = await startDesktopServer({
    host: "127.0.0.1",
    port: 0,
    log: false,
  });

  try {
    const url = new URL(`http://127.0.0.1:${started.port}/api/texture/native`);
    url.searchParams.set("file", texturePath);
    url.searchParams.set("project", root);
    const response = await fetch(url);
    const bytes = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("x-dzui-texture-decoder"), "fake-png-decoder");
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
    if (previousDecoderJson === undefined) {
      delete process.env.DZUI_PREVIEW_DECODER_JSON;
    } else {
      process.env.DZUI_PREVIEW_DECODER_JSON = previousDecoderJson;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
