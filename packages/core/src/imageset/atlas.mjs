import fs from "node:fs";
import path from "node:path";

import { encodePngRgba, readPngRgba } from "../assets/dds.mjs";
import { serializeImageSet } from "./authoring.mjs";

export function packImageAtlas(options = {}) {
  const projectRoot = path.resolve(required(options.projectRoot, "projectRoot"));
  const assetVirtualPath = normalizeVirtualPath(required(options.assetVirtualPath, "assetVirtualPath"));
  const imageSetVirtualPath = normalizeVirtualPath(required(options.imageSetVirtualPath, "imageSetVirtualPath"));
  const setName = options.setName ?? path.basename(imageSetVirtualPath, ".imageset");
  const padding = Math.max(0, Math.floor(Number(options.padding ?? 2)));
  const maxWidth = Math.max(1, Math.floor(Number(options.maxWidth ?? 2048)));
  const powerOfTwo = options.powerOfTwo === true;
  const write = options.write !== false;
  const sources = normalizeSources(options.sources ?? options.images ?? options.sourceImages);
  if (sources.length === 0) throw new Error("At least one source image is required.");

  const sprites = sources.map((source, index) => {
    const sourceImage = path.resolve(required(source.sourceImage ?? source.file ?? source.path, `sources[${index}].sourceImage`));
    const decoded = readPngRgba(sourceImage);
    if (decoded.width > maxWidth) {
      throw new Error(`Source image is wider than maxWidth (${decoded.width} > ${maxWidth}): ${sourceImage}`);
    }
    return {
      sourceImage,
      imageName: source.imageName ?? path.basename(sourceImage, path.extname(sourceImage)),
      className: source.className ?? source.imageName ?? path.basename(sourceImage, path.extname(sourceImage)),
      flags: Number(source.flags ?? options.flags ?? 0),
      width: decoded.width,
      height: decoded.height,
      rgba: decoded.rgba,
      inputIndex: index,
    };
  });

  ensureUniqueSpriteNames(sprites);
  const placements = packShelf(sprites, { maxWidth, padding });
  const usedWidth = Math.max(...placements.map((placement) => placement.x + placement.width), 1);
  const usedHeight = Math.max(...placements.map((placement) => placement.y + placement.height), 1);
  const atlasWidth = powerOfTwo ? nextPowerOfTwo(usedWidth) : usedWidth;
  const atlasHeight = powerOfTwo ? nextPowerOfTwo(usedHeight) : usedHeight;
  const atlasRgba = Buffer.alloc(atlasWidth * atlasHeight * 4, 0);

  for (const placement of placements) {
    blitRgba(placement.sprite.rgba, {
      sourceWidth: placement.width,
      sourceHeight: placement.height,
      target: atlasRgba,
      targetWidth: atlasWidth,
      x: placement.x,
      y: placement.y,
    });
  }

  const imageSet = {
    filePath: path.join(projectRoot, imageSetVirtualPath),
    virtualPath: imageSetVirtualPath,
    name: setName,
    refSize: [atlasWidth, atlasHeight],
    textureRefs: [assetVirtualPath],
    images: placements
      .sort((a, b) => a.sprite.inputIndex - b.sprite.inputIndex)
      .map((placement) => ({
        name: placement.sprite.imageName,
        className: placement.sprite.className,
        pos: [placement.x, placement.y],
        size: [placement.width, placement.height],
        flags: placement.sprite.flags,
      })),
  };
  const source = serializeImageSet(imageSet);
  const atlasPath = path.join(projectRoot, assetVirtualPath);
  const imageSetPath = path.join(projectRoot, imageSetVirtualPath);

  if (write) {
    fs.mkdirSync(path.dirname(atlasPath), { recursive: true });
    fs.writeFileSync(atlasPath, encodePngRgba({ width: atlasWidth, height: atlasHeight, rgba: atlasRgba }));
    fs.mkdirSync(path.dirname(imageSetPath), { recursive: true });
    fs.writeFileSync(imageSetPath, source, "utf8");
  }

  const result = {
    projectRoot,
    assetVirtualPath,
    atlasPath,
    imageSetVirtualPath,
    imageSetPath,
    setName,
    atlas: {
      width: atlasWidth,
      height: atlasHeight,
      usedWidth,
      usedHeight,
      padding,
      maxWidth,
      powerOfTwo,
    },
    placements: placements
      .sort((a, b) => a.sprite.inputIndex - b.sprite.inputIndex)
      .map((placement) => ({
        imageName: placement.sprite.imageName,
        sourceImage: placement.sprite.sourceImage,
        pos: [placement.x, placement.y],
        size: [placement.width, placement.height],
        setRef: `set:${setName} image:${placement.sprite.imageName}`,
      })),
    written: write,
  };
  if (options.includeSource === true || write === false) result.source = source;
  return result;
}

function packShelf(sprites, { maxWidth, padding }) {
  const sorted = [...sprites].sort((a, b) => b.height - a.height || b.width - a.width);
  const placementsBySprite = new Map();
  let x = 0;
  let y = 0;
  let shelfHeight = 0;

  for (const sprite of sorted) {
    if (x > 0 && x + sprite.width > maxWidth) {
      x = 0;
      y += shelfHeight + padding;
      shelfHeight = 0;
    }
    placementsBySprite.set(sprite, {
      sprite,
      x,
      y,
      width: sprite.width,
      height: sprite.height,
    });
    x += sprite.width + padding;
    shelfHeight = Math.max(shelfHeight, sprite.height);
  }

  return sprites.map((sprite) => placementsBySprite.get(sprite));
}

function blitRgba(source, { sourceWidth, sourceHeight, target, targetWidth, x, y }) {
  const rowBytes = sourceWidth * 4;
  for (let row = 0; row < sourceHeight; row += 1) {
    const sourceOffset = row * rowBytes;
    const targetOffset = (((y + row) * targetWidth) + x) * 4;
    source.copy(target, targetOffset, sourceOffset, sourceOffset + rowBytes);
  }
}

function ensureUniqueSpriteNames(sprites) {
  const seen = new Map();
  for (const sprite of sprites) {
    const base = sprite.imageName || "sprite";
    const key = base.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count > 0) {
      sprite.imageName = `${base}_${count + 1}`;
      sprite.className = `${sprite.className}_${count + 1}`;
    }
  }
}

function normalizeSources(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? { sourceImage: item } : item));
  }
  if (typeof value === "string") {
    return value.split(/[|;\n]/).map((item) => item.trim()).filter(Boolean).map((sourceImage) => ({ sourceImage }));
  }
  return [];
}

function normalizeVirtualPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\/+/, "");
}

function nextPowerOfTwo(value) {
  let out = 1;
  while (out < value) out *= 2;
  return out;
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
