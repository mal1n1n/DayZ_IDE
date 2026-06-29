import assert from "node:assert/strict";
import test from "node:test";

import {
  instantiateWidgetPreset,
  listWidgetPalette,
} from "../src/index.mjs";

test("listWidgetPalette returns categorized DayZ widget presets", () => {
  const palette = listWidgetPalette();

  assert.equal(palette.kind, "WidgetPalette");
  assert.ok(palette.count >= 8);
  assert.ok(palette.categories.includes("Container"));
  assert.ok(palette.categories.includes("Text"));
  assert.ok(palette.categories.includes("HUD"));
  assert.ok(palette.categories.includes("Inventory"));
  assert.ok(palette.presets.some((preset) => preset.id === "image.icon"));
});

test("listWidgetPalette filters presets by query", () => {
  const palette = listWidgetPalette({ query: "button" });

  assert.ok(palette.count >= 3);
  assert.ok(palette.presets.some((preset) => preset.id === "control.button"));
  assert.ok(palette.presets.some((preset) => preset.id === "dialog.primary-button"));
  assert.ok(palette.presets.every((preset) => preset.label.toLowerCase().includes("button") || preset.id.includes("button")));
});

test("instantiateWidgetPreset merges names and property overrides", () => {
  const widget = instantiateWidgetPreset("text.label", {
    name: "StatusText",
    props: {
      text: "Ready",
      size: [0.3, 0.04],
    },
  });

  assert.equal(widget.ok, true);
  assert.equal(widget.typeClass, "TextWidgetClass");
  assert.equal(widget.name, "StatusText");
  assert.deepEqual(widget.props.size, [0.3, 0.04]);
  assert.equal(widget.props.text, "Ready");
  assert.deepEqual(widget.props.color, [1, 1, 1, 1]);
});

test("widget palette includes plugin runtime presets when project root is provided", () => {
  const palette = listWidgetPalette({ projectRoot: "fixtures", query: "sample badge" });

  assert.equal(palette.pluginRuntime.ready, true);
  assert.equal(palette.pluginRuntime.widgetPresetCount, 1);
  assert.equal(palette.presets.some((preset) => preset.id === "sample.tools/sample.tools.badge"), true);

  const widget = instantiateWidgetPreset("sample.tools/sample.tools.badge", {
    projectRoot: "fixtures",
    name: "PluginBadge",
  });
  assert.equal(widget.ok, true);
  assert.equal(widget.typeClass, "TextWidgetClass");
  assert.equal(widget.name, "PluginBadge");
  assert.equal(widget.props.text[0], "Sample");
});
