import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  decodePngRgba,
  diffPngFiles,
  encodePngRgba,
  readPngRgba,
} from "../src/index.mjs";

test("decodePngRgba round-trips PNGs written by encodePngRgba", () => {
  const rgba = Buffer.from([
    255, 0, 0, 255,
    0, 255, 0, 128,
  ]);
  const png = encodePngRgba({ width: 2, height: 1, rgba });
  const decoded = decodePngRgba(png);

  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);
  assert.deepEqual([...decoded.rgba], [...rgba]);
});

test("diffPngFiles reports pixel differences and writes a diff image", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-pixel-diff-"));
  const expectedPath = path.join(root, "expected.png");
  const actualPath = path.join(root, "actual.png");
  const diffPath = path.join(root, "diff.png");
  const expected = Buffer.from([
    10, 10, 10, 255,
    20, 20, 20, 255,
    30, 30, 30, 255,
    40, 40, 40, 255,
  ]);
  const actual = Buffer.from([
    10, 10, 10, 255,
    25, 20, 20, 255,
    30, 30, 30, 255,
    40, 40, 40, 255,
  ]);
  fs.writeFileSync(expectedPath, encodePngRgba({ width: 2, height: 2, rgba: expected }));
  fs.writeFileSync(actualPath, encodePngRgba({ width: 2, height: 2, rgba: actual }));

  const report = diffPngFiles({
    expectedPath,
    actualPath,
    diffPath,
    tolerance: 1,
  });

  assert.equal(report.passed, false);
  assert.equal(report.summary.totalPixels, 4);
  assert.equal(report.summary.differingPixels, 1);
  assert.equal(report.summary.maxChannelDelta, 5);
  assert.equal(report.diffImage.filePath, diffPath);
  assert.equal(readPngRgba(diffPath).width, 2);
});

test("diffPngFiles passes when pixel deltas are within tolerance", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dzui-pixel-tolerance-"));
  const expectedPath = path.join(root, "expected.png");
  const actualPath = path.join(root, "actual.png");
  fs.writeFileSync(expectedPath, encodePngRgba({
    width: 1,
    height: 1,
    rgba: Buffer.from([100, 100, 100, 255]),
  }));
  fs.writeFileSync(actualPath, encodePngRgba({
    width: 1,
    height: 1,
    rgba: Buffer.from([102, 100, 100, 255]),
  }));

  const report = diffPngFiles({ expectedPath, actualPath, tolerance: 2 });

  assert.equal(report.passed, true);
  assert.equal(report.summary.differingPixels, 0);
});
