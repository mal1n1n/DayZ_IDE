import fs from "node:fs";
import path from "node:path";

import { encodePngRgba, readPngRgba } from "../assets/dds.mjs";

export function buildPixelDiffReport(expectedImage, actualImage, options = {}) {
  const tolerance = positiveNumber(options.tolerance, 0);
  const ignoreAlpha = options.ignoreAlpha === true;
  const width = Math.max(expectedImage.width, actualImage.width);
  const height = Math.max(expectedImage.height, actualImage.height);
  const totalPixels = width * height;
  const comparedPixels = Math.min(expectedImage.width, actualImage.width) * Math.min(expectedImage.height, actualImage.height);
  const diffRgba = options.includeDiffImage === true ? Buffer.alloc(totalPixels * 4) : null;
  let differingPixels = 0;
  let maxChannelDelta = 0;
  let totalPixelDelta = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const expected = readPixel(expectedImage, x, y);
      const actual = readPixel(actualImage, x, y);
      const outside = !expected || !actual;
      const delta = outside ? [255, 255, 255, ignoreAlpha ? 0 : 255] : [
        Math.abs(expected[0] - actual[0]),
        Math.abs(expected[1] - actual[1]),
        Math.abs(expected[2] - actual[2]),
        ignoreAlpha ? 0 : Math.abs(expected[3] - actual[3]),
      ];
      const pixelDelta = Math.max(...delta);
      const differs = outside || pixelDelta > tolerance;
      if (differs) {
        differingPixels += 1;
        totalPixelDelta += pixelDelta;
        maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
      }
      if (diffRgba) writeDiffPixel(diffRgba, width, x, y, differs, pixelDelta);
    }
  }

  const dimensionMismatch = expectedImage.width !== actualImage.width || expectedImage.height !== actualImage.height;
  return {
    kind: "DzuiPixelDiffReport",
    tolerance,
    ignoreAlpha,
    passed: differingPixels === 0 && !dimensionMismatch,
    expected: {
      filePath: expectedImage.filePath ?? null,
      width: expectedImage.width,
      height: expectedImage.height,
    },
    actual: {
      filePath: actualImage.filePath ?? null,
      width: actualImage.width,
      height: actualImage.height,
    },
    summary: {
      totalPixels,
      comparedPixels,
      differingPixels,
      mismatchRatio: totalPixels ? Number((differingPixels / totalPixels).toFixed(6)) : 0,
      maxChannelDelta,
      averageDifferingDelta: differingPixels ? Number((totalPixelDelta / differingPixels).toFixed(3)) : 0,
      dimensionMismatch,
    },
    diffImage: diffRgba ? { width, height, rgba: diffRgba } : null,
  };
}

export function diffPngFiles(options = {}) {
  const expectedPath = path.resolve(requiredString(options.expectedPath, "expectedPath"));
  const actualPath = path.resolve(requiredString(options.actualPath, "actualPath"));
  const expected = { ...readPngRgba(expectedPath), filePath: expectedPath };
  const actual = { ...readPngRgba(actualPath), filePath: actualPath };
  const report = buildPixelDiffReport(expected, actual, {
    tolerance: options.tolerance,
    ignoreAlpha: options.ignoreAlpha,
    includeDiffImage: Boolean(options.diffPath),
  });
  const diffPath = options.diffPath ? path.resolve(options.diffPath) : null;
  if (diffPath && report.diffImage) {
    fs.mkdirSync(path.dirname(diffPath), { recursive: true });
    fs.writeFileSync(diffPath, encodePngRgba(report.diffImage));
  }

  return {
    ...report,
    diffImage: diffPath ? {
      filePath: diffPath,
      width: report.diffImage.width,
      height: report.diffImage.height,
    } : null,
  };
}

function readPixel(image, x, y) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const offset = ((y * image.width) + x) * 4;
  return [
    image.rgba[offset],
    image.rgba[offset + 1],
    image.rgba[offset + 2],
    image.rgba[offset + 3],
  ];
}

function writeDiffPixel(rgba, width, x, y, differs, delta) {
  const offset = ((y * width) + x) * 4;
  if (!differs) {
    rgba[offset] = 0;
    rgba[offset + 1] = 0;
    rgba[offset + 2] = 0;
    rgba[offset + 3] = 0;
    return;
  }
  rgba[offset] = 255;
  rgba[offset + 1] = Math.max(0, 180 - delta);
  rgba[offset + 2] = 0;
  rgba[offset + 3] = 255;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
