import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLayoutPatch,
  buildLayoutDiffReport,
  buildLayoutPreviewModel,
  generateLayoutPatchFromSources,
  hashSource,
  parseLayout,
  resolveLayoutPatchConflicts,
} from "../src/index.mjs";

const pdaLayoutSource = `FrameWidgetClass PDAFrame {
 position 0 0
 size 1 1
 {
  ImageWidgetClass Body {
   position 0.1 0.08
   size 0.656786 0.650686
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
}
`;

test("applyLayoutPatch applies source-preserving widget and property operations", () => {
  const filePath = "inline-pda.layout";
  const source = pdaLayoutSource;
  const result = applyLayoutPatch(source, {
    label: "Patch PDA layout",
    beforeHash: hashSource(source),
    operations: [
      {
        op: "updateProperty",
        widgetId: "PDAFrame:0/Battery:2",
        key: "visible",
        values: [0],
      },
      {
        op: "createWidget",
        parentWidgetId: "PDAFrame:0",
        typeClass: "TextWidgetClass",
        name: "PatchStatus",
        props: {
          position: [0.12, 0.84],
          size: [0.3, 0.05],
          text: "Patched",
        },
      },
      {
        op: "reparentWidget",
        widgetName: "PatchStatus",
        parentWidgetId: "PDAFrame:0/Body:0",
      },
      {
        op: "updateBox",
        widgetName: "PatchStatus",
        position: [0.2, 0.2],
        size: [0.25, 0.04],
      },
      {
        op: "deleteWidget",
        widgetId: "PDAFrame:0/Scratches:1",
      },
    ],
  }, {
    filePath,
    includeSource: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.operationCount, 5);
  assert.equal(result.appliedCount, 5);
  assert.equal(result.changed, true);
  assert.notEqual(result.beforeHash, result.afterHash);
  assert.match(result.source, /visible 0/);
  assert.match(result.source, /TextWidgetClass PatchStatus/);
  assert.match(result.source, /position 0\.2 0\.2/);
  assert.doesNotMatch(result.source, /ImageWidgetClass Scratches/);

  const document = parseLayout(result.source, { filePath });
  assert.deepEqual(document.diagnostics, []);
  const model = buildLayoutPreviewModel(document);
  const patchStatus = model.nodes.find((node) => node.name === "PatchStatus");
  assert.equal(patchStatus.parentId, "PDAFrame:0/Body:0");
});

test("applyLayoutPatch rejects mismatched beforeHash before applying operations", () => {
  const source = `FrameWidgetClass Root {
 size 1 1
}
`;
  const result = applyLayoutPatch(source, {
    beforeHash: "not-the-current-hash",
    operations: [
      {
        op: "updateProperty",
        widgetId: "Root:0",
        key: "size",
        values: [0.5, 0.5],
      },
    ],
  }, {
    includeSource: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.appliedCount, 0);
  assert.equal(result.reason, "Patch beforeHash does not match the current source.");
  assert.equal(result.source, source);
});

test("applyLayoutPatch stops on a failing operation without reporting success", () => {
  const source = `FrameWidgetClass Root {
 size 1 1
}
`;
  const result = applyLayoutPatch(source, {
    operations: [
      {
        op: "updateProperty",
        widgetId: "Root:0",
        key: "size",
        values: [0.5, 0.5],
      },
      {
        op: "deleteWidget",
        widgetId: "Missing:0",
      },
    ],
  }, {
    includeSource: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.appliedCount, 1);
  assert.equal(result.failedAt, 1);
  assert.match(result.source, /size 0\.5 0\.5/);
  assert.match(result.reason, /Widget not found/);
});

test("generateLayoutPatchFromSources creates an applicable structural patch", () => {
  const beforeSource = `FrameWidgetClass Root {
 size 1 1
 {
  TextWidgetClass Title {
   position 0.1 0.1
   size 0.3 0.05
   visible 1
   text Old
  }
  ImageWidgetClass Removed {
   position 0.8 0.8
   size 0.1 0.1
  }
 }
}
`;
  const afterSource = `FrameWidgetClass Root {
 size 1 1
 {
  TextWidgetClass Title {
   position 0.1 0.1
   size 0.3 0.05
   text New
  }
  TextWidgetClass Added {
   position 0.2 0.2
   size 0.2 0.05
   text Added
  }
 }
}
`;
  const patch = generateLayoutPatchFromSources(beforeSource, afterSource, {
    beforeFilePath: "before.layout",
    afterFilePath: "after.layout",
    label: "generated patch test",
  });

  assert.equal(patch.beforeHash, hashSource(beforeSource));
  assert.equal(patch.afterHash, hashSource(afterSource));
  assert.equal(patch.conflicts.length, 0);
  assert.deepEqual(patch.operations.map((operation) => operation.op), [
    "deleteWidget",
    "insertWidgetSource",
    "updateProperty",
    "removeProperty",
  ]);

  const applied = applyLayoutPatch(beforeSource, patch, { includeSource: true });
  assert.equal(applied.ok, true);
  const report = buildLayoutDiffReport(
    parseLayout(applied.source, { filePath: "patched.layout" }),
    parseLayout(afterSource, { filePath: "after.layout" }),
  );
  assert.equal(report.passed, true);
});

test("resolveLayoutPatchConflicts records explicit conflict decisions", () => {
  const patch = {
    kind: "LayoutPatch",
    operations: [{ op: "updateProperty", widgetName: "Title", key: "text", values: ["New"] }],
    conflicts: [
      {
        code: "reparent.target-unmatched",
        message: "Cannot safely reparent to an unmatched added parent.",
        widget: { id: "Root:0/Title:0", name: "Title", typeClass: "TextWidgetClass" },
      },
    ],
  };

  const resolved = resolveLayoutPatchConflicts(patch, {
    defaultAction: "skip",
    resolvedAt: "2026-06-29T00:00:00.000Z",
    note: "Keep generated non-conflicting operations.",
  });

  assert.equal(resolved.conflicts.length, 0);
  assert.equal(resolved.resolvedConflicts.length, 1);
  assert.equal(resolved.resolvedConflicts[0].resolution.action, "skip");
  assert.equal(resolved.resolvedConflicts[0].resolution.note, "Keep generated non-conflicting operations.");
  assert.deepEqual(resolved.operations, patch.operations);
  assert.deepEqual(resolved.resolutionSummary, {
    totalConflicts: 1,
    resolvedConflicts: 1,
    unresolvedConflicts: 0,
    defaultAction: "skip",
  });
});

test("resolveLayoutPatchConflicts can keep selected conflicts unresolved", () => {
  const patch = {
    kind: "LayoutPatch",
    operations: [],
    conflicts: [
      { code: "a", widget: { id: "Root:0/A:0", name: "A" } },
      { code: "b", widget: { id: "Root:0/B:0", name: "B" } },
    ],
  };

  const resolved = resolveLayoutPatchConflicts(patch, {
    defaultAction: "skip",
    decisions: [{ widgetName: "B", action: "unresolved" }],
    resolvedAt: "2026-06-29T00:00:00.000Z",
  });

  assert.equal(resolved.conflicts.length, 1);
  assert.equal(resolved.conflicts[0].widget.name, "B");
  assert.equal(resolved.resolvedConflicts.length, 1);
  assert.equal(resolved.resolvedConflicts[0].widget.name, "A");
  assert.equal(resolved.resolutionSummary.unresolvedConflicts, 1);
});
