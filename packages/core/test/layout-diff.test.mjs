import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLayoutDiffReport,
  diffLayoutSources,
  parseLayout,
} from "../src/index.mjs";

test("buildLayoutDiffReport reports structural and property changes", () => {
  const beforeSource = `FrameWidgetClass Root {
 position 0 0
 size 1 1
 {
  ImageWidgetClass Body {
   position 0.1 0.1
   size 0.4 0.4
  }
  TextWidgetClass Title {
   position 0.2 0.2
   size 0.3 0.05
   text Old
  }
  ImageWidgetClass Removed {
   position 0.9 0.9
   size 0.05 0.05
  }
 }
}
`;
  const afterSource = `FrameWidgetClass Root {
 position 0 0
 size 1 1
 {
  ImageWidgetClass Body {
   position 0.12 0.1
   size 0.4 0.4
   {
    TextWidgetClass Title {
     position 0.2 0.2
     size 0.3 0.05
     text New
    }
   }
  }
  ImageWidgetClass Added {
   position 0.8 0.8
   size 0.05 0.05
  }
 }
}
`;
  const report = diffLayoutSources(beforeSource, afterSource, {
    beforeFilePath: "before.layout",
    afterFilePath: "after.layout",
  });

  assert.equal(report.passed, false);
  assert.equal(report.summary.matchedWidgets, 3);
  assert.equal(report.summary.addedWidgets, 1);
  assert.equal(report.summary.removedWidgets, 1);
  assert.equal(report.summary.changedWidgets, 2);
  assert.equal(report.summary.parentChanges, 1);
  assert.equal(report.summary.propertyChanges, 2);
  assert.equal(report.addedWidgets[0].name, "Added");
  assert.equal(report.removedWidgets[0].name, "Removed");

  const titleChange = report.changedWidgets.find((widget) => widget.before.name === "Title");
  assert.ok(titleChange);
  assert.ok(titleChange.changes.some((change) => change.kind === "widget.parent.changed"));
  assert.ok(titleChange.changes.some((change) => change.kind === "property.changed" && change.key === "text"));

  const bodyChange = report.changedWidgets.find((widget) => widget.before.name === "Body");
  assert.ok(bodyChange.changes.some((change) => change.kind === "property.changed" && change.key === "position"));
});

test("buildLayoutDiffReport passes unchanged layouts", () => {
  const source = `FrameWidgetClass Root {
 size 1 1
}
`;
  const before = parseLayout(source, { filePath: "same-before.layout" });
  const after = parseLayout(source, { filePath: "same-after.layout" });
  const report = buildLayoutDiffReport(before, after);

  assert.equal(report.passed, true);
  assert.equal(report.summary.totalChanges, 0);
  assert.equal(report.summary.changedWidgets, 0);
});
