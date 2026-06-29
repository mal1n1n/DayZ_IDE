import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildProjectAssetIndex,
  decodeDdsRgba,
  discoverExternalPreviewDecoder,
  discoverTexconvPath,
  encodePngRgba,
  ensureDecodedPreviewAsset,
  readDdsHeader,
  resolveAsset,
  resolveImageReference,
} from "../src/index.mjs";

test("buildProjectAssetIndex resolves raw, GUID, and imageset image refs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-assets-"));
  const headerPath = path.join(root, "MG_Arena/gui/data/header.edds");
  const atlasPath = path.join(root, "MG_StalkerPDA/gui/data/data.edds");
  const imageSetPath = path.join(root, "MG_StalkerPDA/gui/data/data.imageset");

  fs.mkdirSync(path.dirname(headerPath), { recursive: true });
  fs.mkdirSync(path.dirname(atlasPath), { recursive: true });
  fs.writeFileSync(headerPath, makeDdsHeader({ width: 1024, height: 256, bits: 32 }));
  fs.writeFileSync(atlasPath, makeDdsHeader({ width: 512, height: 512, bits: 32 }));
  fs.writeFileSync(`${headerPath}.meta`, `MetaFileClass {
 Name "{759C43E52C345E70}MG_Arena/gui/data/header.edds"
 Configurations {
  PNGResourceClass PC {
   SourceFile "header.png"
  }
 }
}
`);
  fs.writeFileSync(imageSetPath, `ImageSetClass data {
 Name "data"
 RefSize 512 512
 Textures {
  ImageSetTextureClass Texture0 {
   path "MG_StalkerPDA/gui/data/data.edds"
  }
 }
 Images {
  ImageSetDefClass "New GroupCenter" {
   Name "battery"
   Pos 10 20
   Size 30 40
   Flags 0
  }
 }
}
`);

  const index = buildProjectAssetIndex(root);

  assert.equal(index.edds.length, 2);
  assert.equal(index.imageSets.length, 1);
  assert.deepEqual(readDdsHeader(headerPath), {
    readable: true,
    width: 1024,
    height: 256,
    mipMapCount: 1,
    format: "32bpp",
  });

  assert.equal(resolveAsset("MG_Arena/gui/data/header.edds", index).virtualPath, "MG_Arena/gui/data/header.edds");
  assert.equal(
    resolveAsset("{759C43E52C345E70}MG_Arena/gui/data/header.edds", index).virtualPath,
    "MG_Arena/gui/data/header.edds",
  );

  const setResolution = resolveImageReference("set:data image:battery", index);
  assert.equal(setResolution.ok, true);
  assert.equal(setResolution.mode, "imageset");
  assert.equal(setResolution.image.name, "battery");
  assert.deepEqual(setResolution.image.pos, [10, 20]);
  assert.deepEqual(setResolution.image.size, [30, 40]);
  assert.equal(setResolution.texture.virtualPath, "MG_StalkerPDA/gui/data/data.edds");
});

function makeDdsHeader({ width, height, bits, fourCc = "" }) {
  const header = Buffer.alloc(128);
  header.write("DDS ", 0, "ascii");
  header.writeUInt32LE(124, 4);
  header.writeUInt32LE(height, 12);
  header.writeUInt32LE(width, 16);
  header.writeUInt32LE(width * 4, 20);
  header.writeUInt32LE(1, 28);
  header.writeUInt32LE(32, 76);
  header.writeUInt32LE(0x41, 80);
  if (fourCc) header.write(fourCc, 84, "ascii");
  header.writeUInt32LE(bits, 88);
  header.writeUInt32LE(0x00ff0000, 92);
  header.writeUInt32LE(0x0000ff00, 96);
  header.writeUInt32LE(0x000000ff, 100);
  header.writeUInt32LE(0xff000000, 104);
  return header;
}

function makeDx10DdsHeader({ width, height, dxgiFormat }) {
  const header = Buffer.concat([makeDdsHeader({ width, height, bits: 0, fourCc: "DX10" }), Buffer.alloc(20)]);
  header.writeUInt32LE(dxgiFormat, 128);
  header.writeUInt32LE(3, 132);
  header.writeUInt32LE(0, 136);
  header.writeUInt32LE(1, 140);
  header.writeUInt32LE(0, 144);
  return header;
}

function makeDxtColorBlock({ color0, color1, indices }) {
  const block = Buffer.alloc(8);
  block.writeUInt16LE(color0, 0);
  block.writeUInt16LE(color1, 2);
  let packed = 0;
  indices.forEach((index, pixelIndex) => {
    packed |= (index & 0x03) << (pixelIndex * 2);
  });
  block.writeUInt32LE(packed >>> 0, 4);
  return block;
}

function writeDxt5AlphaIndices(buffer, offset, indices) {
  let packed = 0n;
  indices.forEach((index, pixelIndex) => {
    packed |= BigInt(index & 0x07) << BigInt(pixelIndex * 3);
  });
  for (let byteIndex = 0; byteIndex < 6; byteIndex += 1) {
    buffer[offset + byteIndex] = Number((packed >> BigInt(byteIndex * 8)) & 0xffn);
  }
}

test("buildProjectAssetIndex can resolve vanilla DayZ paths and builtin imagesets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-project-assets-"));
  const vanillaRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-vanilla-assets-"));
  const vanillaPath = path.join(vanillaRoot, "DZ/gui/data/logo.edds");
  const texturePath = path.join(vanillaRoot, "gui/data/dayz_gui.edds");
  const imageSetPath = path.join(vanillaRoot, "gui/data/dayz_gui.imageset");

  fs.mkdirSync(path.dirname(vanillaPath), { recursive: true });
  fs.mkdirSync(path.dirname(texturePath), { recursive: true });
  fs.writeFileSync(vanillaPath, makeDdsHeader({ width: 64, height: 32, bits: 32 }));
  fs.writeFileSync(texturePath, makeDdsHeader({ width: 128, height: 128, bits: 32 }));
  fs.writeFileSync(imageSetPath, `ImageSetClass dayz_gui {
 Name "dayz_gui"
 Textures {
  ImageSetTextureClass Texture0 {
   path "gui/data/dayz_gui.edds"
  }
 }
 Images {
  ImageSetDefClass "close" {
   Name "close"
   Pos 0 0
   Size 16 16
   Flags 0
  }
 }
}`);

  const index = buildProjectAssetIndex(root, { vanillaRoots: [vanillaRoot] });
  const pathResolution = resolveImageReference("DZ/gui/data/logo.edds", index);
  const setResolution = resolveImageReference("set:dayz_gui image:close", index);

  assert.equal(pathResolution.ok, true);
  assert.equal(pathResolution.source, "vanilla");
  assert.equal(pathResolution.mode, "virtual");
  assert.equal(setResolution.ok, true);
  assert.equal(setResolution.external, undefined);
  assert.equal(setResolution.mode, "imageset");
  assert.equal(setResolution.imageSet.source, "vanilla");
  assert.equal(setResolution.texture.source, "vanilla");
});

test("decodeDdsRgba and ensureDecodedPreviewAsset convert uncompressed 32bpp DDS to PNG", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-dds-"));
  const ddsPath = path.join(root, "sample.edds");
  const pngPath = path.join(root, "cache", "sample.png");
  const pixels = Buffer.alloc(8);
  pixels.writeUInt32LE(0xffff0000, 0);
  pixels.writeUInt32LE(0xff00ff00, 4);
  fs.writeFileSync(ddsPath, Buffer.concat([makeDdsHeader({ width: 2, height: 1, bits: 32 }), pixels]));

  const decoded = decodeDdsRgba(fs.readFileSync(ddsPath));
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);
  assert.deepEqual([...decoded.rgba], [255, 0, 0, 255, 0, 255, 0, 255]);

  const png = encodePngRgba(decoded);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const cached = ensureDecodedPreviewAsset(ddsPath, { outputPath: pngPath });
  assert.equal(cached.ok, true);
  assert.equal(fs.existsSync(pngPath), true);
});

test("decodeDdsRgba and ensureDecodedPreviewAsset convert DXT1 DDS blocks natively", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-dds-dxt1-"));
  const ddsPath = path.join(root, "compressed.edds");
  const pngPath = path.join(root, "cache", "compressed.png");
  const block = makeDxtColorBlock({
    color0: 0xf800,
    color1: 0x07e0,
    indices: new Array(16).fill(0),
  });
  fs.writeFileSync(ddsPath, Buffer.concat([
    makeDdsHeader({ width: 4, height: 4, bits: 0, fourCc: "DXT1" }),
    block,
  ]));

  const decoded = decodeDdsRgba(fs.readFileSync(ddsPath));
  assert.equal(decoded.width, 4);
  assert.equal(decoded.height, 4);
  assert.equal(decoded.format, "DXT1");
  assert.deepEqual([...decoded.rgba.subarray(0, 8)], [255, 0, 0, 255, 255, 0, 0, 255]);

  const cached = ensureDecodedPreviewAsset(ddsPath, { outputPath: pngPath });
  assert.equal(cached.ok, true);
  assert.equal(cached.decoder, "native-dds-dxt1");
  assert.equal(fs.existsSync(pngPath), true);
});

test("decodeDdsRgba converts DXT5 alpha blocks natively", () => {
  const block = Buffer.alloc(16);
  block[0] = 10;
  block[1] = 250;
  writeDxt5AlphaIndices(block, 2, [7, 6, ...new Array(14).fill(0)]);
  makeDxtColorBlock({
    color0: 0x001f,
    color1: 0x0000,
    indices: new Array(16).fill(0),
  }).copy(block, 8);

  const decoded = decodeDdsRgba(Buffer.concat([
    makeDdsHeader({ width: 4, height: 4, bits: 0, fourCc: "DXT5" }),
    block,
  ]));

  assert.equal(decoded.format, "DXT5");
  assert.deepEqual([...decoded.rgba.subarray(0, 8)], [0, 0, 255, 255, 0, 0, 255, 0]);
});

test("ensureDecodedPreviewAsset can fall back to an external decoder command", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-external-decoder-"));
  const ddsPath = path.join(root, "compressed.edds");
  const pngPath = path.join(root, "cache", "compressed.png");
  const fakeDecoderPath = path.join(root, "fake-decoder.mjs");
  const png = encodePngRgba({
    width: 1,
    height: 1,
    rgba: Buffer.from([12, 34, 56, 255]),
  });

  fs.writeFileSync(ddsPath, makeDdsHeader({ width: 4, height: 4, bits: 0, fourCc: "BC7 " }));
  fs.writeFileSync(fakeDecoderPath, `
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true });
fs.writeFileSync(process.argv[2], Buffer.from("${png.toString("base64")}", "base64"));
`);

  const decoded = ensureDecodedPreviewAsset(ddsPath, {
    outputPath: pngPath,
    externalDecoder: {
      name: "fake-decoder",
      command: process.execPath,
      args: [fakeDecoderPath, "{output}"],
    },
  });

  assert.equal(decoded.ok, true);
  assert.equal(decoded.decoder, "fake-decoder");
  assert.match(decoded.nativeReason, /Unsupported compressed DDS format/);
  assert.equal(fs.existsSync(pngPath), true);
});

test("DX10 BC7 DDS headers report BC7 and can use an external sidecar decoder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-bc7-sidecar-"));
  const ddsPath = path.join(root, "bc7.edds");
  const pngPath = path.join(root, "cache", "bc7.png");
  const fakeDecoderPath = path.join(root, "fake-bc7-decoder.mjs");
  const png = encodePngRgba({
    width: 1,
    height: 1,
    rgba: Buffer.from([90, 80, 70, 255]),
  });

  fs.writeFileSync(ddsPath, Buffer.concat([makeDx10DdsHeader({ width: 4, height: 4, dxgiFormat: 98 }), Buffer.alloc(16)]));
  fs.writeFileSync(fakeDecoderPath, `
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true });
fs.writeFileSync(process.argv[2], Buffer.from("${png.toString("base64")}", "base64"));
`);

  assert.deepEqual(readDdsHeader(ddsPath), {
    readable: true,
    width: 4,
    height: 4,
    mipMapCount: 1,
    format: "BC7_UNORM",
    dxgiFormat: 98,
  });

  const decoded = ensureDecodedPreviewAsset(ddsPath, {
    outputPath: pngPath,
    externalDecoder: {
      name: "fake-bc7-decoder",
      command: process.execPath,
      args: [fakeDecoderPath, "{output}"],
    },
  });

  assert.equal(decoded.ok, true);
  assert.equal(decoded.decoder, "fake-bc7-decoder");
  assert.match(decoded.nativeReason, /BC7_UNORM/);
  assert.equal(fs.existsSync(pngPath), true);
});

test("PAA preview assets can be decoded through an external sidecar decoder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-paa-sidecar-"));
  const paaPath = path.join(root, "texture.paa");
  const pngPath = path.join(root, "cache", "texture.png");
  const fakeDecoderPath = path.join(root, "fake-paa-decoder.mjs");
  const png = encodePngRgba({
    width: 1,
    height: 1,
    rgba: Buffer.from([1, 2, 3, 255]),
  });
  fs.writeFileSync(paaPath, "paa");
  fs.writeFileSync(fakeDecoderPath, `
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync(path.dirname(process.argv[3]), { recursive: true });
fs.writeFileSync(process.argv[3], Buffer.from("${png.toString("base64")}", "base64"));
`);

  const decoded = ensureDecodedPreviewAsset(paaPath, {
    outputPath: pngPath,
    externalDecoder: {
      name: "fake-paa-decoder",
      command: process.execPath,
      args: [fakeDecoderPath, "{input}", "{output}"],
    },
  });

  assert.equal(decoded.ok, true);
  assert.equal(decoded.decoder, "fake-paa-decoder");
  assert.match(decoded.nativeReason, /external decoder/);
  assert.equal(fs.existsSync(pngPath), true);
});

test("discoverExternalPreviewDecoder reads JSON sidecar configuration", () => {
  const decoder = discoverExternalPreviewDecoder({
    externalDecoderJson: JSON.stringify({
      name: "json-decoder",
      command: "decoder",
      args: ["{input}", "{output}"],
    }),
  });

  assert.equal(decoder.name, "json-decoder");
  assert.deepEqual(decoder.args, ["{input}", "{output}"]);
});

test("discoverTexconvPath finds a configured executable on PATH", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-texconv-discovery-"));
  const executable = path.join(root, "texconv-test.exe");
  fs.writeFileSync(executable, "");

  assert.equal(discoverTexconvPath({
    executableName: "texconv-test.exe",
    envPath: root,
  }), executable);
});
