import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildLayoutPreviewModel,
  parseLayout,
  renderPreviewHtml,
} from "../src/index.mjs";

test("buildLayoutPreviewModel computes relative widget boxes", () => {
  const document = parseLayout(`FrameWidgetClass PDAFrame {
 position 0 0
 size 1 1
 {
  ImageWidgetClass Body {
   position 0.1 0.08
   size 0.8 0.84
   image0 "MG_StalkerPDA/gui/data/kpk_1280.edds"
  }
  ImageWidgetClass Scratches {
   position 0.099167 0.078521
   size 0.650126 0.563424
   image0 "MG_StalkerPDA/gui/data/kpk_1280_potertosti.edds"
  }
  ImageWidgetClass Battery {
   position 0.74 0.14
   size 0.04 0.025
   image0 "set:data image:battery"
  }
 }
}`, { filePath: "inline-pda.layout" });
  const model = buildLayoutPreviewModel(document, { width: 1280, height: 720 });
  const body = model.nodes.find((node) => node.name === "Body");
  const battery = model.nodes.find((node) => node.name === "Battery");

  assert.equal(model.nodes.length, 4);
  assert.deepEqual(model.viewport, { width: 1280, height: 720 });
  assertBoxClose(body.box, { x: 128, y: 57.6, width: 1024, height: 604.8 });
  assertBoxClose(battery.box, { x: 947.2, y: 100.8, width: 51.2, height: 18 });
  assert.equal(battery.images.length, 1);
  assert.equal(battery.images[0].ref, "set:data image:battery");
  assert.equal(battery.parentId, "PDAFrame:0");
  assertBoxClose(battery.parentBox, { x: 0, y: 0, width: 1280, height: 720 });
});

test("renderPreviewHtml emits a standalone canvas preview document", () => {
  const document = parseLayout(`FrameWidgetClass PDAFrame {
 size 1 1
 {
  ImageWidgetClass Battery {
   position 0.74 0.14
   size 0.04 0.025
   image0 "set:data image:battery"
  }
 }
}`, { filePath: "inline-pda.layout" });
  const model = buildLayoutPreviewModel(document, { width: 800, height: 450 });
  const html = renderPreviewHtml(model, { title: "pda_minimal.layout" });

  assert.match(html, /<canvas id="canvas"><\/canvas>/);
  assert.match(html, /pda_minimal\.layout/);
  assert.match(html, /set:data image:battery/);
});

test("buildLayoutPreviewModel localizes stringtable text by language", () => {
  const document = parseLayout(`TextWidgetClass Title {
 text "#STR_TITLE"
}`);
  const projectIndex = {
    stringTable: {
      get(key) {
        if (String(key).toLowerCase().replace(/^#/, "") !== "str_title") return null;
        return {
          values: {
            English: "Title",
            Russian: "RU Title",
          },
        };
      },
    },
  };
  const model = buildLayoutPreviewModel(document, { projectIndex, language: "Russian" });

  assert.equal(model.nodes[0].textRaw, "#STR_TITLE");
  assert.equal(model.nodes[0].text, "RU Title");
});

test("buildLayoutPreviewModel simulates widget preview states", () => {
  const document = parseLayout(`TextWidgetClass Action {
 text "Run"
 color 0.1 0.2 0.3 1
 hovercolor 0.2 0.5 0.8 1
 selectedcolor 1 0.8 0.2 1
 disabledcolor 0.4 0.4 0.4 1
}`);

  const hover = buildLayoutPreviewModel(document, { previewState: "hover" }).nodes[0];
  const selected = buildLayoutPreviewModel(document, { previewState: "selected" }).nodes[0];
  const disabled = buildLayoutPreviewModel(document, { previewState: "disabled" }).nodes[0];

  assert.deepEqual(hover.renderColor, [0.2, 0.5, 0.8, 1]);
  assert.equal(hover.state.effective, "hover");
  assert.deepEqual(selected.renderColor, [1, 0.8, 0.2, 1]);
  assert.deepEqual(disabled.renderColor, [0.4, 0.4, 0.4, 1]);
});

function assertBoxClose(actual, expected) {
  for (const key of ["x", "y", "width", "height"]) {
    assert.equal(Number(actual[key].toFixed(3)), Number(expected[key].toFixed(3)));
  }
}
