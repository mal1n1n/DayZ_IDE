# Implementation Backlog

Current product focus: a DayZ `.layout` editor with accurate internal preview and an MCP server for Figma-to-layout automation.

## Editor

- Improve canvas geometry editing for anchors, exact position, exact size, and responsive layout behavior.
- Keep preview rendering aligned with parsed DayZ layout semantics.
- Harden undo/redo, source apply, patch generation, and conflict resolution around real project files.
- Improve diagnostics for unresolved assets, styles, fonts, stringtable keys, duplicate names, and invalid geometry.

## Preview

- Continue native texture preview support for project assets used by layouts.
- Improve imageset sprite cropping and state-specific visual simulation.
- Keep preview fast and deterministic without launching external applications.

## MCP

- Keep MCP tools focused on layout parsing, composition, patching, widget edits, preview models, and project asset resolution.
- Add higher-level helpers for Figma transfer: frame-to-layout composition, widget naming, asset ref mapping, and style reuse.
- Keep write operations dry-run by default where possible and report exact changed files.

## Assets

- Improve image import and imageset updates.
- Improve PNG atlas packing for Figma-exported sprites.
- Improve font, style, and stringtable authoring flows used by layouts.

## Explicitly Removed From Scope

- Mod build workflows.
- External game/editor launch and capture workflows.
- External texture conversion workflows.
