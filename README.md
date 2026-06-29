# DayZ UI Editor Chat Context Handoff

Created: 2026-06-29

This archive is a portable context package for continuing the same task on another machine/thread.

## Current MVP Status

This workspace now contains an active `dzui` prototype, not only the original handoff notes.

Implemented:

- Lossless `.layout` tokenizer/parser with widget tree extraction.
- `.imageset` parser with quoted image class support.
- EDDS/DDS header reader and `.edds.meta` GUID indexing.
- Bundled DDS decoder for uncompressed 32bpp plus DXT1/BC1, DXT3/BC2, and DXT5/BC3 preview textures.
- DX10 DDS header diagnostics for BC7/BC-family formats and sidecar decoder support for `.edds`, `.dds`, `.paa`, and `.tga` preview conversion.
- Texture conversion plan/run workflow for converting PNG/TGA production outputs to PAA through ImageToPAA or a custom EDDS/PAA command template.
- Project asset index and resolver for raw EDDS paths, GUID-prefixed EDDS paths, and `set:name image:sprite`.
- Preview geometry model for relative/exact `position` and `size`, basic alignment, text, inherited style font/color, and image slots.
- Standalone HTML/canvas preview export.
- Local web shell with layout path input, widget tree, canvas preview, inspector, image panel, and diagnostics.
- Property editing from the web inspector with save/export to the layout file and `.dzui/history` transaction backup.
- Typed property schema metadata for common layout, state, style, text, and image properties.
- Web inspector typed controls for number pairs, booleans, enums, text, image refs, and raw fallback properties, including common-property batch controls for multi-select.
- Multi-select alignment, distribution, grouped move, and group resize transforms backed by generated `updateBox` layout patches.
- Canvas grid overlay, snap-to-grid drag/resize, parent/sibling smart guides, multi-select resize frame, and keyboard arrow nudging backed by transactional layout transforms.
- Color picker with alpha support and image slot picker options from the loaded asset browser.
- Canvas drag/move and bottom-right resize interactions backed by one transactional box update.
- Structural layout editing primitives for create/delete/reparent widget operations with source-preserving edits.
- Web inspector controls for adding child widgets, deleting widgets, and reparenting widgets.
- Tree drag-to-reparent UX backed by the same transactional reparent workflow.
- Multi-select in tree/canvas with transactional raw property batch saves through layout patch apply.
- Widget creation palette presets for common DayZ UI containers, text, image, control, HUD, inventory, list, dialog, and input widgets across core, CLI, MCP, API, and web shell.
- Persistent `.dzui/project-settings.json` support for project shell state and build profile defaults.
- Web build profile fields for addon source, output folder, PBO prefix, and DayZ Tools root.
- Source panel synchronized with the currently opened layout.
- Guarded source apply workflow with parser diagnostics, current-hash checks, preview rebuild, and history transaction capture.
- Source diff preview before applying raw source edits.
- Web undo/redo workflow backed by `.dzui/history` transaction snapshots and hash-guarded restores.
- MCP stdio and localhost HTTP transports exposing project scan, layout parse/inspect, preview model, asset resolve, diff-first write tools, rich project resources, resource subscribe/unsubscribe, and resources updated/list-changed notifications.
- MCP prompt templates for layout review, safe transactional edits, asset pipeline work, build/release readiness, and engine fidelity workflows.
- Validation engine for parser errors, duplicate widget names, non-positive sizes, unresolved image refs, and stringtable refs when a table is provided.
- Project scanners for `stringtable.csv`, `.styles`, fonts, and Enforce script UI references (`CreateWidgets`, `FindAnyWidget`, `SetText`, `LoadImageFile`).
- Font registry with BMFont `.fnt` glyph coverage parsing and layout font diagnostics for missing glyphs.
- Font import workflow that copies `.fnt`/TTF/OTF/WOFF assets into the project, carries BMFont page textures, and reports sample-text plus multi-language project glyph coverage through CLI, MCP, API, and the web shell.
- Controller skeleton generator from `.layout` trees.
- Stringtable update primitive and UI/API for appending or updating localization keys.
- Stringtable grid API and web grid editor with per-row saves.
- Preview language switch that resolves `#STR_*` text through `stringtable.csv`.
- `.styles` parser and property authoring workflow with CLI, MCP, desktop API, and web editor access.
- `.styles` inheritance resolver with effective property output, schema-aware diagnostics, preview-fidelity warnings, and canvas preview support for inherited font/color plus style-backed position/size, alignment, visibility, pointer ignore, alpha, image refs, and hover/selected/disabled state simulation.
- `.imageset` authoring primitive for creating/updating sprite definitions.
- PNG image import workflow that copies an asset into a project and updates/creates the target `.imageset`.
- PNG atlas packing workflow that composes multiple source PNGs into one atlas and generates the matching `.imageset`.
- Asset browser API and web picker for direct images and `set:* image:*` sprites.
- Vanilla DayZ asset fallback via `DZUI_VANILLA_ASSETS` for `DZ/...` paths and built-in imagesets such as `set:dayz_gui`.
- Engine bridge scaffold for DayZ Tools/Workbench/DayZDiag path discovery and preview-run planning.
- Engine launch-plan scaffold for DayZDiag/Workbench command construction without starting external tools.
- Temporary `.dzui/engine-preview` workspace generation with preview mission `init.c`, manifest, README, and DayZDiag launch `.cmd`.
- Geometry diff reports that compare DZUI preview boxes against DayZ engine geometry dumps through CLI, MCP, and the web shell.
- Pixel diff reports for comparing DZUI/engine PNG screenshots, including optional visual diff PNG output.
- Engine capture workflow for launching DayZDiag/Workbench or a configured capture command, collecting screenshot/geometry outputs, and writing geometry/pixel diff reports.
- Structural layout diff reports for comparing two `.layout` files across widgets, parents, types, names, and properties through core, CLI, MCP, and the web shell.
- Hash-guarded layout patch/apply workflow for `updateProperty`, `updateBox`, `createWidget`, `deleteWidget`, and `reparentWidget` operations through core, CLI, MCP, desktop API, and the web shell.
- Layout patch generation from before/after `.layout` files with conflict reporting, per-conflict semantic resolution controls in the web shell, explicit conflict-resolution records, and reusable patch JSON artifacts.
- PBO build workflow plan scaffold with AddonBuilder discovery, manifest, validation gate, and MCP/web/CLI access.
- AddonBuilder execution runner with timeout, log capture, PBO existence verification, and CLI/MCP/web access.
- Workshop publish/update workflow with PublisherCmd discovery, content/PBO readiness checks, command-template override, log capture, project settings, and CLI/MCP/web access.
- Unified toolchain readiness report for DayZ Tools, ImageToPAA, AddonBuilder, PublisherCmd, Workbench/DayZDiag, project validation, build, Workshop, engine capture, and texture conversion workflows across core, CLI, MCP, desktop API, and the web shell.
- Plugin SDK manifest discovery, validation, safe runtime registry, integrity package/verify manifest, Ed25519 package signatures, trusted-key install policy, verified runtime command hooks, and plugin widget presets exposed through core, CLI, MCP, desktop API, and the web shell.

Useful commands:

```powershell
npm.cmd test
npm.cmd run inspect -- fixtures/layouts/pda_minimal.layout
npm.cmd run preview -- fixtures/layouts/pda_minimal.layout --out .dzui/previews/pda_minimal.preview.html
npm.cmd run decode -- path\to\texture.edds --out .dzui\preview-cache\texture.png
npm.cmd run decode -- path\to\texture.paa --out .dzui\preview-cache\texture.png --decoder-json path\to\decoder.json
npm.cmd run texture-convert-plan -- path\to\atlas.png --out path\to\atlas.paa --tools "C:\Program Files (x86)\Steam\steamapps\common\DayZ Tools"
npm.cmd run texture-convert-run -- path\to\atlas.png --out path\to\atlas.paa --command-json path\to\converter-command.json
npm.cmd run validate -- fixtures/layouts/pda_minimal.layout
npm.cmd run validate-project -- fixtures
npm.cmd run toolchain-readiness -- fixtures --layout fixtures/layouts/pda_minimal.layout --allow-diagnostics --allow-not-ready
npm.cmd run engine-plan -- --project fixtures --layout fixtures/layouts/pda_minimal.layout
npm.cmd run engine-launch-plan -- --project fixtures --layout fixtures/layouts/pda_minimal.layout
npm.cmd run engine-preview-generate -- --project fixtures --layout fixtures/layouts/pda_minimal.layout
npm.cmd run engine-geometry-diff -- --layout fixtures/layouts/pda_minimal.layout --dump .dzui/tmp/pda-geometry-dump.json --width 1280 --height 720
npm.cmd run engine-pixel-diff -- --expected .dzui/tmp/pixel-expected.png --actual .dzui/tmp/pixel-actual.png --diff .dzui/tmp/pixel-diff.png --allow-diff
npm.cmd run engine-capture-plan -- --project fixtures --layout fixtures/layouts/pda_minimal.layout
npm.cmd run engine-capture-run -- --project fixtures --layout fixtures/layouts/pda_minimal.layout --command-json path\to\capture-command.json --out .dzui/tmp/capture-run
npm.cmd run build-plan -- fixtures --allow-diagnostics
npm.cmd run build-run -- fixtures --allow-diagnostics
npm.cmd run workshop-plan -- fixtures --item 123456 --change-note "DZUI update" --allow-diagnostics
npm.cmd run workshop-run -- fixtures --item 123456 --change-note "DZUI update" --command-json path\to\publish-command.json --allow-diagnostics
npm.cmd run settings-get -- fixtures
npm.cmd run settings-set -- fixtures --layout fixtures/layouts/pda_minimal.layout --width 1280 --height 720 --language English
npm.cmd run plugins -- fixtures
npm.cmd run plugins-runtime -- fixtures
npm.cmd run plugins-package -- fixtures --write
npm.cmd run plugins-package -- fixtures --write --sign-private-key path\to\ed25519-private.pem --sign-public-key path\to\ed25519-public.pem --sign-key-id local-dev
npm.cmd run plugins-verify -- fixtures --package fixtures\.dzui\plugin-runtime-package.json
npm.cmd run plugins-trust -- fixtures --package fixtures\.dzui\plugin-runtime-package.json --trust-policy fixtures\.dzui\plugin-trust-policy.json
npm.cmd run plugins-verify -- fixtures --package fixtures\.dzui\plugin-runtime-package.json --require-trusted --trust-policy path\to\plugin-trust-policy.json
npm.cmd run plugins-command -- fixtures --command sample.tools/sample.tools.refresh --package fixtures\.dzui\plugin-runtime-package.json --execute
npm.cmd run layout-palette -- --query text
npm.cmd run layout-create -- fixtures/layouts/pda_minimal.layout --parent-id PDAFrame:0 --type TextWidgetClass --name StatusText --text Ready --dry-run
npm.cmd run layout-create -- fixtures/layouts/pda_minimal.layout --parent-id PDAFrame:0 --preset text.label --name StatusText --text Ready --dry-run
npm.cmd run layout-delete -- fixtures/layouts/pda_minimal.layout --widget-id PDAFrame:0/Scratches:1 --dry-run
npm.cmd run layout-reparent -- fixtures/layouts/pda_minimal.layout --widget-id PDAFrame:0/Battery:2 --parent-id PDAFrame:0/Body:0 --dry-run
npm.cmd run layout-transform -- fixtures/layouts/pda_minimal.layout --action align-left --widgets "PDAFrame:0/ItemSlot:0,PDAFrame:0/OtherSlot:1" --dry-run
npm.cmd run layout-transform -- fixtures/layouts/arena_bot_minimal.layout --action resize-group --widgets "rootFrame:0/Header:0,rootFrame:0/Title:1" --target-bounds "100 80 640 160" --dry-run
npm.cmd run layout-diff -- fixtures/layouts/pda_minimal.layout fixtures/layouts/arena_bot_minimal.layout --allow-diff
npm.cmd run layout-generate-patch -- fixtures/layouts/pda_minimal.layout fixtures/layouts/arena_bot_minimal.layout --out .dzui/tmp/generated.patch.json --allow-conflicts
npm.cmd run layout-resolve-patch -- .dzui/tmp/generated.patch.json --out .dzui/tmp/generated.resolved.patch.json
npm.cmd run layout-patch -- fixtures/layouts/pda_minimal.layout --patch path\to\layout.patch.json --dry-run
npm.cmd run controller -- fixtures/layouts/arena_bot_minimal.layout --class ArenaMenu --layout layouts/arena_bot_minimal.layout
npm.cmd run stringtable-set -- fixtures/stringtable.csv --key STR_NEW_KEY --column English --value "New text"
npm.cmd run style-list -- fixtures/gui/styles/test.styles
npm.cmd run style-set -- fixtures/gui/styles/test.styles --style Normal --key color --values "1 1 1 1"
npm.cmd run font-list -- fixtures
npm.cmd run font-check -- fixtures/layouts/arena_bot_minimal.layout --project fixtures --allow-diagnostics
npm.cmd run font-coverage -- fixtures --layout fixtures/layouts/arena_bot_minimal.layout --languages "English,Russian" --allow-diagnostics
npm.cmd run font-import -- C:\path\to\font.fnt --project fixtures --asset gui/fonts/font.fnt --sample-text "ABCDE" --allow-diagnostics
npm.cmd run imageset-upsert -- .dzui\data.imageset --texture gui/data/icon.png --image icon --size "32 32" --set data
npm.cmd run image-import -- C:\path\to\icon.png --project fixtures --asset gui/data/icon.png --imageset gui/data/data.imageset --set data --image icon
npm.cmd run atlas-pack -- fixtures --images "C:\path\a.png;C:\path\b.png" --asset gui/data/atlas.png --imageset gui/data/data.imageset --set data --power-of-two
npm.cmd run dev
npm.cmd run mcp
npm.cmd run mcp:http
```

MCP HTTP transport:

- `npm.cmd run mcp:http` binds to `http://127.0.0.1:8765/mcp` by default.
- `GET /health` returns a small readiness payload for local smoke checks.
- `POST /mcp` accepts JSON-RPC requests; foreign `Origin` headers are rejected to reduce DNS rebinding risk.

MCP prompts:

- `dayz_ui_layout_review`
- `dayz_ui_safe_edit`
- `dayz_ui_asset_pipeline`
- `dayz_ui_build_release`
- `dayz_ui_engine_fidelity`

Open the web shell at:

```text
http://127.0.0.1:5173/
```

Current EDDS preview status:

- EDDS files are indexed and resolved, and the preview data includes cache keys for decoded PNG output.
- DDS-backed `.edds` files in uncompressed 32bpp, DXT1/BC1, DXT3/BC2, and DXT5/BC3 formats can be decoded to PNG cache and displayed by the web shell without external tools.
- BC7/DX10 DDS headers are identified for diagnostics; BC7, PAA, TGA, and other unsupported native formats can use DirectXTex `texconv` where applicable or a custom sidecar decoder via `--decoder-json`, `externalDecoder`, or `DZUI_PREVIEW_DECODER_JSON`.
- Browser-readable assets such as PNG/JPG/WebP can already be drawn by the web shell when resolved through the local server.
- Production texture conversion can plan/run ImageToPAA for PNG/TGA outputs or use a custom command template for EDDS/PAA converters with `{source}`, `{out}`, and `{format}` placeholders.

Current image authoring status:

- `imageset-upsert` creates or updates one `ImageSetDefClass` entry and rewrites a canonical `.imageset`.
- `image-import` reads PNG dimensions, copies the image into a project-relative virtual path, and creates/updates the requested `.imageset`.
- `atlas-pack` reads multiple PNGs, packs them into one atlas PNG, and emits sprite `Pos`/`Size` entries in the requested `.imageset`; the web shell exposes the same workflow through `/api/atlas/pack`.
- The web shell exposes the same image import path through `/api/image/import` and an asset picker through `/api/assets/images`.
- MCP exposes `imageset_upsert` and `image_import`; both are dry-run by default and require `write=true` for disk writes.

Current font status:

- `.fnt`, `.ttf`, `.otf`, `.woff`, and `.woff2` files are indexed as project fonts.
- BMFont `.fnt` coverage is parsed from `char id=...` entries and layout validation reports missing glyphs for direct and style-derived font refs.
- `font-coverage`, MCP `font_coverage_report`, `/api/font/coverage`, and the web Fonts Coverage button aggregate missing glyphs by target stringtable language and BMFont atlas page.
- `font-import` copies a font into a project, copies referenced BMFont page textures such as `page file="font_0.png"`, and can report missing glyphs for a sample text.
- MCP exposes `font_import` as dry-run by default; the desktop shell exposes the same workflow through `/api/font/import` and the Fonts panel.

Current vanilla asset status:

- Set `DZUI_VANILLA_ASSETS` to one or more unpacked DayZ asset roots separated by the OS path delimiter (`;` on Windows).
- When configured, `DZ/...` image refs and built-in `set:dayz_gui` / `set:dayz_crosshairs` imagesets are resolved after mod/project assets.
- The web asset browser includes vanilla direct images and vanilla imageset sprites when the environment variable is present.

Current toolchain readiness status:

- `toolchain-readiness` and the web `Readiness` button produce a single safe report for local DayZ Tools discovery, project validation, build, Workshop publish, engine capture, and texture conversion readiness.
- The report does not launch external executables; real AddonBuilder/PublisherCmd/ImageToPAA/DayZDiag validation still happens through the dedicated run workflows or a project-specific command template.

## User Goal

Build a full DayZ Standalone UI/modding visual editor that can eventually replace the UI/layout part of Workbench and can also run an MCP server for Codex/AI automation.

The editor must support:

- Creating and editing DayZ `.layout` files visually.
- Real preview rendering, not placeholder boxes.
- First-class EDDS image support in preview.
- `.imageset` atlas support.
- First-class `.styles` awareness with inheritance, schema-aware editing, and preview impact for inherited font/color, default layout/state properties, alpha, image refs, and hover/selected/disabled state simulation.
- Font references and localization via `stringtable.csv`.
- Script integration for `CreateWidgets`, `FindAnyWidget`, `LoadImageFile`, etc.
- Mod/project validation and eventually PBO/build/publish workflows.
- Embedded MCP server for AI-assisted layout editing.

Most important new requirement from the latest user message:

> Layouts work with EDDS images, so preview rendering must display them properly. The output should be a full visual editor with full preview.

Primary validation project:

```text
E:\PycharmProjects\MGStalker\src\ClientMods
```

## Current Workspace

Main workspace:

```text
C:\Users\vokin\Documents\МГ Игра+АПИ
```

Existing unrelated files in root before this work:

```text
top-online-giveaway-3000-mgc.png
top-online-giveaway-3000-mgc-v2.png
top-online-giveaway-3000-mgc-v3.png
top-online-giveaway-3000-mgc-v4.png
```

Do not delete or revert those unless the user explicitly asks.

## Files Created In This Chat

Important files:

```text
docs/dayz-ui-editor-research-plan.md
package.json
packages/core/src/cli/dzui-scan.mjs
```

This handoff archive contains copies of those files.

## Research Summary

DayZ UI is a game-specific widget DSL, not HTML/CSS.

`.layout` files are brace-delimited widget trees:

```text
FrameWidgetClass rootFrame {
 size 1 1
 {
  ImageWidgetClass Logo {
   image0 "{GUID}SomeMod/gui/data/logo.edds"
  }
 }
}
```

Key facts:

- Runtime loads layouts with `GetGame().GetWorkspace().CreateWidgets("path.layout")`.
- Scripts usually connect with `FindAnyWidget("name")` and widget casts.
- Some widgets use `scriptclass`.
- `style SomeName` references a style class from `.styles`.
- UI images may be referenced directly as EDDS paths or through imagesets.
- `stringtable.csv` is used for localization.

Important source anchors:

- DayZ layout docs: https://stardz-team.github.io/DayZ-Modding-Wiki/en/03-gui-system/02-layout-files
- DayZ Widget API: https://dayz-scripts.yadz.app/d9/d0e/group___widget_a_p_i.html
- DayZ Samples: https://github.com/BohemiaInteractive/DayZ-Samples
- DayZ CommunitySamples UI sample: https://github.com/Thurston00/DayZ-CommunitySamples/tree/master/Script/UISample
- Imageset docs: https://stardz-team.github.io/DayZ-Modding-Wiki/en/05-config-files/04-imagesets
- DayZ Tools: https://store.steampowered.com/app/830640/DayZ_Tools/
- MCP spec: https://modelcontextprotocol.io/specification/2025-06-18
- Codex MCP docs: https://developers.openai.com/codex/mcp

## Architecture Decision

Recommended stack:

```text
Electron + React/TypeScript UI + Rust core sidecar + embedded MCP host
```

Reason:

- Electron/Chromium gives stable editor/canvas tooling and Monaco integration.
- TypeScript is natural for UI, MCP, plugins, and AI-facing tools.
- Rust is a good fit for parsers, asset indexing, validation, EDDS decode/cache, and geometry calculations.
- A serious workstation tool can tolerate Electron size.

Core product architecture:

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
  - Lossless .layout parser/serializer
  - .imageset parser
  - EDDS/meta asset index
  - EDDS decode/cache
  - Style registry
  - Stringtable parser
  - Script scanner
  - Geometry engine
  - Diagnostics
  - DayZ Tools / Workbench / DayZDiag bridge

MCP host
  - stdio transport
  - localhost HTTP transport
  - resources/tools/prompts
  - transactional write tools with UI approval
```

## EDDS Requirement

EDDS preview is mandatory.

The resolver must handle these real forms found in MGStalker:

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

Preview image resolution order:

1. `set:name image:sprite` -> `.imageset` -> EDDS texture -> crop `Pos/Size`.
2. `{GUID}path.edds` -> `.edds.meta` / normalized path -> decoded EDDS.
3. `path.edds` -> project virtual path -> decoded EDDS.
4. `.edds.meta` `SourceFile` fallback -> source `.png/.tga` when available.
5. Missing/undecodable asset -> visible diagnostic placeholder.

## Current Prototype

Created a dependency-free Node scanner:

```text
packages/core/src/cli/dzui-scan.mjs
```

Commands:

```powershell
npm.cmd run scan:clientmods
node packages/core/src/cli/dzui-scan.mjs "E:\PycharmProjects\MGStalker\src\ClientMods"
```

Use `npm.cmd`, not `npm`, in PowerShell if script execution policy blocks `npm.ps1`.

The scanner currently:

- walks the project tree,
- counts relevant files,
- reads EDDS/DDS headers,
- parses `.edds.meta`,
- parses `.imageset`,
- extracts `image0` references from `.layout`,
- extracts `LoadImageFile` and asset string references from scripts,
- resolves raw EDDS paths, GUID-prefixed EDDS paths, and `set:* image:*` references,
- separates external vanilla refs like `DZ/...`, `set:dayz_gui`, and `set:dayz_crosshairs`.

Latest scan result on `ClientMods`:

```text
.c        179
.edds     154
.meta     153
.layout    99
.paa       57
.cpp       35
.png       30
.imageset  17
.csv        7
.styles     4
```

EDDS result:

```text
154 total EDDS
154 readable DDS headers
0 unreadable
```

Largest EDDS textures detected:

```text
MG_StalkerPDA/gui/data/menu_icons.edds                 2000x2000 32bpp
MG_Stalker_GUI/data/vanilla/bg.edds                    1920x1080 32bpp
MG_Stalker_GUI/data/vanilla/bg_mainmenu.edds           1920x1080 32bpp
MG_Stalker_GUI/data/vanilla/bg_reg.edds                1920x1080 32bpp
MG_Stalker_GUI/gui/data/ls/loadingscreen1.edds         1920x1080 32bpp
```

Image reference result:

```text
419 image refs found
0 unresolved internal image refs
158 external vanilla refs
```

The 158 external refs are expected and need a vanilla DayZ asset index.

## Acceptance Targets For Preview

First real layouts to render:

```text
E:\PycharmProjects\MGStalker\src\ClientMods\MG_Arena\gui\layouts\arena_bot.layout
E:\PycharmProjects\MGStalker\src\ClientMods\MG_StalkerPDA\gui\layouts\pda.layout
```

Minimum EDDS acceptance:

- `arena_bot.layout` shows `header.edds` and `Arena 1x1 icon.edds`.
- `pda.layout` shows `kpk_1280.edds`, `kpk_1280_potertosti.edds`, and `set:data image:battery`.
- `.imageset` crop works for `set:data image:battery`.
- GUID-prefixed and raw EDDS references resolve to the same asset.
- Missing assets produce diagnostics, not invisible rendering.

## Product Roadmap

Phase 0:

- corpus scan,
- `.layout` grammar spike,
- `.imageset` parser,
- EDDS decode/cache proof,
- MGStalker validation.

Phase 1:

- lossless `.layout` parser/serializer,
- CLI validator,
- typed property extraction,
- golden tests.

Phase 2:

- Electron desktop shell,
- layout tree,
- inspector,
- canvas preview,
- EDDS-backed image rendering,
- save/export.

Phase 3:

- imageset editor,
- localization editor,
- `.styles` editor with inheritance/effective-property diagnostics,
- script scanner,
- controller skeleton generator.

Phase 4:

- MCP server,
- resources/tools/prompts,
- transactional AI edits,
- safe image/stringtable/layout write tools.

Phase 5:

- Workbench/DayZDiag bridge,
- screenshot/geometry diff,
- engine-authenticated preview.

Phase 6:

- full Workbench replacement layer:
  - `.styles` editor with schema-aware controls and inheritance diagnostics,
  - font import and advanced glyph coverage checks,
  - PBO/build/publish,
  - plugin SDK manifest discovery/validation plus safe runtime/package registry, integrity verification, Ed25519 package signatures, trusted-key install policy, and verified command execution hooks,
  - structural layout diff reports, generated patch artifacts, hash-guarded patch apply, and basic patch conflict-resolution records/UI,
  - Workbench-style canvas grid, parent/sibling smart guides, snapping, group resize, and keyboard nudging.

## Immediate Next Steps

1. Add native BC7/PAA decode only if the sidecar path is not sufficient for target projects.
2. Re-run scanner/validation against `E:\PycharmProjects\MGStalker\src\ClientMods` when mounted.
3. Validate capture workflow against a real DayZDiag/Workbench installation and harden engine-side screenshot export.
4. Validate Workshop publish workflow against a real DayZ Tools PublisherCmd installation and Steam account.
5. Validate hover/selected/disabled preview-state simulation against real Workbench/DayZDiag capture data and tune any engine-specific mismatches.
6. Validate signed/trusted plugin runtime packages against real third-party plugin packages.

## Notes For The Next Agent

- Do not treat `.layout` as JSON. It needs lossless round-trip editing.
- Do not postpone EDDS; preview fidelity depends on it.
- `.imageset` class names can be quoted and contain spaces, e.g. `ImageSetDefClass "New GroupCenter"`.
- `.edds` files in the validation corpus begin with `DDS `, so DirectXTex/texconv or a DDS decoder path should be viable.
- Some source PNGs exist next to EDDS and are listed in `.edds.meta`, but the editor must support EDDS directly.
- External vanilla references are not errors; they need a vanilla asset index.
- Existing root PNG files are unrelated user assets and should be left alone.
