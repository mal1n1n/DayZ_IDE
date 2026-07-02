# DayZ UI Editor Research Plan

The editor should be a focused layout authoring tool, not a launcher or release pipeline.

## Goal

Build a desktop DayZ `.layout` editor with a reliable internal preview and an MCP automation layer for moving Figma screens into project layout files.

## Core Workflows

1. Open an existing `.layout` file.
2. Resolve project assets, styles, fonts, stringtable values, and scripts.
3. Preview the layout in the desktop canvas.
4. Edit geometry and typed properties.
5. Import or pack image assets as needed.
6. Save the layout with history and validation.
7. Let Codex use MCP to compose or patch layouts from Figma context.

## MCP Automation

MCP should expose only editor-safe operations:

- project scan and asset resolution
- layout parse, inspect, validate, compose, diff, patch, and transform
- widget create, delete, reparent, and property update
- preview model generation
- imageset and atlas helpers
- style, font, and stringtable helpers

## Preview Strategy

The preview is produced by the local parser and preview model. It must stay fast, deterministic, and available without launching external software.

## Non-Goals

- Mod packaging.
- Publishing.
- External launch/capture workflows.
- External texture conversion.
