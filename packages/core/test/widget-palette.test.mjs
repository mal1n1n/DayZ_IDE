import assert from "node:assert/strict";
import test from "node:test";

import {
  instantiateWidgetPreset,
  listWidgetPalette,
  editorWidgetPalettePresets,
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

test("editor palette covers default DayZ widget classes except MapWidget", () => {
  const expectedTypes = [
    "ButtonWidgetClass",
    "CheckBoxWidgetClass",
    "ContentWidgetClass",
    "EditBoxWidgetClass",
    "EmbededWidgetClass",
    "FrameWidgetClass",
    "ImageWidgetClass",
    "MultilineEditBoxWidgetClass",
    "MultilineTextWidgetClass",
    "PanelWidgetClass",
    "PasswordEditBoxWidgetClass",
    "ProgressBarWidgetClass",
    "RichTextWidgetClass",
    "SimpleProgressBarWidgetClass",
    "SliderWidgetClass",
    "TextListboxWidgetClass",
    "TextWidgetClass",
    "WindowWidgetClass",
    "XComboBoxWidgetClass",
    "HtmlWidgetClass",
    "ItemPreviewWidgetClass",
    "PlayerPreviewWidgetClass",
    "ServerBrowserWidgetClass",
    "SmartPanelWidgetClass",
    "ThreeStateCheckboxWidgetClass",
    "GridSpacerWidgetClass",
    "ScrollWidgetClass",
    "WrapSpacerWidgetClass",
    "CanvasWidgetClass",
    "GenericListboxWidgetClass",
    "RenderTargetWidgetClass",
    "RTTextureWidgetClass",
    "UniversalListboxWidgetClass",
    "VideoWidgetClass",
  ];
  const paletteTypes = new Set(editorWidgetPalettePresets.map((preset) => preset.typeClass));

  assert.deepEqual(
    expectedTypes.filter((typeClass) => !paletteTypes.has(typeClass)),
    [],
  );
  assert.equal(paletteTypes.has("MapWidgetClass"), false);
});

test("editor widget presets create immediately visible fixed-size widgets", () => {
  const widget = instantiateWidgetPreset("editor.progressbar", {
    name: "ProgressBarWidget0",
  });

  assert.equal(widget.ok, true);
  assert.equal(widget.typeClass, "ProgressBarWidgetClass");
  assert.deepEqual(widget.props.size, [48, 48]);
  assert.deepEqual(widget.props.hexactsize, [1]);
  assert.deepEqual(widget.props.current, [0.65]);
  assert.deepEqual(widget.props.color, [0.25, 0.85, 0.62, 1]);
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
