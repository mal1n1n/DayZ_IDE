# DZUI Implementation Backlog

This document tracks the product-level goal: complete the DayZ UI editor across all roadmap phases, from parser core to Workbench replacement workflows.

## Phase 0: Corpus And Proof Spikes

Status: mostly complete for the local prototype.

Done:

- Handoff corpus report imported.
- Dependency-free project scanner exists.
- `.layout` tokenizer/parser exists.
- `.imageset` parser exists.
- EDDS/DDS header reader exists.
- Uncompressed 32bpp DDS-backed `.edds` decode proof exists.
- Bundled DDS decode path exists for DXT1/BC1, DXT3/BC2, and DXT5/BC3 textures when `texconv` is unavailable.
- DirectXTex `texconv` external decoder fallback with PATH/common-root auto-discovery exists.
- DX10 DDS header diagnostics identify BC7/BC-family formats.
- Sidecar decoder path supports `.edds`, `.dds`, `.paa`, and `.tga` preview conversion through explicit decoder JSON or environment configuration.
- Texture conversion plan/run workflow supports ImageToPAA and custom EDDS/PAA command templates for PNG/TGA production outputs.
- HTML/canvas preview proof exists.

Remaining:

- Re-run scanner against real `E:\PycharmProjects\MGStalker\src\ClientMods` when available.
- Add fixtures from real MGStalker layouts/assets once the corpus is mounted.
- Native BC7/PAA decoder only if sidecar conversion is insufficient for target projects.

## Phase 1: Core Parser And CLI

Status: in progress, with the first edit/validation layer implemented.

Done:

- Lossless `.layout` source preservation.
- Widget tree extraction.
- Image reference extraction.
- `parse`, `inspect`, `preview`, `decode`, and `validate` CLI entrypoints.
- Validation engine for parser diagnostics, duplicate widget names, non-positive sizes, unresolved images, and stringtable refs.
- Property update primitive with before/after edit metadata.
- Typed property schema metadata for common layout/state/style/text/image properties.
- Source snapshot and undo/redo transaction helpers.

Remaining:

- CST-preserving edit operations.
- Layout serializer for targeted edits.
- Typed property schemas for common widget classes.
- Golden round-trip tests from real community/vanilla samples.

## Phase 2: Desktop Editor MVP

Status: prototype started, with basic property save support.

Done:

- Local web shell.
- Layout path/project root inputs.
- Tree, canvas, inspector, image panel, diagnostics panel.
- Browser-readable asset display.
- EDDS preview cache integration for supported decoded assets.
- Inspector property editing with save to file.
- Typed inspector controls for number pairs, booleans, enum alignment values, text/image refs, color/alpha values, and raw fallback properties.
- Image slot picker options backed by loaded asset browser results.
- `.dzui/history` transaction backups for web edits.
- Synchronized source panel for the opened layout.
- Guarded source apply workflow with parser diagnostics, current-hash checks, preview rebuild, and history transaction capture.
- Source diff preview before applying raw source edits.
- Undo/redo UI backed by history transaction snapshots with current-hash guards.
- Canvas drag/move and bottom-right resize interactions backed by one transactional box update.
- Structural widget create/delete/reparent primitives with source-preserving edits.
- Web inspector controls for adding child widgets, deleting widgets, and reparenting widgets.
- Tree drag-to-reparent UX backed by the transactional reparent workflow.
- Basic multi-select in tree/canvas with transactional raw property batch saves through layout patch apply.
- Multi-select alignment, distribution, grouped move, and group resize transforms backed by generated `updateBox` layout patches.
- Canvas grid overlay, snap-to-grid drag/resize, parent/sibling smart guides, multi-select resize frame, and keyboard arrow nudging backed by transactional layout transforms.
- Widget creation palette presets for common containers, text, image, and controls, available in core, CLI, MCP, desktop API, and the web inspector.
- Domain-specific creation palette presets for HUD, inventory, list, dialog, and input widgets.
- Typed multi-select inspector workflow for common properties, mixed-value indicators, and batch save through layout patch apply.
- Core, CLI, MCP, desktop API, and web shell access for grouped layout transforms.
- Persistent `.dzui/project-settings.json` support for layout path, viewport, language, recent files, and build defaults.
- CLI, MCP, desktop API, and web shell Load/Save access for project settings.
- Web build profile fields for addon source, output folder, PBO prefix, and DayZ Tools root, reused by build and engine-plan requests.

Remaining:

- Visual regression checks for complex canvas editing flows.

## Phase 3: Assets, Localization, And Scripts

Status: started.

Done:

- `stringtable.csv` parser/index with localized columns.
- `.styles` name registry for missing style diagnostics.
- `.styles` inheritance resolver with effective-property output, schema-aware diagnostics, preview-fidelity warnings, and preview support for inherited font/color plus style-backed position/size, alignment, visibility, pointer ignore, alpha, image refs, and hover/selected/disabled state simulation.
- Font registry for missing font diagnostics.
- BMFont `.fnt` glyph coverage parser with layout diagnostics for missing glyphs from direct and style-derived font refs.
- Font import workflow for `.fnt`/TTF/OTF/WOFF assets, BMFont page texture copying, and sample-text glyph coverage reporting across core, CLI, MCP, desktop API, and the web shell.
- Multi-language font coverage report across layout text samples, stringtable target languages, and BMFont atlas pages, exposed through core, CLI, MCP, desktop API, and the web shell.
- Enforce script scanner for `CreateWidgets`, `FindAnyWidget`, `SetText`, `LoadImageFile`, and asset strings.
- Project-level validation for unresolved script layout/widget/stringtable references.
- Controller skeleton generator from `.layout` widget trees.
- Stringtable append/update primitive with CLI, MCP, and web API access.
- Stringtable grid API and web grid editor with per-row saves.
- Preview language switch backed by `stringtable.csv`.
- Basic `.styles` property parser/editor workflow with CLI, MCP, desktop API, and web shell access.
- Schema-aware `.styles` web controls with datalist hints, selected-style diagnostics, inherited property source labels, and effective property display.
- Richer `.styles` preview application for default layout/state properties, alpha/text colors, style image refs, and hover/selected/disabled state simulation across core preview, standalone HTML, CLI, MCP, desktop API, and the desktop canvas.
- `.imageset` sprite upsert primitive with CLI and MCP access.
- PNG image import workflow with core, CLI, MCP, and web API access.
- PNG atlas packing workflow with core, CLI, MCP, desktop API, and web shell access.
- Texture conversion plan/run workflow with core, CLI, MCP, desktop API, and web shell access.
- Toolchain readiness report checks ImageToPAA availability and texture conversion plan readiness alongside the rest of the production pipeline.
- Asset browser API and web picker for direct images and `set:* image:*` sprites.
- Vanilla DayZ asset fallback via `DZUI_VANILLA_ASSETS` for `DZ/...` paths and built-in imagesets.

Remaining:

- Real installed ImageToPAA/EDDS converter execution validation against project texture requirements.
- Advanced Workbench-assisted font generation for raw TTF/OTF glyph atlas baking.

## Build Workflow

Status: scaffold started.

Done:

- PBO build workflow plan.
- AddonBuilder/Publisher/ImageToPAA discovery via DayZ Tools paths.
- Build manifest from project scan and validation summary.
- CLI, MCP, and web API access for build plans.
- Actual AddonBuilder execution with timeout, log capture, and PBO existence verification.
- CLI, MCP, and web UI access for build runs.
- Build profile persistence through `.dzui/project-settings.json`.
- Workshop publish/update workflow with PublisherCmd discovery, command-template override, content/PBO readiness checks, log capture, and CLI/MCP/web UI access.
- Unified toolchain readiness report aggregates AddonBuilder, PublisherCmd, project validation, PBO build, Workshop publish, engine capture, and texture conversion readiness through core, CLI, MCP, desktop API, and web shell access.

Remaining:

- Real-install PublisherCmd/Steam account execution validation and richer Workshop metadata/profile editing.

## Phase 4: MCP Server

Status: read/write scaffold exists with stdio and local HTTP transports.

Done:

- stdio JSON-RPC server.
- Localhost HTTP JSON-RPC transport bound to `127.0.0.1`, with `/mcp`, `/health`, basic SSE readiness on GET, and Origin validation for DNS rebinding protection.
- `project_scan`, `layout_parse`, `layout_inspect`, `preview_model`, `asset_resolve`.
- `layout_update_property` diff-first tool, dry-run by default and write-enabled with transaction history.
- `layout_create_widget`, `layout_delete_widget`, and `layout_reparent_widget` structural edit tools.
- `stringtable_update`, `style_list`, `style_update`, `imageset_upsert`, and `image_import` write tools, dry-run by default for MCP automation.
- `toolchain_readiness` read-only report for build/publish/engine/texture readiness.
- Prompt templates for layout review, safe transactional editing, asset pipeline tasks, build/release readiness, and engine fidelity workflows.
- Rich project resources when started with `--project`: manifest scan, file list, JSON-safe asset index, widget palette, plugin runtime registry, project settings, validation, toolchain readiness, and raw text project files.
- Resource `subscribe`/`unsubscribe` plus `notifications/resources/updated` and `notifications/resources/list_changed` for write automation over stdio and SSE-capable HTTP clients.

Remaining:

- Approval UI shared with editor.

## Phase 5: Engine Fidelity Bridge

Status: configuration scaffold started.

Done:

- DayZ Tools/DayZ/P drive path discovery from explicit options, env vars, and common Steam paths.
- Engine preview plan generation with missing requirement reporting.
- Workbench/DayZDiag launch-plan generation with command construction and CLI/MCP/web access.
- Temporary `.dzui/engine-preview` mission workspace generation with `init.c`, manifest, README, and launch `.cmd`.
- Geometry diff reports comparing DZUI preview boxes against engine geometry dumps, with CLI/MCP/web access.
- Pixel diff reports comparing DZUI/engine PNG screenshots, with optional visual diff PNG output.
- Capture workflow plan/run support for DayZDiag/Workbench or a configured capture command, with log capture and automatic geometry/pixel reports.
- Toolchain readiness report includes Workbench/DayZDiag discovery and engine launch/capture plan readiness.

Remaining:

- Real DayZDiag/Workbench screenshot and geometry export hook validation on an installed DayZ toolchain.
- Automated screenshot capture hardening for project-specific engine launch flows.

## Phase 6: Workbench Replacement Layer

Status: started with layout comparison and patch apply tooling.

Done:

- Structural layout diff reports comparing widget additions/removals, parent changes, type/name changes, and property changes.
- Core, CLI, MCP, desktop API, and web shell access for layout diff reports.
- Hash-guarded layout patch apply workflow for `updateProperty`, `updateBox`, `createWidget`, `deleteWidget`, and `reparentWidget` operations.
- Core, CLI, MCP, desktop API, and web shell dry-run/apply access for layout patch workflows, with history transactions on write paths.
- Patch generation from before/after `.layout` files, including reusable JSON patch artifacts and conflict reporting.
- Basic patch conflict-resolution workflow records explicit decisions in reusable JSON artifacts through core, CLI, MCP, desktop API, and the web shell.
- Semantic web UI for generated patch conflicts with per-conflict Skip, Accept generated, and Keep unresolved decisions.
- Unified web Readiness dashboard shows toolchain percent, missing requirements, warnings, and next actions.
- Workbench-style canvas group resize backed by the shared layout transform patch pipeline.
- Plugin SDK manifest discovery, validation, safe runtime registry, integrity package/verify manifest, Ed25519 package signatures, trusted-key install policy, verified runtime command hooks, and plugin widget presets exposed through core, CLI, MCP, desktop API, and the web shell.

Remaining:

- Real Workbench/DayZDiag validation and tuning for hover/selected/disabled preview-state simulation.
- Real DayZ Tools build/publish adapter validation.
- Signed/trusted plugin runtime package validation against real third-party plugin packages.

## Immediate Engineering Queue

1. Add native BC7/PAA decode only if the sidecar path is not sufficient for target projects.
2. Re-run scanner/validation against the real MGStalker ClientMods corpus when mounted.
3. Run toolchain-readiness against a real DayZ Tools/DayZ install and capture project-specific gaps.
4. Validate capture workflow against a real DayZDiag/Workbench installation and harden engine-side screenshot export.
5. Validate Workshop publish workflow against a real DayZ Tools PublisherCmd installation and Steam account.
6. Validate hover/selected/disabled preview-state simulation against real capture data and tune engine-specific mismatches.
7. Validate signed/trusted plugin runtime packages against real third-party plugin packages.
