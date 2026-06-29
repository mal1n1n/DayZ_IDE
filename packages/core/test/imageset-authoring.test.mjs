import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";

import {
  encodePngRgba,
  importImageAsset,
  packImageAtlas,
  parseImageSet,
  readPngRgba,
  readPngDimensions,
  upsertImageSetSprite,
} from "../src/index.mjs";

test("upsertImageSetSprite creates and updates a sprite definition", () => {
  const created = upsertImageSetSprite("", {
    setName: "data",
    textureRef: "gui/data/atlas.png",
    imageName: "battery",
    pos: [1, 2],
    size: [16, 8],
  });
  const updated = upsertImageSetSprite(created.source, {
    setName: "data",
    textureRef: "gui/data/atlas.png",
    imageName: "battery",
    pos: [4, 5],
    size: [32, 10],
  });
  const parsed = parseImageSet(updated.source);

  assert.equal(created.inserted, true);
  assert.equal(updated.inserted, false);
  assert.equal(parsed.name, "data");
  assert.equal(parsed.images.length, 1);
  assert.deepEqual(parsed.images[0].pos, [4, 5]);
  assert.deepEqual(parsed.images[0].size, [32, 10]);
});

test("importImageAsset copies a PNG and updates a project imageset", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-image-import-"));
  const source = path.join(root, "source.png");
  fs.writeFileSync(source, makePng({ width: 3, height: 2 }));

  const imported = importImageAsset({
    projectRoot: root,
    sourceImage: source,
    assetVirtualPath: "gui/data/imported.png",
    imageSetVirtualPath: "gui/data/data.imageset",
    setName: "data",
    imageName: "imported",
  });
  const parsed = parseImageSet(fs.readFileSync(imported.imageSetPath, "utf8"));

  assert.deepEqual(readPngDimensions(source), { width: 3, height: 2 });
  assert.equal(fs.existsSync(path.join(root, "gui/data/imported.png")), true);
  assert.equal(imported.setRef, "set:data image:imported");
  assert.equal(parsed.textureRefs[0], "gui/data/imported.png");
  assert.deepEqual(parsed.images[0].size, [3, 2]);
});

test("importImageAsset can dry-run without writing project files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-image-dry-run-"));
  const source = path.join(root, "source.png");
  fs.writeFileSync(source, makePng({ width: 5, height: 4 }));

  const imported = importImageAsset({
    projectRoot: root,
    sourceImage: source,
    assetVirtualPath: "gui/data/planned.png",
    imageSetVirtualPath: "gui/data/data.imageset",
    imageName: "planned",
    write: false,
    includeSource: true,
  });

  assert.equal(imported.written, false);
  assert.deepEqual(imported.dimensions, { width: 5, height: 4 });
  assert.equal(fs.existsSync(path.join(root, "gui/data/planned.png")), false);
  assert.equal(fs.existsSync(path.join(root, "gui/data/data.imageset")), false);
  assert.match(imported.source, /Name "planned"/);
});

test("packImageAtlas writes a packed PNG atlas and imageset", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-atlas-pack-"));
  const first = path.join(root, "first.png");
  const second = path.join(root, "second.png");
  fs.writeFileSync(first, makeSolidPng({ width: 4, height: 2, rgba: [255, 0, 0, 255] }));
  fs.writeFileSync(second, makeSolidPng({ width: 2, height: 3, rgba: [0, 255, 0, 255] }));

  const packed = packImageAtlas({
    projectRoot: root,
    sources: [
      { sourceImage: first, imageName: "first" },
      { sourceImage: second, imageName: "second" },
    ],
    assetVirtualPath: "gui/data/atlas.png",
    imageSetVirtualPath: "gui/data/data.imageset",
    setName: "data",
    maxWidth: 16,
    padding: 1,
  });
  const parsed = parseImageSet(fs.readFileSync(packed.imageSetPath, "utf8"));
  const atlas = readPngRgba(packed.atlasPath);

  assert.equal(packed.written, true);
  assert.equal(fs.existsSync(path.join(root, "gui/data/atlas.png")), true);
  assert.equal(parsed.name, "data");
  assert.deepEqual(parsed.textureRefs, ["gui/data/atlas.png"]);
  assert.equal(parsed.images.length, 2);
  assert.deepEqual(parsed.images.find((image) => image.name === "first").size, [4, 2]);
  assert.deepEqual(parsed.refSize, [packed.atlas.width, packed.atlas.height]);
  assert.equal(atlas.width, packed.atlas.width);
  assert.equal(atlas.height, packed.atlas.height);
});

test("packImageAtlas can dry-run and emit imageset source without writing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-atlas-dry-run-"));
  const source = path.join(root, "icon.png");
  fs.writeFileSync(source, makePng({ width: 3, height: 2 }));

  const packed = packImageAtlas({
    projectRoot: root,
    sourceImages: [source],
    assetVirtualPath: "gui/data/atlas.png",
    imageSetVirtualPath: "gui/data/data.imageset",
    write: false,
  });

  assert.equal(packed.written, false);
  assert.equal(fs.existsSync(path.join(root, "gui/data/atlas.png")), false);
  assert.equal(fs.existsSync(path.join(root, "gui/data/data.imageset")), false);
  assert.match(packed.source, /ImageSetClass data/);
  assert.match(packed.source, /Name "icon"/);
});

function makePng({ width, height }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeSolidPng({ width, height, rgba }) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = rgba[0];
    pixels[offset + 1] = rgba[1];
    pixels[offset + 2] = rgba[2];
    pixels[offset + 3] = rgba[3];
  }
  return encodePngRgba({ width, height, rgba: pixels });
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(0, 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}
