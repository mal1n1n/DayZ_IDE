import fs from "node:fs";
import path from "node:path";

import { parseImageSet } from "./parser.mjs";

export function serializeImageSet(imageSet) {
  const textureRefs = imageSet.textureRefs?.length ? imageSet.textureRefs : [];
  const images = imageSet.images ?? [];
  const refSize = imageSet.refSize ?? inferRefSize(images);
  const lines = [];

  lines.push(`ImageSetClass ${safeClassName(imageSet.name ?? "imageset")} {`);
  lines.push(` Name "${escapeString(imageSet.name ?? "imageset")}"`);
  if (refSize) lines.push(` RefSize ${formatNumber(refSize[0])} ${formatNumber(refSize[1])}`);
  lines.push(" Textures {");
  textureRefs.forEach((textureRef, index) => {
    lines.push(`  ImageSetTextureClass Texture${index} {`);
    lines.push(`   path "${escapeString(textureRef)}"`);
    lines.push("  }");
  });
  lines.push(" }");
  lines.push(" Images {");
  for (const image of images) {
    const className = image.className ?? image.name;
    lines.push(`  ImageSetDefClass "${escapeString(className)}" {`);
    lines.push(`   Name "${escapeString(image.name)}"`);
    if (image.pos) lines.push(`   Pos ${formatNumber(image.pos[0])} ${formatNumber(image.pos[1])}`);
    if (image.size) lines.push(`   Size ${formatNumber(image.size[0])} ${formatNumber(image.size[1])}`);
    lines.push(`   Flags ${Number.isFinite(image.flags) ? image.flags : 0}`);
    lines.push("  }");
  }
  lines.push(" }");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

export function upsertImageSetSprite(content, options = {}) {
  const imageSet = content?.trim()
    ? parseImageSet(content, options)
    : {
      filePath: options.filePath ?? null,
      virtualPath: options.virtualPath ?? null,
      name: options.setName ?? "data",
      refSize: options.refSize ?? null,
      textureRefs: [],
      images: [],
    };
  const textureRef = required(options.textureRef, "textureRef");
  const imageName = required(options.imageName, "imageName");
  const pos = normalizePair(options.pos ?? [0, 0], "pos");
  const size = normalizePair(options.size ?? imageSet.refSize ?? [0, 0], "size");
  const flags = Number(options.flags ?? 0);

  imageSet.name = options.setName ?? imageSet.name;
  imageSet.refSize = options.refSize ?? imageSet.refSize ?? size;
  if (!imageSet.textureRefs.some((ref) => ref.toLowerCase() === textureRef.toLowerCase())) {
    imageSet.textureRefs.push(textureRef);
  }

  const existing = imageSet.images.find((image) => image.name.toLowerCase() === imageName.toLowerCase());
  const nextImage = {
    name: imageName,
    className: options.className ?? imageName,
    pos,
    size,
    flags: Number.isFinite(flags) ? flags : 0,
  };
  if (existing) {
    Object.assign(existing, nextImage);
  } else {
    imageSet.images.push(nextImage);
  }

  return {
    imageSet,
    source: serializeImageSet(imageSet),
    setRef: `set:${imageSet.name} image:${imageName}`,
    inserted: !existing,
  };
}

export function importImageAsset(options = {}) {
  const projectRoot = path.resolve(required(options.projectRoot, "projectRoot"));
  const sourceImage = path.resolve(required(options.sourceImage, "sourceImage"));
  const assetVirtualPath = normalizeVirtualPath(required(options.assetVirtualPath, "assetVirtualPath"));
  const imageSetVirtualPath = normalizeVirtualPath(required(options.imageSetVirtualPath, "imageSetVirtualPath"));
  const write = options.write !== false;
  const setName = options.setName ?? path.basename(imageSetVirtualPath, ".imageset");
  const imageName = options.imageName ?? path.basename(assetVirtualPath, path.extname(assetVirtualPath));
  const targetImagePath = path.join(projectRoot, assetVirtualPath);
  const imageSetPath = path.join(projectRoot, imageSetVirtualPath);
  const dimensions = readImageDimensions(sourceImage);
  const size = options.size ?? (dimensions ? [dimensions.width, dimensions.height] : [0, 0]);
  const pos = options.pos ?? [0, 0];

  const current = fs.existsSync(imageSetPath) ? fs.readFileSync(imageSetPath, "utf8") : "";
  const updated = upsertImageSetSprite(current, {
    filePath: imageSetPath,
    virtualPath: imageSetVirtualPath,
    setName,
    textureRef: assetVirtualPath,
    imageName,
    pos,
    size,
    refSize: options.refSize ?? size,
    flags: options.flags ?? 0,
  });

  if (write) {
    fs.mkdirSync(path.dirname(targetImagePath), { recursive: true });
    fs.copyFileSync(sourceImage, targetImagePath);
    fs.mkdirSync(path.dirname(imageSetPath), { recursive: true });
    fs.writeFileSync(imageSetPath, updated.source, "utf8");
  }

  const result = {
    projectRoot,
    sourceImage,
    targetImagePath,
    assetVirtualPath,
    imageSetPath,
    imageSetVirtualPath,
    dimensions,
    setRef: updated.setRef,
    inserted: updated.inserted,
    written: write,
  };
  if (options.includeSource === true) result.source = updated.source;
  return result;
}

export function readImageDimensions(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return readPngDimensions(filePath);
  return null;
}

export function readPngDimensions(filePath) {
  const header = Buffer.alloc(24);
  const fd = fs.openSync(filePath, "r");
  try {
    const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
    if (bytesRead < 24) return null;
    const pngSignature = "89504e470d0a1a0a";
    if (header.subarray(0, 8).toString("hex") !== pngSignature) return null;
    if (header.toString("ascii", 12, 16) !== "IHDR") return null;
    return {
      width: header.readUInt32BE(16),
      height: header.readUInt32BE(20),
    };
  } finally {
    fs.closeSync(fd);
  }
}

function inferRefSize(images) {
  if (!images.length) return null;
  const maxX = Math.max(...images.map((image) => (image.pos?.[0] ?? 0) + (image.size?.[0] ?? 0)));
  const maxY = Math.max(...images.map((image) => (image.pos?.[1] ?? 0) + (image.size?.[1] ?? 0)));
  return [maxX, maxY];
}

function normalizePair(value, name) {
  if (!Array.isArray(value) || value.length < 2) throw new Error(`${name} must be a pair.`);
  const pair = [Number(value[0]), Number(value[1])];
  if (!Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) throw new Error(`${name} must contain finite numbers.`);
  return pair;
}

function normalizeVirtualPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\/+/, "");
}

function safeClassName(value) {
  const text = String(value).replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(text) ? text : `_${text}`;
}

function escapeString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function formatNumber(value) {
  return Number(value).toString();
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
