# DayZ IDE

DayZ IDE is focused on one workflow: edit DayZ `.layout` UI files with a fast local preview, then expose the same layout operations through MCP so Codex can move screens from Figma into DayZ UI files.

## Scope

- Open, inspect, edit, and save `.layout` files.
- Render an internal canvas preview from the parsed layout model.
- Resolve project UI assets such as `.imageset`, `.edds`, `.paa`, `.png`, styles, fonts, stringtable entries, and scripts.
- Import images, update imagesets, pack PNG atlases, and edit style/stringtable/font metadata needed by layouts.
- Run project/layout validation for editor correctness.
- Run an MCP server for Codex/Figma-assisted layout creation and edits.

## Out Of Scope

- Mod builds.
- External game/editor launch workflows.
- External texture conversion workflows.

## Common Commands

```powershell
npm.cmd run dev
npm.cmd run mcp:http
npm.cmd run parse -- fixtures/layouts/pda_minimal.layout
npm.cmd run inspect -- fixtures/layouts/pda_minimal.layout
npm.cmd run preview -- fixtures/layouts/pda_minimal.layout
npm.cmd run validate-project -- fixtures
npm.cmd run layout-palette
npm.cmd run layout-create -- --help
npm.cmd run image-import -- --help
npm.cmd run atlas-pack -- --help
```

## Desktop IDE

The desktop shell starts a local HTTP app. Initialize it with the DayZ project assets root, then use:

- `Editor` for layout loading, canvas preview, tree selection, geometry/property editing, source patching, and diagnostics.
- `Project` for project validation and controller skeleton generation.
- `Assets` for image, imageset, atlas, style, font, and stringtable work.
- `MCP` for starting the local MCP HTTP server used by Codex.

## MCP Focus

The MCP server exposes layout and asset operations for automation:

- parse, inspect, validate, diff, patch, compose, and transform layouts
- create, delete, reparent, and update widgets
- build preview models from `.layout` files
- resolve assets and scan project UI resources
- import images, update imagesets, pack atlases
- update stringtable and style files

This is the intended path for fast Figma-to-DayZ UI transfer: Codex reads the Figma design, uses MCP to compose/update `.layout` files, validates the result, and the desktop IDE previews it locally.
