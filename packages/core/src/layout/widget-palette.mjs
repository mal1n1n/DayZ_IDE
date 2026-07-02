import { buildPluginRuntimeRegistry } from "../plugins/sdk.mjs";

const editorWidgetTypes = [
  { typeClass: "ButtonWidgetClass", category: "Controls", label: "Button", defaultName: "ButtonWidget", props: { text: "Button" } },
  { typeClass: "CheckBoxWidgetClass", category: "Controls", label: "Check Box", defaultName: "CheckBoxWidget" },
  { typeClass: "ContentWidgetClass", category: "Container", label: "Content", defaultName: "ContentWidget", props: { ignorepointer: [1], color: [0.14, 0.16, 0.16, 0.55] } },
  { typeClass: "EditBoxWidgetClass", category: "Inputs", label: "Edit Box", defaultName: "EditBoxWidget", props: { text: "Edit" } },
  { typeClass: "EmbededWidgetClass", category: "Container", label: "Embedded", defaultName: "EmbededWidget", props: { ignorepointer: [1], color: [0.18, 0.2, 0.22, 0.55] } },
  { typeClass: "FrameWidgetClass", category: "Container", label: "Frame", defaultName: "FrameWidget", props: { ignorepointer: [1], color: [0.12, 0.14, 0.14, 0.65] } },
  { typeClass: "ImageWidgetClass", category: "Image", label: "Image", defaultName: "ImageWidget", props: { ignorepointer: [1], color: [0.28, 0.54, 0.46, 0.55], image0: "" } },
  { typeClass: "MultilineEditBoxWidgetClass", category: "Inputs", label: "Multiline Edit Box", defaultName: "MultilineEditBoxWidget", props: { text: "Edit" } },
  { typeClass: "MultilineTextWidgetClass", category: "Text", label: "Multiline Text", defaultName: "MultilineTextWidget", props: { ignorepointer: [1], text: "Multiline text", color: [1, 1, 1, 1] } },
  { typeClass: "PanelWidgetClass", category: "Container", label: "Panel", defaultName: "PanelWidget", props: { ignorepointer: [1], color: [0.14, 0.14, 0.14, 0.75] } },
  { typeClass: "PasswordEditBoxWidgetClass", category: "Inputs", label: "Password Edit Box", defaultName: "PasswordEditBoxWidget", props: { text: "Password" } },
  { typeClass: "ProgressBarWidgetClass", category: "Controls", label: "Progress Bar", defaultName: "ProgressBarWidget", props: { ignorepointer: [1], current: [0.65], min: [0], max: [1], color: [0.25, 0.85, 0.62, 1] } },
  { typeClass: "RichTextWidgetClass", category: "Text", label: "Rich Text", defaultName: "RichTextWidget", props: { ignorepointer: [1], text: "Rich text", color: [1, 1, 1, 1] } },
  { typeClass: "SimpleProgressBarWidgetClass", category: "Controls", label: "Simple Progress Bar", defaultName: "SimpleProgressBarWidget", props: { ignorepointer: [1], current: [0.65], min: [0], max: [1], color: [0.25, 0.85, 0.62, 1] } },
  { typeClass: "SliderWidgetClass", category: "Inputs", label: "Slider", defaultName: "SliderWidget", props: { current: [0.5], min: [0], max: [1] } },
  { typeClass: "TextListboxWidgetClass", category: "Lists", label: "Text Listbox", defaultName: "TextListboxWidget", props: { text: "List item" } },
  { typeClass: "TextWidgetClass", category: "Text", label: "Text", defaultName: "TextWidget", props: { ignorepointer: [1], text: "Text", color: [1, 1, 1, 1] } },
  { typeClass: "WindowWidgetClass", category: "Container", label: "Window", defaultName: "WindowWidget", props: { ignorepointer: [1], color: [0.1, 0.12, 0.12, 0.8] } },
  { typeClass: "XComboBoxWidgetClass", category: "Inputs", label: "X Combo Box", defaultName: "XComboBoxWidget", props: { text: "Option" } },
  { typeClass: "HtmlWidgetClass", category: "Special", label: "HTML", defaultName: "HtmlWidget", props: { ignorepointer: [1], text: "HTML", color: [1, 1, 1, 1] } },
  { typeClass: "ItemPreviewWidgetClass", category: "Preview", label: "Item Preview", defaultName: "ItemPreviewWidget", props: { ignorepointer: [1], color: [0.18, 0.2, 0.22, 0.65] } },
  { typeClass: "PlayerPreviewWidgetClass", category: "Preview", label: "Player Preview", defaultName: "PlayerPreviewWidget", props: { ignorepointer: [1], color: [0.18, 0.2, 0.22, 0.65] } },
  { typeClass: "ServerBrowserWidgetClass", category: "Special", label: "Server Browser", defaultName: "ServerBrowserWidget", props: { text: "Server" } },
  { typeClass: "SmartPanelWidgetClass", category: "Container", label: "Smart Panel", defaultName: "SmartPanelWidget", props: { ignorepointer: [1], color: [0.14, 0.16, 0.16, 0.7] } },
  { typeClass: "ThreeStateCheckboxWidgetClass", category: "Controls", label: "Three State Checkbox", defaultName: "ThreeStateCheckboxWidget" },
  { typeClass: "GridSpacerWidgetClass", category: "Spacers", label: "Grid Spacer", defaultName: "GridSpacerWidget", props: { ignorepointer: [1], color: [0.12, 0.14, 0.14, 0.4] } },
  { typeClass: "ScrollWidgetClass", category: "Container", label: "Scroll", defaultName: "ScrollWidget", props: { ignorepointer: [1], color: [0.12, 0.14, 0.14, 0.45] } },
  { typeClass: "WrapSpacerWidgetClass", category: "Spacers", label: "Wrap Spacer", defaultName: "WrapSpacerWidget", props: { ignorepointer: [1], color: [0.12, 0.14, 0.14, 0.4] } },
  { typeClass: "CanvasWidgetClass", category: "Special", label: "Canvas", defaultName: "CanvasWidget", props: { ignorepointer: [1], color: [0.16, 0.17, 0.18, 0.5] } },
  { typeClass: "GenericListboxWidgetClass", category: "Lists", label: "Generic Listbox", defaultName: "GenericListboxWidget", props: { text: "List item" } },
  { typeClass: "RenderTargetWidgetClass", category: "Special", label: "Render Target", defaultName: "RenderTargetWidget", props: { ignorepointer: [1], color: [0.18, 0.2, 0.22, 0.65] } },
  { typeClass: "RTTextureWidgetClass", category: "Special", label: "RT Texture", defaultName: "RTTextureWidget", props: { ignorepointer: [1], color: [0.18, 0.2, 0.22, 0.65] } },
  { typeClass: "UniversalListboxWidgetClass", category: "Lists", label: "Universal Listbox", defaultName: "UniversalListboxWidget", props: { text: "List item" } },
  { typeClass: "VideoWidgetClass", category: "Special", label: "Video", defaultName: "VideoWidget", props: { ignorepointer: [1], color: [0.18, 0.2, 0.22, 0.65] } },
];

const editorDefaultProps = {
  position: [0, 0],
  size: [48, 48],
  hexactpos: [1],
  vexactpos: [1],
  hexactsize: [1],
  vexactsize: [1],
};

export const editorWidgetPalettePresets = editorWidgetTypes.map((preset) => ({
  id: `editor.${preset.typeClass.replace(/WidgetClass$/i, "").replace(/Class$/i, "").toLowerCase()}`,
  description: `${preset.label} with Editor default size and visible preview properties.`,
  ...preset,
  props: {
    ...editorDefaultProps,
    ...preset.props,
  },
}));

export const widgetPalettePresets = [
  ...editorWidgetPalettePresets,
  {
    id: "container.frame",
    label: "Frame",
    category: "Container",
    typeClass: "FrameWidgetClass",
    defaultName: "Frame",
    description: "Generic container for grouping child widgets.",
    props: {
      position: [0, 0],
      size: [0.25, 0.25],
    },
  },
  {
    id: "container.panel",
    label: "Panel",
    category: "Container",
    typeClass: "PanelWidgetClass",
    defaultName: "Panel",
    description: "Full-size panel container.",
    props: {
      position: [0, 0],
      size: [1, 1],
      color: [0.14, 0.14, 0.14, 0.75],
      ignorepointer: [1],
    },
  },
  {
    id: "text.label",
    label: "Label",
    category: "Text",
    typeClass: "TextWidgetClass",
    defaultName: "Label",
    description: "Small text label.",
    props: {
      position: [0, 0],
      size: [0.24, 0.05],
      text: "Label",
      color: [1, 1, 1, 1],
    },
  },
  {
    id: "text.header",
    label: "Header Text",
    category: "Text",
    typeClass: "TextWidgetClass",
    defaultName: "Header",
    description: "Larger title text.",
    props: {
      position: [0, 0],
      size: [0.42, 0.08],
      text: "Header",
      color: [1, 1, 1, 1],
      font: "gui/fonts/Metron-Bold28",
    },
  },
  {
    id: "image.icon",
    label: "Icon Image",
    category: "Image",
    typeClass: "ImageWidgetClass",
    defaultName: "Icon",
    description: "Small image slot for icons or imageset sprites.",
    props: {
      position: [0, 0],
      size: [0.08, 0.08],
      image0: "",
    },
  },
  {
    id: "image.background",
    label: "Background Image",
    category: "Image",
    typeClass: "ImageWidgetClass",
    defaultName: "Background",
    description: "Full-size image layer.",
    props: {
      position: [0, 0],
      size: [1, 1],
      image0: "",
      ignorepointer: [1],
    },
  },
  {
    id: "control.button",
    label: "Button",
    category: "Controls",
    typeClass: "ButtonWidgetClass",
    defaultName: "Button",
    description: "Clickable button widget.",
    props: {
      position: [0, 0],
      size: [0.2, 0.06],
      text: "Button",
    },
  },
  {
    id: "control.checkbox",
    label: "Checkbox",
    category: "Controls",
    typeClass: "CheckBoxWidgetClass",
    defaultName: "Checkbox",
    description: "Boolean toggle widget.",
    props: {
      position: [0, 0],
      size: [0.04, 0.04],
    },
  },
  {
    id: "container.scroll",
    label: "Scroll Area",
    category: "Container",
    typeClass: "ScrollWidgetClass",
    defaultName: "ScrollArea",
    description: "Scrollable child container.",
    props: {
      position: [0, 0],
      size: [0.4, 0.4],
    },
  },
  {
    id: "hud.status-icon",
    label: "HUD Status Icon",
    category: "HUD",
    typeClass: "ImageWidgetClass",
    defaultName: "StatusIcon",
    description: "Small HUD icon slot for health, blood, stamina, or custom status indicators.",
    props: {
      position: [0, 0],
      size: [0.035, 0.035],
      image0: "",
      ignorepointer: [1],
    },
  },
  {
    id: "hud.status-text",
    label: "HUD Status Text",
    category: "HUD",
    typeClass: "TextWidgetClass",
    defaultName: "StatusText",
    description: "Compact HUD value label next to a status icon.",
    props: {
      position: [0, 0],
      size: [0.12, 0.035],
      text: "100",
      color: [1, 1, 1, 1],
      ignorepointer: [1],
    },
  },
  {
    id: "hud.progress",
    label: "HUD Progress Bar",
    category: "HUD",
    typeClass: "ProgressBarWidgetClass",
    defaultName: "StatusBar",
    description: "Horizontal progress bar for stamina, cooldowns, or interaction progress.",
    props: {
      position: [0, 0],
      size: [0.18, 0.018],
      current: [1],
      min: [0],
      max: [1],
      color: [0.25, 0.85, 0.62, 1],
      ignorepointer: [1],
    },
  },
  {
    id: "inventory.slot",
    label: "Inventory Slot",
    category: "Inventory",
    typeClass: "FrameWidgetClass",
    defaultName: "ItemSlot",
    description: "Square inventory slot frame for item grids and quick bars.",
    props: {
      position: [0, 0],
      size: [0.08, 0.08],
      color: [0.08, 0.09, 0.09, 0.85],
    },
  },
  {
    id: "inventory.item-icon",
    label: "Item Icon",
    category: "Inventory",
    typeClass: "ImageWidgetClass",
    defaultName: "ItemIcon",
    description: "Image slot sized for an inventory item sprite.",
    props: {
      position: [0.01, 0.01],
      size: [0.06, 0.06],
      image0: "",
      ignorepointer: [1],
    },
  },
  {
    id: "inventory.quantity",
    label: "Quantity Label",
    category: "Inventory",
    typeClass: "TextWidgetClass",
    defaultName: "Quantity",
    description: "Small lower-corner item count label.",
    props: {
      position: [0.045, 0.055],
      size: [0.03, 0.018],
      text: "1",
      halign: "right",
      color: [1, 1, 1, 1],
      ignorepointer: [1],
    },
  },
  {
    id: "list.row",
    label: "List Row",
    category: "Lists",
    typeClass: "FrameWidgetClass",
    defaultName: "ListRow",
    description: "Horizontal row frame for inventory, server, or settings lists.",
    props: {
      position: [0, 0],
      size: [0.5, 0.055],
      color: [0.12, 0.14, 0.14, 0.9],
    },
  },
  {
    id: "list.row-text",
    label: "Row Text",
    category: "Lists",
    typeClass: "TextWidgetClass",
    defaultName: "RowText",
    description: "Text label aligned for a dense list row.",
    props: {
      position: [0.015, 0.01],
      size: [0.35, 0.035],
      text: "Row",
      color: [1, 1, 1, 1],
    },
  },
  {
    id: "dialog.title",
    label: "Dialog Title",
    category: "Dialog",
    typeClass: "TextWidgetClass",
    defaultName: "DialogTitle",
    description: "Title text for modals and menu panels.",
    props: {
      position: [0, 0],
      size: [0.42, 0.06],
      text: "Title",
      color: [1, 1, 1, 1],
      font: "gui/fonts/Metron-Bold28",
    },
  },
  {
    id: "dialog.body",
    label: "Dialog Body Text",
    category: "Dialog",
    typeClass: "TextWidgetClass",
    defaultName: "DialogBody",
    description: "Readable body copy block for menus and prompts.",
    props: {
      position: [0, 0],
      size: [0.5, 0.16],
      text: "Body text",
      color: [0.9, 0.94, 0.92, 1],
    },
  },
  {
    id: "dialog.primary-button",
    label: "Primary Button",
    category: "Dialog",
    typeClass: "ButtonWidgetClass",
    defaultName: "PrimaryButton",
    description: "Primary menu action button.",
    props: {
      position: [0, 0],
      size: [0.18, 0.055],
      text: "Apply",
    },
  },
  {
    id: "dialog.close-button",
    label: "Close Button",
    category: "Dialog",
    typeClass: "ButtonWidgetClass",
    defaultName: "CloseButton",
    description: "Compact close/back button for panels.",
    props: {
      position: [0, 0],
      size: [0.055, 0.055],
      text: "X",
    },
  },
  {
    id: "input.edit-box",
    label: "Edit Box",
    category: "Inputs",
    typeClass: "EditBoxWidgetClass",
    defaultName: "EditBox",
    description: "Text input field for forms and filters.",
    props: {
      position: [0, 0],
      size: [0.28, 0.05],
      text: "",
    },
  },
  {
    id: "input.slider",
    label: "Slider",
    category: "Inputs",
    typeClass: "SliderWidgetClass",
    defaultName: "Slider",
    description: "Horizontal slider for numeric settings.",
    props: {
      position: [0, 0],
      size: [0.28, 0.045],
      current: [0],
      min: [0],
      max: [1],
    },
  },
];

export function defaultPropsForWidgetType(typeClass) {
  const preset = editorWidgetPalettePresets.find((candidate) => (
    candidate.typeClass.toLowerCase() === String(typeClass).toLowerCase()
  ));
  return mergeProps(preset?.props ?? fallbackWidgetProps(typeClass));
}

export function listWidgetPalette(options = {}) {
  const query = String(options.query ?? "").trim().toLowerCase();
  const runtime = options.projectRoot ? buildPluginRuntimeRegistry(options.projectRoot) : null;
  const allPresets = [
    ...widgetPalettePresets,
    ...(runtime?.widgetPresets ?? []),
  ];
  const presets = allPresets
    .filter((preset) => !query || searchableText(preset).includes(query))
    .map((preset) => clonePreset(preset));
  return {
    kind: "WidgetPalette",
    count: presets.length,
    categories: [...new Set(presets.map((preset) => preset.category))],
    presets,
    pluginRuntime: runtime ? {
      ready: runtime.ready,
      pluginCount: runtime.pluginCount,
      widgetPresetCount: runtime.contributionCounts.widgetPresets,
      diagnostics: runtime.diagnostics,
    } : null,
  };
}

export function getWidgetPalettePreset(presetId, options = {}) {
  const normalized = String(presetId ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const runtime = options.projectRoot ? buildPluginRuntimeRegistry(options.projectRoot) : null;
  return [
    ...widgetPalettePresets,
    ...(runtime?.widgetPresets ?? []),
  ].find((preset) => preset.id.toLowerCase() === normalized) ?? null;
}

export function instantiateWidgetPreset(presetId, options = {}) {
  const preset = getWidgetPalettePreset(presetId, options);
  if (!preset) return { ok: false, reason: `Unknown widget preset: ${presetId}` };
  return {
    ok: true,
    preset: clonePreset(preset),
    typeClass: options.typeClass ?? preset.typeClass,
    name: options.name ?? preset.defaultName,
    props: mergeProps(preset.props, options.props),
  };
}

function clonePreset(preset) {
  return {
    ...preset,
    props: mergeProps(preset.props),
  };
}

function mergeProps(base, overrides = {}) {
  const props = {};
  for (const [key, value] of Object.entries(base ?? {})) props[key] = cloneValue(value);
  for (const [key, value] of Object.entries(overrides ?? {})) props[key] = cloneValue(value);
  return props;
}

function fallbackWidgetProps(typeClass) {
  const lower = String(typeClass).toLowerCase();
  if (lower.includes("text")) {
    return {
      position: [0, 0],
      size: [0.2, 0.05],
      text: "New text",
      color: [1, 1, 1, 1],
    };
  }
  return {
    position: [0, 0],
    size: [0.1, 0.1],
  };
}

function cloneValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

function searchableText(preset) {
  return [
    preset.id,
    preset.label,
    preset.category,
    preset.typeClass,
    preset.defaultName,
    preset.description,
  ].join(" ").toLowerCase();
}
