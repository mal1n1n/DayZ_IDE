# DayZ UI Editor: research and product plan

## Goal

Build a full desktop tool for DayZ Standalone UI modding that can eventually replace the UI/layout part of Workbench for mod authors and expose the same capabilities through an MCP server for Codex/AI automation.

The product must handle:

- Creating and editing `.layout` files visually.
- Inspecting and editing widget hierarchy, positions, sizes, alignment flags, text, images, styles, and behavior flags.
- Importing UI images and managing `.imageset` / `.edds` resources.
- Working with `.styles`, fonts, `stringtable.csv`, `config.cpp`, script controllers, and mod packing.
- Previewing layouts quickly inside the editor with real EDDS-backed images, then verifying fidelity against DayZ/Workbench when possible.
- Running as an MCP server with safe, transactional tools for AI-assisted modding.

Primary real-world validation target:

```text
E:\PycharmProjects\MGStalker\src\ClientMods
```

## Key research conclusions

DayZ UI is not HTML/CSS. It is a game-specific widget DSL loaded by Enfusion/DayZ runtime.

`.layout` is a brace-delimited tree:

```text
FrameWidgetClass rootFrame {
 position 0 0
 size 1 1
 {
  TextWidgetClass Title {
   text "Example"
   font "gui/fonts/Metron-Bold28"
   style Normal
  }
 }
}
```

Important consequences:

- The editor needs a lossless parser/serializer, not a JSON conversion layer.
- Unknown properties, order, quoted property names, comments/trivia, and formatting must survive round trips.
- `.styles` should be treated carefully. For MVP, index style names and preserve references; full style editing needs a later research phase because public documentation is thin.
- EDDS support is mandatory for preview. In the MGStalker corpus, layouts and imagesets reference EDDS files directly and through GUID-prefixed paths, so the renderer cannot rely on placeholder boxes.
- A web/canvas preview can be very useful, but authoritative visual truth still comes from DayZ/Workbench/DayZDiag.

## Sources and anchors

- DayZ layout format and widget concepts: https://stardz-team.github.io/DayZ-Modding-Wiki/en/03-gui-system/02-layout-files
- DayZ widget API: https://dayz-scripts.yadz.app/d9/d0e/group___widget_a_p_i.html
- Official DayZ samples: https://github.com/BohemiaInteractive/DayZ-Samples
- Stringtable sample: https://github.com/BohemiaInteractive/DayZ-Samples/tree/master/Test_Stringtable
- Community UI sample with `CreateWidgets` / `FindAnyWidget`: https://github.com/Thurston00/DayZ-CommunitySamples/tree/master/Script/UISample
- Imageset format reference: https://stardz-team.github.io/DayZ-Modding-Wiki/en/05-config-files/04-imagesets
- DayZ Tools on Steam: https://store.steampowered.com/app/830640/DayZ_Tools/
- MCP specification: https://modelcontextprotocol.io/specification/2025-06-18
- Codex MCP docs: https://developers.openai.com/codex/mcp

## MGStalker validation corpus

Initial scan of `E:\PycharmProjects\MGStalker\src\ClientMods` found:

- 99 `.layout` files.
- 154 `.edds` files.
- 153 `.meta` files.
- 17 `.imageset` files.
- 4 `.styles` files.
- 7 `stringtable.csv` files.
- 179 Enforce `.c` scripts.

Important observed image reference forms:

```text
image0 "MG_Capture/gui/data/item.edds"
image0 "{759C43E52C345E70}MG_Arena/gui/data/header.edds"
image0 "set:data image:battery"
LoadImageFile(0, "MG_StalkerPDA/gui/data/arena/top" + rank + ".edds")
```

Observed `.edds.meta` form:

```text
MetaFileClass {
 Name "{8DA5091AD9BEB121}MG_Arena/gui/data/icons/diamond.edds"
 Configurations {
  PNGResourceClass PC {
   SourceFile "diamond.png"
  }
 }
}
```

This means the asset resolver must support:

- raw virtual paths,
- GUID-prefixed Enfusion resource paths,
- `.edds.meta` GUID-to-path indexing,
- `.meta` `SourceFile` fallback when the source PNG is present,
- `.imageset` atlas references,
- script-time `LoadImageFile(...)` references.

Current Phase 0 scanner result:

- `packages/core/src/cli/dzui-scan.mjs` scans the corpus without dependencies.
- All 154 `.edds` files currently expose readable `DDS ` headers.
- Internal mod image references resolve cleanly: 0 unresolved internal refs after parsing quoted `.imageset` image names.
- 158 refs are intentionally classified as external vanilla refs, such as `DZ/...` paths and builtin sets `dayz_gui` / `dayz_crosshairs`; full preview will need a DayZ vanilla asset index for these.

## Domain model

```ts
Project {
  roots: string[];
  layoutFiles: LayoutFile[];
  imageSets: ImageSet[];
  styleRegistry: StyleRef[];
  stringTable?: StringTable;
  fonts: FontRef[];
  scripts: ScriptIndex;
  configCpp?: ConfigIndex;
  workbenchProject?: WorkbenchProject;
}

LayoutFile {
  path: string;
  root: WidgetNode;
  diagnostics: Diagnostic[];
  trivia: SourceTrivia;
}

WidgetNode {
  typeClass: string;
  name: string;
  scriptClass?: string;
  sourceSpan: SourceSpan;
  props: OrderedProp[];
  children: WidgetNode[];
  box: {
    position?: [number, number];
    size?: [number, number];
    hexactpos?: boolean;
    vexactpos?: boolean;
    hexactsize?: boolean;
    vexactsize?: boolean;
    halign?: string;
    valign?: string;
    scaled?: boolean;
    keepsafezone?: boolean;
    priority?: number;
  };
  visual: {
    visible?: boolean;
    style?: string;
    color?: [number, number, number, number];
    alpha?: number;
    clipchildren?: boolean;
  };
  text?: {
    value?: string;
    font?: string;
    exactText?: boolean;
    sizeToTextH?: boolean;
    sizeToTextV?: boolean;
    halign?: string;
    valign?: string;
    wrap?: boolean;
  };
  image?: {
    slots: ImageRef[];
    mode?: string;
    srcAlpha?: boolean;
    stretchMode?: string;
    filter?: boolean;
    fixAspect?: boolean;
    flipU?: boolean;
    flipV?: boolean;
  };
  behavior: {
    ignorepointer?: boolean;
    draggable?: boolean;
    disabled?: boolean;
    noFocus?: boolean;
  };
  unknownProps: OrderedProp[];
}
```

## EDDS preview requirements

EDDS rendering is part of the core preview path, not an optional export feature.

The preview system should resolve images in this order:

1. `set:name image:sprite` -> `.imageset` -> texture path -> decoded EDDS -> crop `Pos/Size`.
2. `{GUID}path.edds` -> `.edds.meta` or path normalization -> decoded EDDS.
3. `path.edds` -> project-root virtual path -> decoded EDDS.
4. `.edds.meta` `SourceFile` fallback -> source `.png/.tga` when present.
5. Missing or undecodable texture -> visible diagnostic placeholder with exact unresolved reference.

Implementation strategy:

- Build a project asset index from `.edds`, `.edds.meta`, `.imageset`, source `.png/.tga`, and `config.cpp` registrations.
- Treat EDDS files as DDS-like binary textures. A sample MGStalker EDDS begins with a `DDS ` header, so a DirectXTex/texconv-compatible decode path is likely viable.
- Prefer a native sidecar decoder/cache over browser-only decoding.
- Cache decoded textures as PNG/WebP thumbnails under `.dzui/preview-cache`.
- Preserve alpha accurately; alpha mistakes are more damaging for UI preview than minor color-space differences.
- Support large UI textures such as PDA backgrounds and board screens without blocking the canvas thread.

Minimum acceptance for EDDS:

- `MG_Arena/gui/layouts/arena_bot.layout` shows `header.edds` and `Arena 1x1 icon.edds`.
- `MG_StalkerPDA/gui/layouts/pda.layout` shows `kpk_1280.edds`, `kpk_1280_potertosti.edds`, and `set:data image:battery`.
- `.imageset` references like `set:data image:battery` crop the correct sprite from the atlas.
- GUID-prefixed references and raw references resolve to the same asset.
- Missing EDDS files are reported as diagnostics, not silently hidden.

## Recommended architecture

Recommended stack: Electron + React/TypeScript UI + Rust sidecar core + integrated MCP host.

Why:

- Chromium gives predictable canvas/editor behavior and excellent tooling.
- TypeScript fits Monaco, plugins, MCP server, and AI-facing APIs.
- Rust is a good fit for lossless parsers, validators, file indexing, and fast geometry calculations.
- Electron size is acceptable for a serious workstation tool.

High-level modules:

```text
Desktop shell
  - Project explorer
  - Layout tree
  - Canvas preview
  - Inspector
  - Asset browser
  - Stringtable editor
  - Monaco/source editor
  - Build/validation panel
  - MCP control panel

Core sidecar
  - Lossless parsers: .layout, .imageset, .gproj, stringtable.csv, config refs
  - Style registry and passthrough .styles support
  - Semantic IR and diagnostics
  - Layout geometry engine
  - Asset resolver and preview cache
  - Script scanner for CreateWidgets / FindAnyWidget / SetText
  - Exporter and formatter
  - DayZ Tools / Workbench / DayZDiag bridge

MCP host
  - stdio transport
  - localhost Streamable HTTP transport
  - transactional write tools
  - project resources
  - prompts for common UI-mod workflows
```

## MVP scope

MVP must be boringly solid. The first version should not try to fully replace Workbench visually; it should make layout work safer, faster, and automatable.

### MVP features

1. Open a DayZ mod/project folder.
2. Scan `.layout`, `.imageset`, `.styles`, `.fnt`, `.edds`, `.paa`, `.png`, `.tga`, `stringtable.csv`, `config.cpp`, and scripts.
3. Parse and save `.layout` losslessly.
4. Show widget hierarchy and editable properties.
5. Render a fast 2D preview for common widgets:
   - `FrameWidgetClass`
   - `PanelWidgetClass`
   - `TextWidgetClass`
   - `MultilineTextWidgetClass`
   - `RichTextWidgetClass`
   - `ImageWidgetClass`
   - `ButtonWidgetClass`
   - `CheckBoxWidgetClass`
   - `EditBoxWidgetClass`
   - `SliderWidgetClass`
   - `TextListboxWidgetClass`
   - `GridSpacerWidgetClass`
   - `WrapSpacerWidgetClass`
   - `ScrollWidgetClass`
   - `ItemPreviewWidgetClass` as placeholder first
6. Edit:
   - name
   - type
   - `position`
   - `size`
   - exact flags
   - `halign`
   - `valign`
   - `visible`
   - `ignorepointer`
   - `priority`
   - `style`
   - `text`
   - `font`
   - `image0`
7. Validate:
   - duplicate widget names
   - missing `FindAnyWidget` target
   - unresolved layout path in `CreateWidgets`
   - unresolved `#STR_*`
   - unresolved `set:X image:Y`
   - missing font path
   - missing style name
   - negative/zero sizes
   - suspicious fullscreen high-priority input blockers
8. Decode and render EDDS textures used by `ImageWidgetClass`.
9. Resolve `.imageset` atlas sprites and crop them correctly in preview.
10. Provide localized preview from `stringtable.csv`.
11. Generate a typed `UIScriptedMenu` skeleton for a layout.
12. Expose read-only MCP resources and safe diff-based write tools.

## Product phases

### Phase 0: Corpus and proof spikes

Deliverables:

- Collect vanilla/community `.layout`, `.imageset`, `.styles`, `stringtable.csv`, and script examples.
- Create golden fixtures from DayZ samples and community samples.
- Prototype `.layout` tokenizer and CST.
- Prototype `.imageset` parser.
- Prototype EDDS decode/cache path using the MGStalker corpus.
- Prototype geometry calculation for `position`, `size`, exact flags, `halign`, `valign`.
- Define legal boundary: do not bundle proprietary DayZ assets; index local user installation only.

Exit criteria:

- At least 50 real `.layout` files parse.
- Round-trip export changes nothing for untouched files.
- The sample `MyCustomMenu.layout` renders structurally.
- `MG_Arena/gui/layouts/arena_bot.layout` renders its EDDS images.

### Phase 1: Core parser and CLI

Deliverables:

- Rust core crate.
- Lossless `.layout` parser/serializer.
- Typed property extraction.
- Diagnostics engine.
- CLI:
  - `dzui parse`
  - `dzui validate`
  - `dzui format --check`
  - `dzui inspect`
- Golden tests and fuzz tests.

Exit criteria:

- CI proves stable round-trip.
- Unknown properties are preserved.
- CLI can validate a real mod folder.

### Phase 2: Desktop editor MVP

Deliverables:

- Electron app shell.
- Project explorer.
- Layout tree.
- Source editor.
- Inspector.
- Basic 2D canvas preview.
- EDDS-backed image preview through decoded texture cache.
- Undo/redo.
- Drag/reparent widgets.
- Save/export `.layout`.
- Validation panel.

Exit criteria:

- User can open, edit, preview, and save a layout without Workbench.
- User can see real EDDS images in the preview for the MGStalker corpus.
- Saved file remains DayZ-compatible.
- Editing source and visual inspector stay synchronized.

### Phase 3: Assets, localization, and scripts

Deliverables:

- `.imageset` parser/editor.
- `set:X image:Y` resolver.
- Image import wizard.
- Preview cache for `.png/.tga` and decoded preview images for `.edds/.paa`.
- `stringtable.csv` editor.
- Language switch in canvas preview.
- Enforce Script scanner:
  - `CreateWidgets("...")`
  - `FindAnyWidget("...")`
  - `SetText("#...")`
  - `LoadImageFile(...)`
- Controller skeleton generator.

Exit criteria:

- Editor can detect broken UI references before launching the game.
- Mod author can import images and wire them into layouts with validation.

### Phase 4: MCP server

Deliverables:

- MCP stdio transport.
- MCP localhost HTTP transport bound to `127.0.0.1`.
- Token/pairing and write approval UI.
- MCP resources:
  - `dayzui://project/manifest`
  - `dayzui://project/files`
  - `dayzui://layout/{path}/source`
  - `dayzui://layout/{path}/ast`
  - `dayzui://layout/{path}/ir`
  - `dayzui://layout/{path}/diagnostics`
  - `dayzui://assets/imagesets`
  - `dayzui://style/{name}`
  - `dayzui://stringtable`
  - `dayzui://schema/widget/{type}`
- MCP tools:
  - `project_open`
  - `project_scan`
  - `layout_parse`
  - `layout_get_tree`
  - `layout_query`
  - `layout_apply_patch`
  - `widget_create`
  - `widget_update`
  - `widget_delete`
  - `widget_reparent`
  - `style_list`
  - `asset_resolve`
  - `stringtable_get`
  - `stringtable_update`
  - `validate_layout`
  - `preview_render`
  - `export_layout`
  - `script_generate_controller`
  - `history_checkpoint`
- MCP prompts:
  - `create_hud_overlay`
  - `diagnose_layout_error`
  - `refactor_responsive_layout`
  - `theme_existing_layout`
  - `bind_layout_to_controller`
  - `prepare_workshop_release`

Exit criteria:

- Codex can inspect and safely modify layouts through MCP.
- Writes are transactional, diff-first, undoable, and visible in the UI.

### Phase 5: Engine fidelity bridge

Deliverables:

- DayZ Tools path discovery.
- Optional `P:` drive/project mapping.
- Workbench/DayZDiag launch harness.
- Test mod generation for preview.
- Screenshot capture.
- Widget geometry dump if feasible.
- Pixel/geometry comparison report.

Exit criteria:

- Editor can tell the user where its preview disagrees with the game.
- Web preview remains fast; engine preview becomes authoritative.

### Phase 6: Workbench replacement layer

Deliverables:

- Advanced `.styles` editor.
- Font import/glyph coverage checker.
- CJK/Cyrillic metric checks.
- Visual atlas packer.
- PBO build adapter.
- Workshop publishing adapter.
- Mod conflict analysis.
- Vanilla layout patch/diff tools.
- Plugin SDK.

Exit criteria:

- The tool covers the full UI production loop for serious DayZ mods.

## Major risks

### Preview fidelity

The hardest part is not UI editing. It is matching DayZ rendering:

- font metrics
- `.styles` inheritance
- safezone/scaling
- input focus and navigation
- `ItemPreviewWidget`
- `MapWidget`
- `RenderTargetWidget`
- Workbench quirks

Mitigation:

- Fast local preview for editing.
- Engine preview for truth.
- Screenshot/geometry diff reports.

### `.styles` format

Public documentation is limited. MVP should:

- discover style names
- preserve style references
- validate missing styles
- avoid rewriting `.styles`

Later versions can parse/edit styles after building a corpus from local vanilla files and community mods.

### Fonts

Layouts reference generated font resources such as `gui/fonts/Metron-Bold28`. Custom font import likely depends on Workbench-generated assets.

MVP should:

- resolve known font paths
- preview approximately with fallback fonts
- warn when exact metrics are unknown
- later add Workbench-based import and glyph coverage testing

### Imagesets

UI images are usually referenced as `set:name image:name`. Broken registration can silently render empty.

MVP should:

- parse `.imageset`
- verify `config.cpp` / `.gproj` registration
- resolve sprite rectangles
- show missing texture/asset diagnostics

## Initial repository structure

```text
apps/
  desktop/
    src/
packages/
  core/
    src/
  mcp-server/
    src/
  renderer/
    src/
  dayz-script-index/
    src/
crates/
  dzui-core/
    src/
  dzui-layout-parser/
    src/
  dzui-imageset-parser/
    src/
  dzui-edds-decoder/
    src/
fixtures/
  layouts/
  imagesets/
  edds/
  scripts/
docs/
  dayz-ui-editor-research-plan.md
```

## First implementation backlog

1. Create monorepo skeleton.
2. Add Rust parser crate for `.layout`.
3. Add golden fixtures from `DayZ-CommunitySamples`.
4. Add MGStalker fixtures from `E:\PycharmProjects\MGStalker\src\ClientMods`.
5. Implement tokenize -> CST -> AST.
6. Implement no-op serializer and round-trip tests.
7. Implement typed property extraction for box/text/image basics.
8. Implement EDDS/meta asset index.
9. Implement EDDS decode/cache proof.
10. Implement `.imageset` parser and sprite crop resolver.
11. Implement validator diagnostics.
12. Add CLI command `dzui validate`.
13. Add Electron desktop shell.
14. Add layout tree view.
15. Add inspector for selected widget.
16. Add canvas geometry preview.
17. Add EDDS image rendering in canvas.
18. Add save/export.
19. Add stringtable parser.
20. Add MCP read-only server.
21. Add MCP transactional write tools.

## Suggested product name candidates

- DayZ UI Forge
- DZUI Workbench
- Enfusion UI Forge
- DayZ Layout Studio
- DZ Mod Studio

Temporary internal codename: `dzui`.
