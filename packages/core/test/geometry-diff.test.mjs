import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildGeometryDiffReport,
  buildLayoutPreviewModel,
  parseLayout,
} from "../src/index.mjs";

const pdaLayoutSource = `FrameWidgetClass PDAFrame {
 position 0 0
 size 1 1
 {
  ImageWidgetClass Body {
   position 0.1 0.08
   size 0.8 0.84
  }
  ImageWidgetClass Battery {
   position 0.74 0.14
   size 0.04 0.025
  }
 }
}
`;

test("buildGeometryDiffReport reports matched, shifted, missing, and extra engine nodes", () => {
  const document = parseLayout(pdaLayoutSource, { filePath: "inline-pda.layout" });
  const model = buildLayoutPreviewModel(document, { width: 1280, height: 720 });
  const body = model.nodes.find((node) => node.name === "Body");
  const battery = model.nodes.find((node) => node.name === "Battery");
  const engineDump = {
    kind: "DzuiEngineGeometryDump",
    viewport: model.viewport,
    widgets: [
      {
        id: body.id,
        name: body.name,
        typeClass: body.typeClass,
        box: body.box,
      },
      {
        id: battery.id,
        name: battery.name,
        typeClass: battery.typeClass,
        box: {
          ...battery.box,
          x: battery.box.x + 4,
        },
      },
      {
        id: "engine-only:0",
        name: "EngineOnly",
        typeClass: "FrameWidgetClass",
        box: { x: 1, y: 2, width: 3, height: 4 },
      },
    ],
  };

  const report = buildGeometryDiffReport(model, engineDump, { tolerancePx: 1 });

  assert.equal(report.passed, false);
  assert.equal(report.summary.matched, 2);
  assert.equal(report.summary.mismatches, 1);
  assert.equal(report.summary.missingInPreview, 1);
  assert.equal(report.mismatches[0].name, "Battery");
  assert.equal(report.mismatches[0].delta.x, 4);
  assert.equal(report.missingInPreview[0].name, "EngineOnly");
  assert.ok(report.summary.missingInEngine >= 1);
});

test("buildGeometryDiffReport passes within tolerance using unique widget names", () => {
  const filePath = path.resolve("fixtures/layouts/arena_bot_minimal.layout");
  const document = parseLayout(fs.readFileSync(filePath, "utf8"), { filePath });
  const model = buildLayoutPreviewModel(document, { width: 1000, height: 500 });
  const widgets = model.nodes.map((node) => ({
    name: node.name,
    typeClass: node.typeClass,
    box: {
      x: node.box.x + 0.25,
      y: node.box.y,
      width: node.box.width,
      height: node.box.height,
    },
  }));

  const report = buildGeometryDiffReport(model, { widgets }, { tolerancePx: 0.5 });

  assert.equal(report.passed, true);
  assert.equal(report.summary.matched, model.nodes.length);
  assert.equal(report.summary.mismatches, 0);
});
