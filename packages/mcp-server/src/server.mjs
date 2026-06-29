#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import readline from "node:readline";

import {
  applyLayoutPatch,
  buildLayoutDiffReport,
  buildLayoutPreviewModel,
  buildLayoutTransformPatch,
  buildTextureConversionPlan,
  buildToolchainReadinessReport,
  buildEngineCapturePlan,
  buildEngineLaunchPlan,
  buildEnginePreviewWorkspace,
  buildFontCoverageReport,
  buildGeometryDiffReport,
  buildPboWorkflowPlan,
  buildPluginRuntimePackage,
  buildPluginRuntimeRegistry,
  buildPluginSdkReport,
  buildWorkshopPublishPlan,
  buildPreviewData,
  buildProjectAssetIndex,
  createEditTransaction,
  createWidget,
  deleteWidget,
  diffPngFiles,
  fontRegistryToJson,
  generateControllerSkeleton,
  generateLayoutPatch,
  importFontAsset,
  importImageAsset,
  installPluginRuntimeTrust,
  instantiateWidgetPreset,
  layoutToPlainObject,
  listWidgetPalette,
  normalizeSlashes,
  packImageAtlas,
  parseLayout,
  parseStyleFile,
  normalizeProjectSettings,
  readProjectSettings,
  readPluginTrustPolicy,
  reparentWidget,
  resolveLayoutPatchConflicts,
  resolveImageReference,
  runPluginRuntimeCommand,
  runEngineCaptureWorkflow,
  runPboWorkflow,
  runWorkshopPublishWorkflow,
  runTextureConversionWorkflow,
  styleFileToJson,
  summarizeLayout,
  updateWidgetProperty,
  updateStringTableCsv,
  upsertStyleProperty,
  upsertImageSetSprite,
  validateLayoutDocument,
  validateProject,
  verifyPluginRuntimePackage,
  writeEnginePreviewWorkspace,
  writePluginRuntimePackage,
  writeProjectSettings,
} from "../../core/src/index.mjs";

const protocolVersion = "2025-06-18";
const args = parseArgs(process.argv.slice(2));
const defaultProjectRoot = args.get("--project") ? path.resolve(args.get("--project")) : null;
const resourceSubscriptions = new Set();
const sseClients = new Set();
const textResourceExtensions = new Set([
  ".c",
  ".cpp",
  ".csv",
  ".fnt",
  ".h",
  ".hpp",
  ".imageset",
  ".json",
  ".layout",
  ".meta",
  ".styles",
  ".xml",
]);

const tools = [
  {
    name: "project_scan",
    description: "Scan a DayZ ClientMods/project folder for layouts, EDDS, imagesets, and other UI assets.",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "Project root. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "layout_parse",
    description: "Parse a .layout file and return its widget tree and diagnostics.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
      },
    },
  },
  {
    name: "layout_inspect",
    description: "Return a compact summary of a .layout file, including image references.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
      },
    },
  },
  {
    name: "layout_validate",
    description: "Validate one .layout file with optional project context for assets, styles, fonts, and stringtable.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        project: { type: "string", description: "Project root for cross-file validation." },
      },
    },
  },
  {
    name: "layout_diff",
    description: "Compare two .layout files structurally, reporting added/removed widgets, parent/type/name changes, and property changes.",
    inputSchema: {
      type: "object",
      required: ["beforeFile", "afterFile"],
      properties: {
        beforeFile: { type: "string", description: "Baseline .layout file path." },
        afterFile: { type: "string", description: "Changed .layout file path." },
        includeUnchanged: { type: "boolean", description: "Include matched unchanged widgets in the response." },
      },
    },
  },
  {
    name: "layout_generate_patch",
    description: "Generate a machine-readable layout patch from a before .layout file and an after .layout file. Does not write by default.",
    inputSchema: {
      type: "object",
      required: ["beforeFile", "afterFile"],
      properties: {
        beforeFile: { type: "string", description: "Baseline .layout file path." },
        afterFile: { type: "string", description: "Changed .layout file path." },
        out: { type: "string", description: "Optional output JSON patch file. Written only when write=true." },
        write: { type: "boolean", description: "Write generated patch to out when true." },
        label: { type: "string", description: "Patch label." },
        allowDeleteLastRoot: { type: "boolean", description: "Include allowDeleteLastRoot on generated delete operations." },
      },
    },
  },
  {
    name: "layout_resolve_patch",
    description: "Resolve generated layout patch conflicts by recording explicit decisions in the patch artifact. Does not write by default.",
    inputSchema: {
      type: "object",
      properties: {
        patch: { type: "object", description: "Patch object with conflicts array." },
        patchFile: { type: "string", description: "Path to a JSON patch file." },
        out: { type: "string", description: "Optional output JSON patch file. Defaults to patchFile when write=true." },
        write: { type: "boolean", description: "Write the resolved patch to out or patchFile when true." },
        defaultAction: { type: "string", description: "Default action: skip, accept-generated, or unresolved." },
        decisions: { type: "array", description: "Optional per-conflict decisions by index, code, widgetId, or widgetName." },
        note: { type: "string", description: "Optional resolution note." },
      },
    },
  },
  {
    name: "project_validate",
    description: "Validate all layouts and script references in a DayZ project root.",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "Project root. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "plugin_sdk_report",
    description: "Discover and validate DZUI plugin manifests in a project without executing plugin code.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "plugin_runtime_registry",
    description: "Build the safe DZUI plugin runtime registry and package manifest without executing plugin code.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "plugin_runtime_package",
    description: "Build or write the DZUI plugin runtime integrity package manifest without executing plugin code.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        out: { type: "string", description: "Output package manifest path when write=true. Defaults to <project>/.dzui/plugin-runtime-package.json." },
        write: { type: "boolean", description: "Write the package manifest to disk when true." },
        signPrivateKeyPem: { type: "string", description: "PEM private key used to sign the runtime package manifest." },
        signPrivateKeyPath: { type: "string", description: "PEM private key path used to sign the runtime package manifest." },
        signPublicKeyPem: { type: "string", description: "Optional PEM public key stored with the package signature." },
        signPublicKeyPath: { type: "string", description: "Optional PEM public key path stored with the package signature." },
        signKeyId: { type: "string", description: "Stable key id for the package signature." },
      },
    },
  },
  {
    name: "plugin_runtime_verify",
    description: "Verify a DZUI plugin runtime integrity package manifest against the current project files.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        packagePath: { type: "string", description: "Package manifest JSON path. Defaults to <project>/.dzui/plugin-runtime-package.json." },
        manifest: { type: "object", description: "Package manifest object to verify instead of reading packagePath." },
        requireSignature: { type: "boolean", description: "Fail verification when the package is unsigned." },
        requireTrusted: { type: "boolean", description: "Fail verification when the signature key is not present in the trust policy." },
        trustPolicy: { type: "object", description: "Trust policy object with trustedKeys and optional requireSignature/requireTrusted." },
        trustPolicyPath: { type: "string", description: "Path to a trust policy JSON file." },
        trustedKeys: { type: "array", description: "Trusted public keys for signature verification." },
        trustedKeysPath: { type: "string", description: "Path to trusted keys JSON." },
      },
    },
  },
  {
    name: "plugin_runtime_trust",
    description: "Install or inspect the trusted-key policy for a signed DZUI plugin runtime package.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        packagePath: { type: "string", description: "Signed package manifest JSON path. Defaults to <project>/.dzui/plugin-runtime-package.json." },
        manifest: { type: "object", description: "Signed package manifest object to trust instead of reading packagePath." },
        trustPolicyPath: { type: "string", description: "Trust policy JSON path. Defaults to <project>/.dzui/plugin-trust-policy.json." },
        write: { type: "boolean", description: "Write the trusted key to the policy. Defaults to true." },
        list: { type: "boolean", description: "Return the current trust policy without installing a key." },
      },
    },
  },
  {
    name: "plugin_runtime_command",
    description: "Plan or execute a manifest-declared DZUI plugin command. Execution requires a verified plugin runtime package unless allowUntrusted=true.",
    inputSchema: {
      type: "object",
      required: ["commandId"],
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        commandId: { type: "string", description: "Runtime command id, e.g. plugin.id/command.id." },
        args: { type: "object", description: "JSON arguments passed to the plugin command." },
        packagePath: { type: "string", description: "Package manifest JSON path. Defaults to <project>/.dzui/plugin-runtime-package.json." },
        manifest: { type: "object", description: "Package manifest object to verify instead of reading packagePath." },
        execute: { type: "boolean", description: "Execute the command when true; otherwise return a plan." },
        allowUntrusted: { type: "boolean", description: "Allow execution without a passing package verification." },
        requireSignature: { type: "boolean", description: "Require a cryptographic package signature before execution." },
        requireTrusted: { type: "boolean", description: "Require the signature key to match the trust policy before execution." },
        trustPolicy: { type: "object", description: "Trust policy object with trustedKeys and optional requireSignature/requireTrusted." },
        trustPolicyPath: { type: "string", description: "Path to a trust policy JSON file." },
        trustedKeys: { type: "array", description: "Trusted public keys for signature verification." },
        trustedKeysPath: { type: "string", description: "Path to trusted keys JSON." },
      },
    },
  },
  {
    name: "font_list",
    description: "List project fonts with parsed glyph coverage when available.",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "Project root. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "font_check_layout",
    description: "Check one layout for unresolved fonts and missing glyph coverage diagnostics.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        project: { type: "string", description: "Project root for font/style/stringtable context. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "font_coverage_report",
    description: "Aggregate project font coverage across layout text samples, target stringtable languages, and BMFont atlas pages.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        layoutPath: { type: "string", description: "Optional single layout path. Defaults to all project layouts." },
        languages: { type: "array", items: { type: "string" }, description: "Target stringtable languages to check." },
      },
    },
  },
  {
    name: "font_import",
    description: "Import a font file into a project, copying BMFont page textures and reporting glyph coverage. Dry-run by default; set write=true to copy files.",
    inputSchema: {
      type: "object",
      required: ["projectRoot", "sourceFont"],
      properties: {
        projectRoot: { type: "string", description: "Project root." },
        sourceFont: { type: "string", description: "Source .fnt/.ttf/.otf/.woff font path." },
        fontVirtualPath: { type: "string", description: "Target virtual font path, e.g. gui/fonts/MyFont.fnt." },
        sampleText: { type: "string", description: "Optional text used to report missing glyphs after import." },
        write: { type: "boolean", description: "Copy font and BMFont page textures when true." },
      },
    },
  },
  {
    name: "project_settings_read",
    description: "Read persistent DZUI project settings from .dzui/project-settings.json, returning defaults when absent.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "project_settings_write",
    description: "Update persistent DZUI project settings. Dry-run by default; set write=true to save.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        settings: { type: "object", description: "Partial settings patch: layoutPath, preview, build, recent." },
        write: { type: "boolean", description: "Write .dzui/project-settings.json when true." },
      },
    },
  },
  {
    name: "toolchain_readiness",
    description: "Return one safe readiness report for DayZ Tools, project validation, build, Workshop publish, engine capture, and texture conversion workflows.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        layoutPath: { type: "string", description: "Layout file used for engine preview/capture readiness." },
        addonSource: { type: "string", description: "Addon source folder for PBO build readiness." },
        outputRoot: { type: "string", description: "Build output folder." },
        prefix: { type: "string", description: "PBO prefix." },
        toolsRoot: { type: "string", description: "DayZ Tools root." },
        dayzRoot: { type: "string", description: "DayZ game root." },
        pDrive: { type: "string", description: "P drive root." },
        pboPath: { type: "string", description: "Built PBO path for Workshop readiness." },
        contentRoot: { type: "string", description: "Workshop content root." },
        workshopItemId: { type: "string", description: "Existing Workshop item id." },
        title: { type: "string", description: "Workshop title metadata." },
        changeNote: { type: "string", description: "Workshop change note." },
        changeNoteFile: { type: "string", description: "Workshop change note file." },
        previewImage: { type: "string", description: "Workshop preview image." },
        workshopCommand: { type: "object", description: "Optional Publisher command template." },
        sourceImage: { type: "string", description: "Texture source image for conversion readiness." },
        textureOutputPath: { type: "string", description: "Texture conversion output path." },
        textureFormat: { type: "string", description: "Texture target format, e.g. paa or edds." },
        converterPath: { type: "string", description: "Explicit ImageToPAA.exe path." },
        textureCommand: { type: "object", description: "Optional texture converter command template." },
        captureCommand: { type: "object", description: "Optional engine capture command template." },
        captureOutputRoot: { type: "string", description: "Engine capture output root." },
        allowDiagnostics: { type: "boolean", description: "Treat project validation diagnostics as warnings for readiness scoring." },
        requirePbo: { type: "boolean", description: "Set false to skip the built PBO existence check." },
      },
    },
  },
  {
    name: "build_plan",
    description: "Create a safe PBO build workflow plan and manifest without running external tools.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        addonSource: { type: "string", description: "Addon source folder. Defaults to project root." },
        outputRoot: { type: "string", description: "Build output folder." },
        prefix: { type: "string", description: "PBO prefix." },
        allowDiagnostics: { type: "boolean", description: "Allow a plan to be ready even with validation diagnostics." },
      },
    },
  },
  {
    name: "engine_launch_plan",
    description: "Create a Workbench or DayZDiag launch plan for engine-fidelity preview without running external tools.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        layoutPath: { type: "string", description: "Layout file to preview." },
        mode: { type: "string", enum: ["dayzDiag", "workbench"], description: "Launch target. Defaults to dayzDiag." },
        missionPath: { type: "string", description: "Temporary preview mission folder." },
        toolsRoot: { type: "string", description: "DayZ Tools root." },
        dayzRoot: { type: "string", description: "DayZ game root." },
        pDrive: { type: "string", description: "P drive root." },
      },
    },
  },
  {
    name: "engine_preview_workspace",
    description: "Generate the temporary .dzui/engine-preview mission workspace for engine-fidelity preview. Dry-run by default; set write=true to create files.",
    inputSchema: {
      type: "object",
      required: ["layoutPath"],
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        layoutPath: { type: "string", description: "Layout file to load in the preview mission." },
        previewRoot: { type: "string", description: "Output root. Defaults to <project>/.dzui/engine-preview." },
        missionName: { type: "string", description: "Mission folder base name. Defaults to dzui_preview." },
        worldName: { type: "string", description: "Mission world suffix. Defaults to ChernarusPlus." },
        menuClass: { type: "string", description: "Generated UIScriptedMenu class name." },
        width: { type: "number", description: "Preview viewport width metadata." },
        height: { type: "number", description: "Preview viewport height metadata." },
        language: { type: "string", description: "Preview language metadata." },
        toolsRoot: { type: "string", description: "DayZ Tools root." },
        dayzRoot: { type: "string", description: "DayZ game root." },
        pDrive: { type: "string", description: "P drive root." },
        write: { type: "boolean", description: "Write generated workspace files when true." },
      },
    },
  },
  {
    name: "engine_geometry_diff",
    description: "Compare DZUI preview geometry against a DayZ engine geometry dump. Provide engineDump or engineDumpFile.",
    inputSchema: {
      type: "object",
      required: ["layoutPath"],
      properties: {
        layoutPath: { type: "string", description: "Layout file to render as the DZUI preview model." },
        projectRoot: { type: "string", description: "Project root for asset/stringtable context. Defaults to server --project when set." },
        engineDump: { type: "object", description: "Engine geometry dump object with widgets/nodes." },
        engineDumpFile: { type: "string", description: "Path to a JSON geometry dump file." },
        width: { type: "number", description: "Preview viewport width." },
        height: { type: "number", description: "Preview viewport height." },
        language: { type: "string", description: "Preview language." },
        tolerancePx: { type: "number", description: "Allowed geometry delta in pixels. Defaults to 1." },
      },
    },
  },
  {
    name: "engine_pixel_diff",
    description: "Compare two PNG screenshots and optionally write a visual diff PNG.",
    inputSchema: {
      type: "object",
      required: ["expectedPath", "actualPath"],
      properties: {
        expectedPath: { type: "string", description: "Expected/DZUI PNG screenshot path." },
        actualPath: { type: "string", description: "Actual/engine PNG screenshot path." },
        diffPath: { type: "string", description: "Optional output PNG path for visual diff." },
        tolerance: { type: "number", description: "Allowed per-channel delta, 0-255. Defaults to 0." },
        ignoreAlpha: { type: "boolean", description: "Ignore alpha channel differences." },
      },
    },
  },
  {
    name: "engine_capture_workflow",
    description: "Plan or run the engine capture workflow: launch command, collect screenshot/geometry outputs, and write diff reports. Dry-run plan by default; set execute=true to run.",
    inputSchema: {
      type: "object",
      required: ["projectRoot", "layoutPath"],
      properties: {
        projectRoot: { type: "string", description: "Project root." },
        layoutPath: { type: "string", description: "Layout file to preview." },
        command: { type: "object", description: "{ executable, args, cwd } override for testing/custom capture." },
        outputRoot: { type: "string", description: "Capture output root." },
        expectedScreenshotPath: { type: "string", description: "Expected DZUI screenshot path." },
        actualScreenshotPath: { type: "string", description: "Actual engine screenshot path." },
        geometryDumpPath: { type: "string", description: "Engine geometry dump JSON path." },
        pixelDiffPath: { type: "string", description: "Visual pixel diff PNG path." },
        geometryTolerancePx: { type: "number", description: "Geometry tolerance in px." },
        pixelTolerance: { type: "number", description: "Pixel channel tolerance." },
        timeoutMs: { type: "number", description: "Capture command timeout." },
        waitMs: { type: "number", description: "Wait after command for output files." },
        execute: { type: "boolean", description: "When true, run the capture command." },
      },
    },
  },
  {
    name: "build_run",
    description: "Run the AddonBuilder PBO workflow with log capture. Dry-run by default; set execute=true to run external tools.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        addonSource: { type: "string", description: "Addon source folder. Defaults to project root." },
        outputRoot: { type: "string", description: "Build output folder." },
        prefix: { type: "string", description: "PBO prefix." },
        toolsRoot: { type: "string", description: "DayZ Tools root containing Bin/AddonBuilder." },
        dayzRoot: { type: "string", description: "DayZ game root." },
        pDrive: { type: "string", description: "P drive root." },
        allowDiagnostics: { type: "boolean", description: "Allow a plan to be ready even with validation diagnostics." },
        allowNotReady: { type: "boolean", description: "Attempt execution even when the plan reports missing requirements." },
        timeoutMs: { type: "number", description: "External tool timeout in milliseconds." },
        execute: { type: "boolean", description: "When true, run AddonBuilder. Otherwise return the plan only." },
      },
    },
  },
  {
    name: "workshop_publish_plan",
    description: "Create a Workshop publish/update plan for PublisherCmd or a custom publish command without running external tools.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        addonSource: { type: "string", description: "Addon source folder used to infer the build output PBO." },
        outputRoot: { type: "string", description: "Build output folder used as the default Workshop content root." },
        prefix: { type: "string", description: "PBO prefix for the linked build plan." },
        pboPath: { type: "string", description: "Explicit built PBO path to verify before publishing." },
        contentRoot: { type: "string", description: "Folder passed to PublisherCmd /path. Defaults to build output root." },
        workshopItemId: { type: "string", description: "Existing Steam Workshop item id for PublisherCmd update." },
        title: { type: "string", description: "Workshop title metadata for custom command templates." },
        changeNote: { type: "string", description: "PublisherCmd /changeNote value." },
        changeNoteFile: { type: "string", description: "PublisherCmd /changeNoteFile path." },
        previewImage: { type: "string", description: "Preview image metadata for custom command templates." },
        command: { type: "object", description: "Optional { executable, args, cwd, env } template. Supports {pboPath}, {contentRoot}, {workshopItemId}, and related placeholders." },
        commandFile: { type: "string", description: "Path to a JSON command template file." },
        toolsRoot: { type: "string", description: "DayZ Tools root containing PublisherCmd." },
        dayzRoot: { type: "string", description: "DayZ game root." },
        pDrive: { type: "string", description: "P drive root." },
        allowDiagnostics: { type: "boolean", description: "Allow the plan to be ready with validation diagnostics." },
        requirePbo: { type: "boolean", description: "Set false to skip the built PBO existence check." },
      },
    },
  },
  {
    name: "workshop_publish_run",
    description: "Run the Workshop publish/update workflow with log capture. Dry-run by default; set execute=true to run PublisherCmd or the custom command.",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: { type: "string", description: "Project root. Defaults to server --project when set." },
        addonSource: { type: "string", description: "Addon source folder used to infer the build output PBO." },
        outputRoot: { type: "string", description: "Build output folder used as the default Workshop content root." },
        prefix: { type: "string", description: "PBO prefix for the linked build plan." },
        pboPath: { type: "string", description: "Explicit built PBO path to verify before publishing." },
        contentRoot: { type: "string", description: "Folder passed to PublisherCmd /path. Defaults to build output root." },
        workshopItemId: { type: "string", description: "Existing Steam Workshop item id for PublisherCmd update." },
        title: { type: "string", description: "Workshop title metadata for custom command templates." },
        changeNote: { type: "string", description: "PublisherCmd /changeNote value." },
        changeNoteFile: { type: "string", description: "PublisherCmd /changeNoteFile path." },
        previewImage: { type: "string", description: "Preview image metadata for custom command templates." },
        command: { type: "object", description: "Optional { executable, args, cwd, env } template. Supports {pboPath}, {contentRoot}, {workshopItemId}, and related placeholders." },
        commandFile: { type: "string", description: "Path to a JSON command template file." },
        toolsRoot: { type: "string", description: "DayZ Tools root containing PublisherCmd." },
        dayzRoot: { type: "string", description: "DayZ game root." },
        pDrive: { type: "string", description: "P drive root." },
        allowDiagnostics: { type: "boolean", description: "Allow the plan to be ready with validation diagnostics." },
        allowNotReady: { type: "boolean", description: "Attempt execution even when the plan reports missing requirements." },
        requirePbo: { type: "boolean", description: "Set false to skip the built PBO existence check." },
        timeoutMs: { type: "number", description: "External tool timeout in milliseconds." },
        execute: { type: "boolean", description: "When true, run PublisherCmd/custom command. Otherwise return the plan only." },
      },
    },
  },
  {
    name: "script_generate_controller",
    description: "Generate an Enforce Script controller skeleton from a .layout file.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        className: { type: "string", description: "Generated class name." },
        layoutPath: { type: "string", description: "Virtual layout path used in CreateWidgets." },
        baseClass: { type: "string", description: "Base class. Defaults to UIScriptedMenu." },
        out: { type: "string", description: "Optional output .c file. Only written when write=true." },
        write: { type: "boolean", description: "Write generated source to out path." },
      },
    },
  },
  {
    name: "stringtable_update",
    description: "Update or append one key in stringtable.csv. Dry-run by default; set write=true to save.",
    inputSchema: {
      type: "object",
      required: ["file", "key", "values"],
      properties: {
        file: { type: "string", description: "Path to stringtable.csv." },
        key: { type: "string", description: "String key, with or without #." },
        values: { type: "object", description: "Language column values." },
        write: { type: "boolean", description: "Write updated CSV to disk." },
        includeSource: { type: "boolean", description: "Include updated CSV source in the response." },
      },
    },
  },
  {
    name: "style_list",
    description: "Parse and list styles/properties from a .styles file.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to a .styles file." },
        noPreviewDiagnostics: { type: "boolean", description: "Skip preview-fidelity informational diagnostics." },
      },
    },
  },
  {
    name: "style_update",
    description: "Update/create one property in a .styles file. Dry-run by default; set write=true to save.",
    inputSchema: {
      type: "object",
      required: ["file", "styleName", "key"],
      properties: {
        file: { type: "string", description: "Path to a .styles file." },
        styleName: { type: "string", description: "Style name to update or create." },
        typeClass: { type: "string", description: "Style type for new styles. Defaults to StyleClass." },
        key: { type: "string", description: "Style property key." },
        values: { type: "array", items: {}, description: "Property values." },
        write: { type: "boolean", description: "Write the updated .styles file." },
        includeSource: { type: "boolean", description: "Include updated source in the response." },
      },
    },
  },
  {
    name: "imageset_upsert",
    description: "Create or update one sprite in a .imageset file. Dry-run by default; set write=true to save.",
    inputSchema: {
      type: "object",
      required: ["file", "textureRef", "imageName", "size"],
      properties: {
        file: { type: "string", description: "Path to .imageset file." },
        setName: { type: "string", description: "Imageset name." },
        textureRef: { type: "string", description: "Texture path referenced by the imageset." },
        imageName: { type: "string", description: "Sprite image name." },
        pos: { type: "array", items: { type: "number" }, description: "[x, y]. Defaults to [0, 0]." },
        size: { type: "array", items: { type: "number" }, description: "[width, height]." },
        flags: { type: "number", description: "Imageset flags." },
        write: { type: "boolean", description: "Write updated .imageset source to disk." },
        includeSource: { type: "boolean", description: "Include updated .imageset source in the response." },
      },
    },
  },
  {
    name: "image_import",
    description: "Copy an image into a project and update/create a .imageset sprite reference. Dry-run by default; set write=true to save.",
    inputSchema: {
      type: "object",
      required: ["projectRoot", "sourceImage", "assetVirtualPath", "imageSetVirtualPath"],
      properties: {
        projectRoot: { type: "string", description: "Project root." },
        sourceImage: { type: "string", description: "Source image path." },
        assetVirtualPath: { type: "string", description: "Target virtual image path inside the project." },
        imageSetVirtualPath: { type: "string", description: "Target .imageset virtual path." },
        setName: { type: "string", description: "Imageset name." },
        imageName: { type: "string", description: "Sprite image name." },
        pos: { type: "array", items: { type: "number" }, description: "[x, y]. Defaults to [0, 0]." },
        size: { type: "array", items: { type: "number" }, description: "[width, height]. Defaults to source image dimensions when available." },
        flags: { type: "number", description: "Imageset flags." },
        write: { type: "boolean", description: "Copy the image and write the .imageset file." },
        includeSource: { type: "boolean", description: "Include updated .imageset source in the response." },
      },
    },
  },
  {
    name: "atlas_pack",
    description: "Pack multiple PNG images into one atlas PNG and generate the matching .imageset. Dry-run by default; set write=true to save.",
    inputSchema: {
      type: "object",
      required: ["projectRoot", "sources", "assetVirtualPath", "imageSetVirtualPath"],
      properties: {
        projectRoot: { type: "string", description: "Project root." },
        sources: { type: "array", items: {}, description: "PNG source paths or objects { sourceImage, imageName }." },
        assetVirtualPath: { type: "string", description: "Target virtual atlas PNG path inside the project." },
        imageSetVirtualPath: { type: "string", description: "Target .imageset virtual path." },
        setName: { type: "string", description: "Imageset name." },
        maxWidth: { type: "number", description: "Maximum atlas row width. Defaults to 2048." },
        padding: { type: "number", description: "Pixels between sprites. Defaults to 2." },
        powerOfTwo: { type: "boolean", description: "Expand atlas dimensions to powers of two." },
        write: { type: "boolean", description: "Write atlas PNG and .imageset when true." },
        includeSource: { type: "boolean", description: "Include generated .imageset source in the response." },
      },
    },
  },
  {
    name: "texture_convert_plan",
    description: "Create a PNG/TGA to PAA or custom EDDS texture conversion plan without running external tools.",
    inputSchema: {
      type: "object",
      required: ["sourceImage"],
      properties: {
        sourceImage: { type: "string", description: "Source image path, usually a PNG atlas or imported PNG." },
        outputPath: { type: "string", description: "Target output path. Defaults to source with .paa." },
        format: { type: "string", description: "Target format, e.g. paa or edds." },
        toolsRoot: { type: "string", description: "DayZ Tools root containing ImageToPAA." },
        converterPath: { type: "string", description: "Explicit ImageToPAA.exe path." },
        command: { type: "object", description: "Custom converter command template with {source}, {out}, and {format} placeholders." },
      },
    },
  },
  {
    name: "texture_convert_run",
    description: "Run PNG/TGA to PAA or custom EDDS texture conversion with log capture. Dry-run readiness gate unless allowNotReady=true.",
    inputSchema: {
      type: "object",
      required: ["sourceImage"],
      properties: {
        sourceImage: { type: "string", description: "Source image path, usually a PNG atlas or imported PNG." },
        outputPath: { type: "string", description: "Target output path. Defaults to source with .paa." },
        format: { type: "string", description: "Target format, e.g. paa or edds." },
        toolsRoot: { type: "string", description: "DayZ Tools root containing ImageToPAA." },
        converterPath: { type: "string", description: "Explicit ImageToPAA.exe path." },
        command: { type: "object", description: "Custom converter command template with {source}, {out}, and {format} placeholders." },
        timeoutMs: { type: "number", description: "External converter timeout." },
        allowNotReady: { type: "boolean", description: "Attempt execution even when the plan has missing requirements." },
      },
    },
  },
  {
    name: "preview_model",
    description: "Build the canvas preview model for a layout with optional project asset resolution.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        project: { type: "string", description: "Project root for asset resolution." },
        width: { type: "number", description: "Preview viewport width." },
        height: { type: "number", description: "Preview viewport height." },
        language: { type: "string", description: "Preview stringtable language. Defaults to English." },
        previewState: { type: "string", enum: ["normal", "hover", "selected", "disabled"], description: "Widget state to simulate in preview." },
        state: { type: "string", enum: ["normal", "hover", "selected", "disabled"], description: "Alias for previewState." },
      },
    },
  },
  {
    name: "asset_resolve",
    description: "Resolve a direct EDDS/PAA/PNG/TGA reference or set:name image:sprite reference.",
    inputSchema: {
      type: "object",
      required: ["root", "ref"],
      properties: {
        root: { type: "string", description: "Project root." },
        ref: { type: "string", description: "Image reference to resolve." },
      },
    },
  },
  {
    name: "layout_update_property",
    description: "Diff-first update of one widget property. Dry-run by default; set write=true to save and create a history transaction.",
    inputSchema: {
      type: "object",
      required: ["file", "widgetId", "key", "values"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        widgetId: { type: "string", description: "Preview model widget id, e.g. rootFrame:0/Title:1." },
        key: { type: "string", description: "Property key to update, e.g. text, position, size, image0." },
        values: {
          oneOf: [
            { type: "array", items: {} },
            { type: "string" },
            { type: "number" },
          ],
          description: "Property values.",
        },
        write: { type: "boolean", description: "When true, write the updated source to disk." },
        includeSource: { type: "boolean", description: "When true, include updated source in the response." },
      },
    },
  },
  {
    name: "layout_widget_palette",
    description: "List reusable widget creation presets for DayZ layout authoring.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional search text." },
        projectRoot: { type: "string", description: "Project root for plugin widget presets. Defaults to server --project when set." },
      },
    },
  },
  {
    name: "layout_create_widget",
    description: "Create a widget under a parent widget by explicit type/name or by presetId. Dry-run by default; set write=true to save and create a history transaction.",
    inputSchema: {
      type: "object",
      required: ["file", "parentWidgetId"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        parentWidgetId: { type: "string", description: "Preview model parent widget id." },
        presetId: { type: "string", description: "Optional palette preset id, e.g. text.label or image.icon." },
        projectRoot: { type: "string", description: "Project root for plugin widget presets. Defaults to server --project when set." },
        typeClass: { type: "string", description: "Widget class, e.g. TextWidgetClass." },
        name: { type: "string", description: "New widget name. Defaults to preset defaultName when presetId is used." },
        props: { type: "object", description: "Property map, e.g. { position:[0,0], size:[0.1,0.1], text:'Label' }." },
        write: { type: "boolean", description: "When true, write the updated source to disk." },
        includeSource: { type: "boolean", description: "When true, include updated source in the response." },
      },
    },
  },
  {
    name: "layout_delete_widget",
    description: "Delete a widget block. Dry-run by default; set write=true to save and create a history transaction.",
    inputSchema: {
      type: "object",
      required: ["file", "widgetId"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        widgetId: { type: "string", description: "Preview model widget id." },
        allowDeleteLastRoot: { type: "boolean", description: "Allow deleting the only root widget." },
        write: { type: "boolean", description: "When true, write the updated source to disk." },
        includeSource: { type: "boolean", description: "When true, include updated source in the response." },
      },
    },
  },
  {
    name: "layout_reparent_widget",
    description: "Move a widget under another parent widget with source reindentation. Dry-run by default; set write=true to save and create a history transaction.",
    inputSchema: {
      type: "object",
      required: ["file", "widgetId", "parentWidgetId"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        widgetId: { type: "string", description: "Preview model widget id to move." },
        parentWidgetId: { type: "string", description: "Preview model target parent widget id." },
        write: { type: "boolean", description: "When true, write the updated source to disk." },
        includeSource: { type: "boolean", description: "When true, include updated source in the response." },
      },
    },
  },
  {
    name: "layout_apply_patch",
    description: "Apply a machine-readable layout patch using source-preserving operations. Dry-run by default; set write=true to save and create a history transaction.",
    inputSchema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", description: "Path to the target .layout file." },
        patch: { type: "object", description: "Patch object with optional beforeHash and operations array." },
        patchFile: { type: "string", description: "Path to a JSON patch file." },
        write: { type: "boolean", description: "When true, write the patched source to disk." },
        includeSource: { type: "boolean", description: "Include patched source in the response." },
        allowHashMismatch: { type: "boolean", description: "Allow patch.beforeHash mismatch." },
        allowDiagnostics: { type: "boolean", description: "Allow a patched result with parser diagnostics." },
      },
    },
  },
  {
    name: "layout_transform",
    description: "Align, distribute, translate, or resize selected layout widgets by generating and applying a hash-guarded layout patch. Dry-run by default; set write=true to save.",
    inputSchema: {
      type: "object",
      required: ["file", "action"],
      properties: {
        file: { type: "string", description: "Path to a .layout file." },
        action: { type: "string", description: "align-left, align-hcenter, align-right, align-top, align-vcenter, align-bottom, distribute-horizontal, distribute-vertical, translate, or resize-group." },
        widgetIds: { type: "array", items: { type: "string" }, description: "Preview widget ids to transform." },
        widgetNames: { type: "array", items: { type: "string" }, description: "Widget names to transform when ids are not available." },
        delta: { type: "array", items: { type: "number" }, description: "[x,y] pixel delta for translate." },
        targetBounds: {
          type: "object",
          description: "Target group bounds for resize-group in preview pixels.",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
          },
        },
        targetWidth: { type: "number", description: "Target group width for resize-group in preview pixels." },
        targetHeight: { type: "number", description: "Target group height for resize-group in preview pixels." },
        width: { type: "number", description: "Preview viewport width. Defaults to 1280." },
        height: { type: "number", description: "Preview viewport height. Defaults to 720." },
        write: { type: "boolean", description: "When true, write the transformed layout to disk." },
        includeSource: { type: "boolean", description: "Include transformed source in the response." },
        allowDiagnostics: { type: "boolean", description: "Allow a transformed result with parser diagnostics." },
      },
    },
  },
];

const promptTemplates = [
  {
    name: "dayz_ui_layout_review",
    description: "Review a DayZ .layout with project context, preview geometry, assets, styles, fonts, and localization diagnostics.",
    arguments: [
      { name: "layoutFile", description: "Path to the .layout file to review.", required: true },
      { name: "projectRoot", description: "Optional project root for assets/styles/fonts/stringtable.", required: false },
      { name: "focus", description: "Optional review focus, e.g. assets, layout, typography, or localization.", required: false },
    ],
    render(args) {
      return [
        "Review this DayZ UI layout for correctness, fidelity, and modding risks.",
        "",
        `Layout file: ${requiredPromptArg(args, "layoutFile")}`,
        `Project root: ${args.projectRoot || defaultProjectRoot || "not provided"}`,
        `Focus: ${args.focus || "overall layout, assets, styles, fonts, localization, and preview diagnostics"}`,
        "",
        "Use MCP tools in this order where applicable:",
        "1. layout_parse or layout_inspect to understand structure.",
        "2. preview_model with project context to inspect computed geometry and resolved image slots.",
        "3. layout_validate and project_validate for parser, asset, stringtable, style, and font diagnostics.",
        "4. asset_resolve for unresolved image or imageset references.",
        "Return findings first, with file/line references when available, then concise recommendations.",
      ].join("\n");
    },
  },
  {
    name: "dayz_ui_safe_edit",
    description: "Plan and perform a safe, transactional layout edit using dry-run tools before writing.",
    arguments: [
      { name: "layoutFile", description: "Path to the .layout file to edit.", required: true },
      { name: "changeRequest", description: "The requested layout change.", required: true },
      { name: "projectRoot", description: "Optional project root for validation/preview.", required: false },
    ],
    render(args) {
      return [
        "Make this DayZ UI layout change safely and transactionally.",
        "",
        `Layout file: ${requiredPromptArg(args, "layoutFile")}`,
        `Project root: ${args.projectRoot || defaultProjectRoot || "not provided"}`,
        `Change request: ${requiredPromptArg(args, "changeRequest")}`,
        "",
        "Workflow:",
        "1. Inspect current structure with layout_inspect and preview_model.",
        "2. Prefer specific write tools: layout_update_property, layout_create_widget, layout_delete_widget, layout_reparent_widget, layout_transform, or layout_apply_patch.",
        "3. Always dry-run first with write=false and includeSource=true when useful.",
        "4. Validate the resulting layout before any write.",
        "5. Write only after the dry-run result is coherent; preserve transaction metadata/history.",
        "6. Summarize changed widgets, validation status, and any remaining risks.",
      ].join("\n");
    },
  },
  {
    name: "dayz_ui_asset_pipeline",
    description: "Guide image/font/imageset/texture import and conversion work for a DayZ UI project.",
    arguments: [
      { name: "projectRoot", description: "Project root.", required: true },
      { name: "assetGoal", description: "What asset work should be done.", required: true },
      { name: "sourcePath", description: "Optional source image/font path.", required: false },
    ],
    render(args) {
      return [
        "Complete this DayZ UI asset pipeline task with safe dry-run/write behavior.",
        "",
        `Project root: ${requiredPromptArg(args, "projectRoot")}`,
        `Asset goal: ${requiredPromptArg(args, "assetGoal")}`,
        `Source path: ${args.sourcePath || "not provided"}`,
        "",
        "Relevant tools:",
        "- image_import for copying a source image and updating an .imageset.",
        "- atlas_pack for packing multiple PNG sprites into one atlas plus .imageset.",
        "- texture_convert_plan / texture_convert_run for ImageToPAA or custom EDDS/PAA conversion.",
        "- font_import and font_check_layout for font assets and glyph coverage.",
        "- asset_resolve and project_validate to verify references.",
        "Prefer dry-run first for MCP write tools, then write=true only when paths and diagnostics are acceptable.",
      ].join("\n");
    },
  },
  {
    name: "dayz_ui_build_release",
    description: "Prepare build, readiness, and Workshop publish/update steps for a DayZ UI mod.",
    arguments: [
      { name: "projectRoot", description: "Project root.", required: true },
      { name: "workshopItemId", description: "Optional Workshop item id for update.", required: false },
      { name: "changeNote", description: "Optional Workshop change note.", required: false },
    ],
    render(args) {
      return [
        "Prepare a build/release workflow for this DayZ UI project.",
        "",
        `Project root: ${requiredPromptArg(args, "projectRoot")}`,
        `Workshop item id: ${args.workshopItemId || "not provided"}`,
        `Change note: ${args.changeNote || "not provided"}`,
        "",
        "Workflow:",
        "1. Run toolchain_readiness with build/publish inputs.",
        "2. Run project_validate and inspect diagnostics.",
        "3. Use build_plan before build_run; do not execute external tools unless explicitly requested.",
        "4. Use workshop_publish_plan before workshop_publish_run; require clear item id/change note/content root.",
        "5. Return readiness percent, missing requirements, command previews, and log/output paths.",
      ].join("\n");
    },
  },
  {
    name: "dayz_ui_engine_fidelity",
    description: "Plan DayZDiag/Workbench preview capture and compare DZUI geometry/pixels against engine output.",
    arguments: [
      { name: "projectRoot", description: "Project root.", required: true },
      { name: "layoutFile", description: "Layout file to preview.", required: true },
      { name: "mode", description: "Optional mode: dayzDiag or workbench.", required: false },
    ],
    render(args) {
      return [
        "Set up and evaluate engine fidelity for this DayZ UI layout.",
        "",
        `Project root: ${requiredPromptArg(args, "projectRoot")}`,
        `Layout file: ${requiredPromptArg(args, "layoutFile")}`,
        `Mode: ${args.mode || "dayzDiag"}`,
        "",
        "Workflow:",
        "1. Use engine_launch_plan and engine_preview_workspace to inspect the launch/workspace plan.",
        "2. Use engine_capture_workflow as a plan first; execute only with explicit approval or a configured command.",
        "3. Use engine_geometry_diff and engine_pixel_diff for provided dumps/screenshots.",
        "4. Report command readiness, generated workspace files, geometry deltas, pixel summary, and next capture-hardening steps.",
      ].join("\n");
    },
  },
];

if (args.has("--http")) {
  startHttpTransport();
} else {
  startStdioTransport();
}

function startStdioTransport() {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      writeResponse({
        jsonrpc: "2.0",
        id: null,
        error: jsonRpcError(-32700, `Parse error: ${error.message}`),
      });
      return;
    }

    if (Array.isArray(message)) {
      writeResponse({
        jsonrpc: "2.0",
        id: null,
        error: jsonRpcError(-32600, "JSON-RPC batching is not supported by this scaffold."),
      });
      return;
    }

    const response = await dispatchJsonRpcMessage(message, {
      onNotificationError(error) {
        console.error(error instanceof Error ? error.stack : String(error));
      },
    });
    if (response) writeResponse(response);
  });
}

function startHttpTransport() {
  const host = args.get("--host") ?? "127.0.0.1";
  const port = Number(args.get("--port") ?? process.env.DZUI_MCP_HTTP_PORT ?? 8765);
  const endpoint = normalizeHttpEndpoint(args.get("--endpoint") ?? "/mcp");
  const allowNonLocal = args.has("--allow-nonlocal");

  if (!allowNonLocal && !isLoopbackHost(host)) {
    throw new Error(`Refusing non-loopback MCP HTTP host without --allow-nonlocal: ${host}`);
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? host}`);
      if (url.pathname === "/health") {
        sendHttpJson(response, 200, {
          ok: true,
          name: "dzui-mcp",
          transport: "http",
          endpoint,
          projectRoot: defaultProjectRoot,
        });
        return;
      }
      if (url.pathname !== endpoint) {
        sendHttpJson(response, 404, { error: "Not found." });
        return;
      }
      if (!isAllowedOrigin(request.headers.origin)) {
        sendHttpJson(response, 403, { error: "Origin is not allowed for local MCP HTTP transport." });
        return;
      }
      setCorsHeaders(response, request.headers.origin);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "GET") {
        sendSseReady(response);
        return;
      }
      if (request.method !== "POST") {
        response.writeHead(405, {
          Allow: "GET, POST, OPTIONS",
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify({ error: "Use POST for MCP JSON-RPC requests." }));
        return;
      }

      const body = await readRequestBody(request);
      const payload = JSON.parse(stripBom(body));
      const responsePayload = await dispatchHttpJsonRpc(payload);
      if (responsePayload === null) {
        response.writeHead(202);
        response.end();
        return;
      }
      sendHttpJson(response, 200, responsePayload);
    } catch (error) {
      sendHttpJson(response, 400, {
        jsonrpc: "2.0",
        id: null,
        error: jsonRpcError(error.code ?? -32603, error.message ?? String(error)),
      });
    }
  });

  server.listen(port, host, () => {
    console.error(`DZUI MCP HTTP transport listening at http://${host}:${server.address().port}${endpoint}`);
  });
}

async function dispatchHttpJsonRpc(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return {
        jsonrpc: "2.0",
        id: null,
        error: jsonRpcError(-32600, "JSON-RPC batch must not be empty."),
      };
    }
    const responses = [];
    for (const message of payload) {
      const response = await dispatchJsonRpcMessage(message);
      if (response) responses.push(response);
    }
    return responses.length ? responses : null;
  }
  return dispatchJsonRpcMessage(payload);
}

async function dispatchJsonRpcMessage(message, options = {}) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: jsonRpcError(-32600, "Invalid JSON-RPC request."),
    };
  }
  if (!("id" in message)) {
    handleNotification(message).catch((error) => {
      if (typeof options.onNotificationError === "function") {
        options.onNotificationError(error);
      }
    });
    return null;
  }
  try {
    const result = await handleRequest(message);
    return { jsonrpc: "2.0", id: message.id, result };
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: jsonRpcError(error.code ?? -32603, error.message ?? String(error)),
    };
  }
}

async function handleRequest(message) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion,
        capabilities: {
          tools: {},
          resources: {
            subscribe: true,
            listChanged: true,
          },
          prompts: {},
        },
        serverInfo: {
          name: "dzui-mcp",
          version: "0.0.0",
        },
      };
    case "tools/list":
      return { tools };
    case "tools/call":
      return callTool(message.params ?? {});
    case "resources/list":
      return listResources();
    case "resources/read":
      return readResource(message.params ?? {});
    case "resources/subscribe":
      return subscribeResource(message.params ?? {});
    case "resources/unsubscribe":
      return unsubscribeResource(message.params ?? {});
    case "prompts/list":
      return listPrompts();
    case "prompts/get":
      return getPrompt(message.params ?? {});
    case "ping":
      return {};
    default:
      throw Object.assign(new Error(`Unknown method: ${message.method}`), { code: -32601 });
  }
}

async function handleNotification(message) {
  if (message.method === "notifications/initialized") return;
  console.error(`Ignoring notification: ${message.method}`);
}

async function callTool(params) {
  const name = params.name;
  const input = params.arguments ?? {};

  if (name === "project_scan") {
    return toolResult(scanProject(resolveProjectRoot(input.root)));
  }
  if (name === "layout_parse") {
    const document = readLayout(input.file);
    return toolResult(layoutToPlainObject(document));
  }
  if (name === "layout_inspect") {
    const document = readLayout(input.file);
    return toolResult(summarizeLayout(document));
  }
  if (name === "layout_validate") {
    const document = readLayout(input.file);
    const projectRoot = input.project ? path.resolve(input.project) : defaultProjectRoot;
    const projectIndex = projectRoot ? buildProjectAssetIndex(projectRoot) : null;
    return toolResult({
      filePath: document.filePath,
      diagnostics: validateLayoutDocument(document, { projectIndex }),
    });
  }
  if (name === "layout_diff") {
    return toolResult(buildLayoutDiffReport(
      readLayout(input.beforeFile),
      readLayout(input.afterFile),
      { includeUnchanged: input.includeUnchanged === true },
    ));
  }
  if (name === "layout_generate_patch") {
    return toolResult(generateLayoutPatchTool(input));
  }
  if (name === "layout_resolve_patch") {
    return toolResult(resolveLayoutPatchTool(input));
  }
  if (name === "project_validate") {
    return toolResult(validateProject(resolveProjectRoot(input.root)));
  }
  if (name === "plugin_sdk_report") {
    return toolResult(buildPluginSdkReport(resolveProjectRoot(input.projectRoot)));
  }
  if (name === "plugin_runtime_registry") {
    return toolResult(buildPluginRuntimeRegistry(resolveProjectRoot(input.projectRoot)));
  }
  if (name === "plugin_runtime_package") {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    const packageOptions = {
      out: input.out,
      signPrivateKeyPem: input.signPrivateKeyPem,
      signPrivateKeyPath: input.signPrivateKeyPath,
      signPublicKeyPem: input.signPublicKeyPem,
      signPublicKeyPath: input.signPublicKeyPath,
      signKeyId: input.signKeyId,
    };
    if (input.write === true) {
      const result = writePluginRuntimePackage(projectRoot, packageOptions);
      notifyProjectResourcesForWrite(result.filePath, { listChanged: true, pluginChanged: true });
      return toolResult(result);
    }
    return toolResult(buildPluginRuntimePackage(projectRoot, packageOptions));
  }
  if (name === "plugin_runtime_verify") {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    return toolResult(verifyPluginRuntimePackage(projectRoot, input.manifest ?? input.packagePath, pluginTrustOptions(input)));
  }
  if (name === "plugin_runtime_trust") {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    if (input.list === true) return toolResult(readPluginTrustPolicy(projectRoot, { trustPolicyPath: input.trustPolicyPath }));
    const result = installPluginRuntimeTrust(projectRoot, input.manifest ?? input.packagePath, {
      trustPolicyPath: input.trustPolicyPath,
      write: input.write !== false,
    });
    if (result.written) notifyProjectResourcesForWrite(result.filePath, { listChanged: true, pluginChanged: true });
    return toolResult(result);
  }
  if (name === "plugin_runtime_command") {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    return toolResult(await runPluginRuntimeCommand(projectRoot, {
      commandId: input.commandId,
      args: input.args,
      packagePath: input.packagePath,
      manifest: input.manifest,
      execute: input.execute === true,
      allowUntrusted: input.allowUntrusted === true,
      ...pluginTrustOptions(input),
    }));
  }
  if (name === "font_list") {
    const root = resolveProjectRoot(input.root);
    return toolResult({
      projectRoot: root,
      ...fontRegistryToJson(buildProjectAssetIndex(root).fonts),
    });
  }
  if (name === "font_check_layout") {
    const document = readLayout(input.file);
    const root = resolveProjectRoot(input.project);
    const projectIndex = buildProjectAssetIndex(root);
    const diagnostics = validateLayoutDocument(document, { projectIndex })
      .filter((diagnostic) => diagnostic.code.startsWith("layout.font."));
    return toolResult({
      filePath: document.filePath,
      projectRoot: root,
      diagnosticCount: diagnostics.length,
      diagnostics,
    });
  }
  if (name === "font_coverage_report") {
    return toolResult(buildFontCoverageReport({
      projectRoot: resolveProjectRoot(input.projectRoot),
      layoutPath: input.layoutPath,
      languages: input.languages,
    }));
  }
  if (name === "font_import") {
    const result = importFontAsset({
      projectRoot: resolveProjectRoot(input.projectRoot),
      sourceFont: requireString(input.sourceFont, "sourceFont"),
      fontVirtualPath: input.fontVirtualPath ?? input.assetVirtualPath,
      sampleText: input.sampleText,
      write: input.write === true,
    });
    if (input.write === true) notifyProjectResourcesForWrite(result.targetPath ?? result.fontPath ?? null, { listChanged: true });
    return toolResult(result);
  }
  if (name === "project_settings_read") {
    return toolResult(readProjectSettings(resolveProjectRoot(input.projectRoot)));
  }
  if (name === "project_settings_write") {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    const current = readProjectSettings(projectRoot);
    const settings = normalizeProjectSettings(mergeObject(current.settings, input.settings ?? {}), { projectRoot });
    if (input.write === true) {
      const result = writeProjectSettings(projectRoot, settings);
      notifyProjectResourcesForWrite(result.filePath, { listChanged: true, settingsChanged: true });
      return toolResult(result);
    }
    return toolResult({
      filePath: current.filePath,
      exists: current.exists,
      written: false,
      settings,
    });
  }
  if (name === "toolchain_readiness") {
    return toolResult(buildToolchainReadinessReport({
      projectRoot: input.projectRoot ? resolveProjectRoot(input.projectRoot) : defaultProjectRoot,
      layoutPath: input.layoutPath,
      addonSource: input.addonSource,
      outputRoot: input.outputRoot,
      prefix: input.prefix,
      toolsRoot: input.toolsRoot,
      dayzRoot: input.dayzRoot,
      pDrive: input.pDrive,
      pboPath: input.pboPath,
      contentRoot: input.contentRoot,
      workshopItemId: input.workshopItemId ?? input.itemId,
      title: input.title,
      changeNote: input.changeNote,
      changeNoteFile: input.changeNoteFile,
      previewImage: input.previewImage,
      workshopCommand: input.workshopCommand,
      sourceImage: input.sourceImage,
      textureOutputPath: input.textureOutputPath,
      textureFormat: input.textureFormat,
      converterPath: input.converterPath,
      textureCommand: input.textureCommand,
      captureCommand: input.captureCommand,
      captureOutputRoot: input.captureOutputRoot,
      allowDiagnostics: input.allowDiagnostics === true,
      requirePbo: input.requirePbo === false ? false : undefined,
    }));
  }
  if (name === "build_plan") {
    return toolResult(buildPboWorkflowPlan({
      projectRoot: resolveProjectRoot(input.projectRoot),
      addonSource: input.addonSource,
      outputRoot: input.outputRoot,
      prefix: input.prefix,
      toolsRoot: input.toolsRoot,
      dayzRoot: input.dayzRoot,
      pDrive: input.pDrive,
      allowDiagnostics: input.allowDiagnostics === true,
    }));
  }
  if (name === "build_run") {
    const options = {
      projectRoot: resolveProjectRoot(input.projectRoot),
      addonSource: input.addonSource,
      outputRoot: input.outputRoot,
      prefix: input.prefix,
      toolsRoot: input.toolsRoot,
      dayzRoot: input.dayzRoot,
      pDrive: input.pDrive,
      allowDiagnostics: input.allowDiagnostics === true,
      allowNotReady: input.allowNotReady === true,
      timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
    };
    if (input.execute !== true) {
      return toolResult({
        execute: false,
        plan: buildPboWorkflowPlan(options),
      });
    }
    return toolResult(runPboWorkflow(options));
  }
  if (name === "workshop_publish_plan") {
    return toolResult(buildWorkshopPublishPlan(readWorkshopPublishOptions(input)));
  }
  if (name === "workshop_publish_run") {
    const options = readWorkshopPublishOptions(input);
    if (input.execute !== true) {
      return toolResult({
        execute: false,
        plan: buildWorkshopPublishPlan(options),
      });
    }
    return toolResult(runWorkshopPublishWorkflow(options));
  }
  if (name === "engine_launch_plan") {
    return toolResult(buildEngineLaunchPlan({
      mode: input.mode,
      projectRoot: resolveProjectRoot(input.projectRoot),
      layoutPath: input.layoutPath,
      missionPath: input.missionPath,
      toolsRoot: input.toolsRoot,
      dayzRoot: input.dayzRoot,
      pDrive: input.pDrive,
    }));
  }
  if (name === "engine_preview_workspace") {
    const options = {
      projectRoot: resolveProjectRoot(input.projectRoot),
      layoutPath: requireString(input.layoutPath, "layoutPath"),
      previewRoot: input.previewRoot,
      missionName: input.missionName,
      worldName: input.worldName,
      menuClass: input.menuClass,
      width: input.width,
      height: input.height,
      language: input.language,
      toolsRoot: input.toolsRoot,
      dayzRoot: input.dayzRoot,
      pDrive: input.pDrive,
    };
    return toolResult(input.write === true
      ? notifyToolResult(writeEnginePreviewWorkspace(options), { listChanged: true })
      : buildEnginePreviewWorkspace(options));
  }
  if (name === "engine_geometry_diff") {
    return toolResult(buildEngineGeometryDiff(input));
  }
  if (name === "engine_pixel_diff") {
    return toolResult(diffPngFiles({
      expectedPath: requireString(input.expectedPath, "expectedPath"),
      actualPath: requireString(input.actualPath, "actualPath"),
      diffPath: input.diffPath,
      tolerance: Number(input.tolerance ?? 0),
      ignoreAlpha: input.ignoreAlpha === true,
    }));
  }
  if (name === "engine_capture_workflow") {
    const options = {
      projectRoot: requireString(input.projectRoot, "projectRoot"),
      layoutPath: requireString(input.layoutPath, "layoutPath"),
      command: input.command,
      outputRoot: input.outputRoot,
      expectedScreenshotPath: input.expectedScreenshotPath,
      actualScreenshotPath: input.actualScreenshotPath,
      geometryDumpPath: input.geometryDumpPath,
      pixelDiffPath: input.pixelDiffPath,
      geometryTolerancePx: input.geometryTolerancePx,
      pixelTolerance: input.pixelTolerance,
      timeoutMs: input.timeoutMs,
      waitMs: input.waitMs,
    };
    return toolResult(input.execute === true
      ? runEngineCaptureWorkflow(options)
      : buildEngineCapturePlan(options));
  }
  if (name === "script_generate_controller") {
    return toolResult(generateController(input));
  }
  if (name === "preview_model") {
    const filePath = requireString(input.file, "file");
    const projectRoot = input.project ? path.resolve(input.project) : defaultProjectRoot;
    const projectIndex = projectRoot ? buildProjectAssetIndex(projectRoot) : null;
    const document = readLayout(filePath);
    const model = buildLayoutPreviewModel(document, {
      width: Number(input.width ?? 1280),
      height: Number(input.height ?? 720),
      projectIndex,
      language: input.language ?? "English",
      previewState: input.previewState ?? input.state ?? "normal",
    });
    return toolResult(buildPreviewData(model, {
      title: path.basename(filePath),
      cacheRoot: projectRoot ? path.join(projectRoot, ".dzui/preview-cache") : ".dzui/preview-cache",
    }));
  }
  if (name === "asset_resolve") {
    const root = resolveProjectRoot(input.root);
    const ref = requireString(input.ref, "ref");
    const projectIndex = buildProjectAssetIndex(root);
    return toolResult(resolveImageReference(ref, projectIndex));
  }
  if (name === "layout_update_property") {
    return toolResult(updateLayoutProperty(input));
  }
  if (name === "layout_widget_palette") {
    const projectRoot = input.projectRoot ? resolveProjectRoot(input.projectRoot) : defaultProjectRoot;
    return toolResult(listWidgetPalette({ query: input.query, projectRoot }));
  }
  if (name === "layout_create_widget") {
    return toolResult(applyLayoutStructuralEdit(input, "create"));
  }
  if (name === "layout_delete_widget") {
    return toolResult(applyLayoutStructuralEdit(input, "delete"));
  }
  if (name === "layout_reparent_widget") {
    return toolResult(applyLayoutStructuralEdit(input, "reparent"));
  }
  if (name === "layout_apply_patch") {
    return toolResult(applyLayoutPatchTool(input));
  }
  if (name === "layout_transform") {
    return toolResult(transformLayout(input));
  }
  if (name === "stringtable_update") {
    return toolResult(updateStringTable(input));
  }
  if (name === "style_list") {
    return toolResult(listStyles(input));
  }
  if (name === "style_update") {
    return toolResult(updateStyle(input));
  }
  if (name === "imageset_upsert") {
    return toolResult(updateImageSet(input));
  }
  if (name === "image_import") {
    return toolResult(importImage(input));
  }
  if (name === "atlas_pack") {
    return toolResult(packAtlas(input));
  }
  if (name === "texture_convert_plan") {
    return toolResult(buildTextureConversionPlan(readTextureConversionInput(input)));
  }
  if (name === "texture_convert_run") {
    return toolResult(runTextureConversionWorkflow({
      ...readTextureConversionInput(input),
      timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
      allowNotReady: input.allowNotReady === true,
    }));
  }

  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
}

function readWorkshopPublishOptions(input) {
  return {
    projectRoot: resolveProjectRoot(input.projectRoot),
    addonSource: input.addonSource,
    outputRoot: input.outputRoot,
    prefix: input.prefix,
    toolsRoot: input.toolsRoot,
    dayzRoot: input.dayzRoot,
    pDrive: input.pDrive,
    pboPath: input.pboPath,
    contentRoot: input.contentRoot,
    workshopItemId: input.workshopItemId ?? input.itemId,
    title: input.title,
    changeNote: input.changeNote,
    changeNoteFile: input.changeNoteFile,
    previewImage: input.previewImage,
    command: input.command ?? (input.commandFile ? readJsonFile(input.commandFile) : undefined),
    allowDiagnostics: input.allowDiagnostics === true,
    allowNotReady: input.allowNotReady === true,
    requirePbo: input.requirePbo === false ? false : undefined,
    timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
  };
}

function updateImageSet(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const updated = upsertImageSetSprite(content, {
    filePath,
    setName: input.setName ?? path.basename(filePath, ".imageset"),
    textureRef: requireString(input.textureRef, "textureRef"),
    imageName: requireString(input.imageName, "imageName"),
    pos: input.pos ?? [0, 0],
    size: input.size,
    flags: input.flags ?? 0,
  });
  const response = {
    filePath,
    setRef: updated.setRef,
    inserted: updated.inserted,
    written: false,
  };
  if (input.write === true) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, updated.source, "utf8");
    response.written = true;
    notifyProjectResourcesForWrite(filePath, { listChanged: true });
  }
  if (input.includeSource === true) response.source = updated.source;
  return response;
}

function mergeObject(base, patch) {
  const out = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = mergeObject(base?.[key] ?? {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function importImage(input) {
  const result = importImageAsset({
    projectRoot: requireString(input.projectRoot, "projectRoot"),
    sourceImage: requireString(input.sourceImage, "sourceImage"),
    assetVirtualPath: requireString(input.assetVirtualPath, "assetVirtualPath"),
    imageSetVirtualPath: requireString(input.imageSetVirtualPath, "imageSetVirtualPath"),
    setName: input.setName,
    imageName: input.imageName,
    pos: input.pos,
    size: input.size,
    flags: input.flags ?? 0,
    write: input.write === true,
    includeSource: input.includeSource === true,
  });
  if (input.write === true) notifyProjectResourcesForWrite(result.assetPath ?? result.imageSetPath ?? null, { listChanged: true });
  return result;
}

function packAtlas(input) {
  const result = packImageAtlas({
    projectRoot: requireString(input.projectRoot, "projectRoot"),
    sources: Array.isArray(input.sources) ? input.sources : [],
    assetVirtualPath: requireString(input.assetVirtualPath, "assetVirtualPath"),
    imageSetVirtualPath: requireString(input.imageSetVirtualPath, "imageSetVirtualPath"),
    setName: input.setName,
    maxWidth: input.maxWidth,
    padding: input.padding,
    powerOfTwo: input.powerOfTwo === true,
    write: input.write === true,
    includeSource: input.includeSource === true,
  });
  if (input.write === true) notifyProjectResourcesForWrite(result.atlasPath ?? result.imageSetPath ?? null, { listChanged: true });
  return result;
}

function readTextureConversionInput(input) {
  return {
    sourceImage: requireString(input.sourceImage, "sourceImage"),
    outputPath: input.outputPath,
    format: input.format,
    toolsRoot: input.toolsRoot,
    converterPath: input.converterPath,
    command: input.command,
  };
}

function generateController(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  const document = readLayout(filePath);
  const skeleton = generateControllerSkeleton(document, {
    className: input.className,
    layoutPath: input.layoutPath ?? filePath,
    baseClass: input.baseClass ?? "UIScriptedMenu",
  });
  const response = {
    className: skeleton.className,
    widgetCount: skeleton.widgets.length,
    source: skeleton.source,
    written: false,
  };
  if (input.write === true) {
    const out = path.resolve(requireString(input.out, "out"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, skeleton.source, "utf8");
    response.written = true;
    response.out = out;
    notifyProjectResourcesForWrite(out, { listChanged: true });
  }
  return response;
}

function buildEngineGeometryDiff(input) {
  const layoutPath = path.resolve(requireString(input.layoutPath, "layoutPath"));
  const projectRoot = input.projectRoot ? path.resolve(input.projectRoot) : defaultProjectRoot;
  const projectIndex = projectRoot ? buildProjectAssetIndex(projectRoot) : null;
  const document = readLayout(layoutPath);
  const model = buildLayoutPreviewModel(document, {
    width: Number(input.width ?? 1280),
    height: Number(input.height ?? 720),
    projectIndex,
    language: input.language ?? "English",
  });
  const engineDump = input.engineDump ?? readJsonFile(requireString(input.engineDumpFile, "engineDumpFile"));
  return buildGeometryDiffReport(model, engineDump, {
    tolerancePx: Number(input.tolerancePx ?? 1),
  });
}

function updateStringTable(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "Key,English\n";
  const updated = updateStringTableCsv(source, {
    key: requireString(input.key, "key"),
    values: input.values ?? {},
  });
  const response = {
    filePath,
    key: updated.key,
    inserted: updated.inserted,
    written: false,
  };
  if (input.write === true) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, updated.source, "utf8");
    response.written = true;
    notifyProjectResourcesForWrite(filePath);
  }
  if (input.includeSource === true) response.source = updated.source;
  return response;
}

function listStyles(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  return styleFileToJson(parseStyleFile(source, { filePath }), {
    includePreviewDiagnostics: input.noPreviewDiagnostics !== true,
  });
}

function updateStyle(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const updated = upsertStyleProperty(source, {
    filePath,
    styleName: requireString(input.styleName, "styleName"),
    typeClass: input.typeClass ?? "StyleClass",
    key: requireString(input.key, "key"),
    values: Array.isArray(input.values) ? input.values : [],
  });
  const styled = styleFileToJson(parseStyleFile(updated.source, { filePath }));
  const response = {
    filePath,
    style: updated.style,
    insertedStyle: updated.insertedStyle,
    insertedProperty: updated.insertedProperty,
    diagnosticCount: styled.diagnosticCount,
    diagnostics: styled.diagnostics,
    written: false,
  };
  if (input.write === true) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, updated.source, "utf8");
    response.written = true;
    notifyProjectResourcesForWrite(filePath);
  }
  if (input.includeSource === true) response.source = updated.source;
  return response;
}

function readJsonFile(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw Object.assign(new Error(`JSON file does not exist: ${absolute}`), { code: -32602 });
  }
  return JSON.parse(fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/, ""));
}

function generateLayoutPatchTool(input) {
  const beforeFile = path.resolve(requireString(input.beforeFile, "beforeFile"));
  const afterFile = path.resolve(requireString(input.afterFile, "afterFile"));
  const patch = generateLayoutPatch(readLayout(beforeFile), readLayout(afterFile), {
    label: input.label,
    allowDeleteLastRoot: input.allowDeleteLastRoot === true,
  });
  const response = {
    ...patch,
    written: false,
    out: input.out ? path.resolve(input.out) : null,
  };
  if (input.write === true) {
    const out = path.resolve(requireString(input.out, "out"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(patch, null, 2)}\n`, "utf8");
    response.written = true;
    response.out = out;
    notifyProjectResourcesForWrite(out, { listChanged: true });
  }
  return response;
}

function resolveLayoutPatchTool(input) {
  const patchFile = input.patchFile ? path.resolve(input.patchFile) : null;
  const patch = input.patch ?? readJsonFile(requireString(input.patchFile, "patchFile"));
  const resolved = resolveLayoutPatchConflicts(patch, {
    defaultAction: input.defaultAction ?? "skip",
    decisions: Array.isArray(input.decisions) ? input.decisions : [],
    note: input.note,
  });
  const response = {
    ...resolved,
    written: false,
    patchFile,
    out: input.out ? path.resolve(input.out) : patchFile,
  };
  if (input.write === true) {
    const out = input.out ? path.resolve(input.out) : patchFile;
    if (!out) throw Object.assign(new Error("out or patchFile is required when write=true."), { code: -32602 });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
    response.written = true;
    response.out = out;
    notifyProjectResourcesForWrite(out, { listChanged: true });
  }
  return response;
}

function applyLayoutPatchTool(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw Object.assign(new Error(`Layout file does not exist: ${filePath}`), { code: -32602 });
  }

  const patch = input.patch ?? readJsonFile(requireString(input.patchFile, "patchFile"));
  const beforeSource = fs.readFileSync(filePath, "utf8");
  const result = applyLayoutPatch(beforeSource, patch, {
    filePath,
    includeSource: true,
    allowHashMismatch: input.allowHashMismatch === true,
    allowDiagnostics: input.allowDiagnostics === true,
  });
  const response = {
    written: false,
    filePath,
    patchFile: input.patchFile ? path.resolve(input.patchFile) : null,
    ...withoutSource(result),
  };

  if (result.ok && input.write === true) {
    const transaction = createEditTransaction({
      filePath,
      beforeSource,
      afterSource: result.source,
      edit: {
        type: "layout-patch",
        label: result.label,
        operations: result.operations,
      },
      label: result.label ?? "MCP layout patch",
    });
    const historyPath = writeHistoryTransaction(transaction);
    fs.writeFileSync(filePath, result.source, "utf8");
    response.written = true;
    response.historyPath = historyPath;
    response.transactionId = transaction.id;
    notifyProjectResourcesForWrite(filePath);
  }

  if (input.includeSource === true) response.source = result.source;
  return response;
}

function transformLayout(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw Object.assign(new Error(`Layout file does not exist: ${filePath}`), { code: -32602 });
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const document = parseLayout(beforeSource, { filePath });
  const transformed = buildLayoutTransformPatch(document, {
    action: requireString(input.action, "action"),
    widgetIds: Array.isArray(input.widgetIds) ? input.widgetIds : [],
    widgetNames: Array.isArray(input.widgetNames) ? input.widgetNames : [],
    delta: input.delta,
    targetBounds: input.targetBounds,
    targetWidth: input.targetWidth,
    targetHeight: input.targetHeight,
    width: Number(input.width ?? 1280),
    height: Number(input.height ?? 720),
  });
  if (!transformed.ok) {
    throw Object.assign(new Error(transformed.reason), { code: -32602 });
  }
  const result = applyLayoutPatch(beforeSource, transformed.patch, {
    filePath,
    includeSource: true,
    allowDiagnostics: input.allowDiagnostics === true,
  });
  const response = {
    written: false,
    filePath,
    transform: transformed,
    ...withoutSource(result),
  };

  if (result.ok && input.write === true) {
    const transaction = createEditTransaction({
      filePath,
      beforeSource,
      afterSource: result.source,
      edit: {
        type: "layout-transform",
        action: transformed.action,
        operations: result.operations,
      },
      label: transformed.patch.label ?? "MCP layout transform",
    });
    const historyPath = writeHistoryTransaction(transaction);
    fs.writeFileSync(filePath, result.source, "utf8");
    response.written = true;
    response.historyPath = historyPath;
    response.transactionId = transaction.id;
    notifyProjectResourcesForWrite(filePath);
  }

  if (input.includeSource === true) response.source = result.source;
  return response;
}

function applyLayoutStructuralEdit(input, operation) {
  const filePath = path.resolve(requireString(input.file, "file"));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw Object.assign(new Error(`Layout file does not exist: ${filePath}`), { code: -32602 });
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const projectRoot = input.projectRoot ? resolveProjectRoot(input.projectRoot) : defaultProjectRoot;
  const preset = operation === "create" && input.presetId
    ? instantiateWidgetPreset(input.presetId, {
      projectRoot,
      name: input.name,
      props: input.props,
    })
    : null;
  if (preset && !preset.ok) {
    throw Object.assign(new Error(preset.reason), { code: -32602 });
  }
  const updated = operation === "create"
    ? createWidget(beforeSource, {
      filePath,
      parentWidgetId: requireString(input.parentWidgetId, "parentWidgetId"),
      typeClass: preset?.typeClass ?? requireString(input.typeClass, "typeClass"),
      name: preset?.name ?? requireString(input.name, "name"),
      props: preset?.props ?? input.props,
    })
    : operation === "delete"
      ? deleteWidget(beforeSource, {
        filePath,
        widgetId: requireString(input.widgetId, "widgetId"),
        allowDeleteLastRoot: input.allowDeleteLastRoot === true,
      })
      : reparentWidget(beforeSource, {
        filePath,
        widgetId: requireString(input.widgetId, "widgetId"),
        parentWidgetId: requireString(input.parentWidgetId, "parentWidgetId"),
      });
  if (!updated.ok) {
    throw Object.assign(new Error(updated.reason), { code: -32602 });
  }

  const transaction = createEditTransaction({
    filePath,
    beforeSource,
    afterSource: updated.source,
    edit: updated.edit,
    label: `MCP ${operation} widget`,
  });
  const response = {
    written: false,
    filePath,
    operation,
    transactionId: transaction.id,
    beforeHash: transaction.before.hash,
    afterHash: transaction.after.hash,
    edit: updated.edit,
    widget: updated.widget,
    parent: updated.parent,
  };

  if (input.write === true) {
    const historyPath = writeHistoryTransaction(transaction);
    fs.writeFileSync(filePath, updated.source, "utf8");
    response.written = true;
    response.historyPath = historyPath;
    notifyProjectResourcesForWrite(filePath);
  }

  if (input.includeSource === true) response.source = updated.source;
  return response;
}

function updateLayoutProperty(input) {
  const filePath = path.resolve(requireString(input.file, "file"));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw Object.assign(new Error(`Layout file does not exist: ${filePath}`), { code: -32602 });
  }

  const beforeSource = fs.readFileSync(filePath, "utf8");
  const updated = updateWidgetProperty(beforeSource, {
    filePath,
    widgetId: requireString(input.widgetId, "widgetId"),
    key: requireString(input.key, "key"),
    values: Array.isArray(input.values) ? input.values : [input.values],
  });
  if (!updated.ok) {
    throw Object.assign(new Error(updated.reason), { code: -32602 });
  }

  const transaction = createEditTransaction({
    filePath,
    beforeSource,
    afterSource: updated.source,
    edit: updated.edit,
    label: `MCP update ${input.widgetId}.${input.key}`,
  });
  const response = {
    written: false,
    filePath,
    transactionId: transaction.id,
    beforeHash: transaction.before.hash,
    afterHash: transaction.after.hash,
    edit: updated.edit,
  };

  if (input.write === true) {
    const historyPath = writeHistoryTransaction(transaction);
    fs.writeFileSync(filePath, updated.source, "utf8");
    response.written = true;
    response.historyPath = historyPath;
    notifyProjectResourcesForWrite(filePath);
  }

  if (input.includeSource === true) {
    response.source = updated.source;
  }

  return response;
}

function listResources() {
  if (!defaultProjectRoot) return { resources: [] };
  const index = buildProjectAssetIndex(defaultProjectRoot);
  const fileResources = index.files
    .filter((filePath) => textResourceExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((a, b) => relativeProjectPath(a).localeCompare(relativeProjectPath(b)))
    .map((filePath) => ({
      uri: projectFileResourceUri(filePath),
      name: relativeProjectPath(filePath),
      description: `Project file: ${relativeProjectPath(filePath)}`,
      mimeType: mimeTypeForFile(filePath),
    }));
  return {
    resources: [
      {
        uri: "dayzui://project/manifest",
        name: "Project manifest",
        description: "Compact project scan with counts for layouts, assets, styles, fonts, stringtable, and scripts.",
        mimeType: "application/json",
      },
      {
        uri: "dayzui://project/files",
        name: "Project files",
        description: "Relative paths for indexed project files.",
        mimeType: "application/json",
      },
      {
        uri: "dayzui://project/asset-index",
        name: "Project asset index",
        description: "JSON-safe asset index summary for EDDS, imagesets, styles, fonts, stringtable, and scripts.",
        mimeType: "application/json",
      },
      {
        uri: "dayzui://project/widget-palette",
        name: "Widget palette",
        description: "Built-in and plugin-provided widget creation presets.",
        mimeType: "application/json",
      },
      {
        uri: "dayzui://project/plugin-runtime",
        name: "Plugin runtime registry",
        description: "Safe plugin runtime registry and package manifest.",
        mimeType: "application/json",
      },
      {
        uri: "dayzui://project/settings",
        name: "Project settings",
        description: "Normalized .dzui/project-settings.json state.",
        mimeType: "application/json",
      },
      {
        uri: "dayzui://project/validation",
        name: "Project validation",
        description: "Project validation report for layouts, scripts, assets, and stringtable references.",
        mimeType: "application/json",
      },
      {
        uri: "dayzui://project/toolchain-readiness",
        name: "Toolchain readiness",
        description: "Readiness report for DayZ Tools, build, Workshop, texture conversion, and engine capture workflows.",
        mimeType: "application/json",
      },
      ...fileResources,
    ],
  };
}

function readResource(params) {
  const uri = requireString(params.uri, "uri");
  if (!defaultProjectRoot) {
    throw Object.assign(new Error("No --project root configured for resources."), { code: -32602 });
  }

  if (uri === "dayzui://project/manifest") {
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(scanProject(defaultProjectRoot), null, 2),
      }],
    };
  }
  if (uri === "dayzui://project/files") {
    const index = buildProjectAssetIndex(defaultProjectRoot);
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify(index.files.map((filePath) => path.relative(defaultProjectRoot, filePath)), null, 2),
      }],
    };
  }
  if (uri === "dayzui://project/asset-index") {
    return jsonResource(uri, buildProjectAssetIndexResource(defaultProjectRoot));
  }
  if (uri === "dayzui://project/widget-palette") {
    return jsonResource(uri, listWidgetPalette({ projectRoot: defaultProjectRoot }));
  }
  if (uri === "dayzui://project/plugin-runtime") {
    return jsonResource(uri, buildPluginRuntimeRegistry(defaultProjectRoot));
  }
  if (uri === "dayzui://project/settings") {
    return jsonResource(uri, readProjectSettings(defaultProjectRoot));
  }
  if (uri === "dayzui://project/validation") {
    return jsonResource(uri, validateProject(defaultProjectRoot));
  }
  if (uri === "dayzui://project/toolchain-readiness") {
    return jsonResource(uri, buildToolchainReadinessReport({ projectRoot: defaultProjectRoot }));
  }
  if (uri.startsWith("dayzui://project/file?")) {
    const filePath = resolveProjectFileResource(uri);
    return {
      contents: [{
        uri,
        mimeType: mimeTypeForFile(filePath),
        text: fs.readFileSync(filePath, "utf8"),
      }],
    };
  }

  throw Object.assign(new Error(`Unknown resource: ${uri}`), { code: -32602 });
}

function subscribeResource(params) {
  const uri = requireString(params.uri, "uri");
  ensureKnownResource(uri);
  resourceSubscriptions.add(uri);
  return {};
}

function unsubscribeResource(params) {
  const uri = requireString(params.uri, "uri");
  resourceSubscriptions.delete(uri);
  return {};
}

function ensureKnownResource(uri) {
  const resources = listResources().resources ?? [];
  if (!resources.some((resource) => resource.uri === uri)) {
    throw Object.assign(new Error(`Unknown resource: ${uri}`), { code: -32602 });
  }
}

function notifyToolResult(result, options = {}) {
  notifyProjectResourcesForWrite(options.filePath ?? result?.filePath ?? result?.previewRoot ?? null, options);
  return result;
}

function notifyProjectResourcesForWrite(filePath = null, options = {}) {
  if (!defaultProjectRoot) return;
  const updated = new Set([
    "dayzui://project/manifest",
    "dayzui://project/files",
    "dayzui://project/asset-index",
    "dayzui://project/validation",
    "dayzui://project/toolchain-readiness",
  ]);
  if (options.settingsChanged || isProjectSettingsFile(filePath)) {
    updated.add("dayzui://project/settings");
  }
  if (options.pluginChanged || isPluginRelatedFile(filePath)) {
    updated.add("dayzui://project/plugin-runtime");
    updated.add("dayzui://project/widget-palette");
  }
  const fileUri = filePath ? projectFileResourceUriIfSupported(filePath) : null;
  if (fileUri) updated.add(fileUri);
  emitResourceNotifications({
    updatedUris: [...updated],
    listChanged: options.listChanged === true,
  });
}

function emitResourceNotifications({ updatedUris = [], listChanged = false } = {}) {
  if (listChanged) {
    sendJsonRpcNotification("notifications/resources/list_changed", {});
  }
  for (const uri of updatedUris) {
    if (!resourceSubscriptions.has(uri)) continue;
    sendJsonRpcNotification("notifications/resources/updated", { uri });
  }
}

function sendJsonRpcNotification(method, params = {}) {
  const payload = {
    jsonrpc: "2.0",
    method,
    params,
  };
  if (sseClients.size > 0) {
    const message = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of [...sseClients]) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
    return;
  }
  if (args.has("--http")) return;
  writeResponse(payload);
}

function projectFileResourceUriIfSupported(filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(defaultProjectRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (!textResourceExtensions.has(path.extname(resolved).toLowerCase())) return null;
  return `dayzui://project/file?path=${encodeURIComponent(relative.replace(/\\/g, "/"))}`;
}

function isProjectSettingsFile(filePath) {
  return filePath
    && path.basename(filePath).toLowerCase() === "project-settings.json"
    && path.basename(path.dirname(filePath)).toLowerCase() === ".dzui";
}

function isPluginRelatedFile(filePath) {
  if (!filePath) return false;
  const normalized = normalizeSlashes(path.relative(defaultProjectRoot, path.resolve(filePath))).toLowerCase();
  return normalized.includes("dzui-plugins/")
    || normalized.endsWith("dzui.plugin.json")
    || normalized.endsWith("plugin.dzui.json")
    || normalized.endsWith(".dzui/plugin-runtime-package.json")
    || normalized.endsWith(".dzui/plugin-trust-policy.json");
}

function jsonResource(uri, value) {
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(value, null, 2),
    }],
  };
}

function projectFileResourceUri(filePath) {
  return `dayzui://project/file?path=${encodeURIComponent(relativeProjectPath(filePath))}`;
}

function relativeProjectPath(filePath) {
  return path.relative(defaultProjectRoot, filePath).replace(/\\/g, "/");
}

function resolveProjectFileResource(uri) {
  let relativePath;
  try {
    const url = new URL(uri);
    relativePath = url.searchParams.get("path");
  } catch {
    throw Object.assign(new Error(`Invalid resource URI: ${uri}`), { code: -32602 });
  }
  if (!relativePath) {
    throw Object.assign(new Error(`Missing project file resource path: ${uri}`), { code: -32602 });
  }
  const resolved = path.resolve(defaultProjectRoot, relativePath);
  const relative = path.relative(defaultProjectRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw Object.assign(new Error(`Project file resource escapes project root: ${relativePath}`), { code: -32602 });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw Object.assign(new Error(`Project file resource does not exist: ${relativePath}`), { code: -32602 });
  }
  if (!textResourceExtensions.has(path.extname(resolved).toLowerCase())) {
    throw Object.assign(new Error(`Project file resource is not a supported text asset: ${relativePath}`), { code: -32602 });
  }
  return resolved;
}

function buildProjectAssetIndexResource(projectRoot) {
  const index = buildProjectAssetIndex(projectRoot);
  return {
    kind: "ProjectAssetIndexResource",
    root: projectRoot,
    counts: index.counts,
    files: index.files.map((filePath) => relativeProjectPath(filePath)),
    edds: index.edds.map((entry) => ({
      virtualPath: entry.virtualPath,
      readable: entry.readable,
      format: entry.format ?? null,
      width: entry.width ?? null,
      height: entry.height ?? null,
    })),
    imageSets: index.imageSets.map((set) => ({
      name: set.name,
      virtualPath: set.virtualPath,
      imageCount: set.images.length,
      textureCount: set.textureRefs.length,
    })),
    styles: {
      files: index.styles.files.map((file) => ({
        filePath: relativeProjectPath(file.filePath),
        virtualPath: file.virtualPath,
        styleCount: file.styles.length,
      })),
      names: [...index.styles.byName.keys()].sort(),
    },
    fonts: fontRegistryToJson(index.fonts),
    stringTable: {
      tables: index.stringTable.tables.map((table) => ({
        filePath: relativeProjectPath(table.filePath),
        columns: table.columns,
        entryCount: table.entries.length,
      })),
      diagnostics: index.stringTable.diagnostics,
    },
    scripts: {
      scripts: index.scripts.scripts.map((script) => ({
        filePath: relativeProjectPath(script.filePath),
        virtualPath: script.virtualPath,
      })),
      refs: {
        createWidgets: index.scripts.refs.createWidgets.length,
        findWidgets: index.scripts.refs.findWidgets.length,
        setText: index.scripts.refs.setText.length,
        loadImages: index.scripts.refs.loadImages.length,
      },
      diagnostics: index.scripts.diagnostics,
    },
  };
}

function mimeTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".csv") return "text/csv";
  if (ext === ".xml" || ext === ".imageset" || ext === ".fnt") return "application/xml";
  return "text/plain";
}

function listPrompts() {
  return {
    prompts: promptTemplates.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    })),
  };
}

function getPrompt(params) {
  const name = requireString(params.name, "name");
  const prompt = promptTemplates.find((candidate) => candidate.name === name);
  if (!prompt) {
    throw Object.assign(new Error(`Unknown prompt: ${name}`), { code: -32602 });
  }
  const argumentsObject = params.arguments ?? {};
  const text = prompt.render(argumentsObject);
  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text,
        },
      },
    ],
  };
}

function requiredPromptArg(args, name) {
  if (typeof args?.[name] !== "string" || !args[name].trim()) {
    throw Object.assign(new Error(`Prompt argument "${name}" is required.`), { code: -32602 });
  }
  return args[name].trim();
}

function scanProject(root) {
  const index = buildProjectAssetIndex(root);
  const eddsReadable = index.edds.filter((entry) => entry.readable).length;
  return {
    root,
    counts: index.counts,
    edds: {
      total: index.edds.length,
      ddsHeaderReadable: eddsReadable,
      unreadable: index.edds.length - eddsReadable,
    },
    imageSets: index.imageSets.map((set) => ({
      name: set.name,
      path: set.virtualPath,
      images: set.images.length,
      textures: set.textureRefs.length,
    })),
    styles: {
      files: index.styles.files.length,
      total: index.styles.byName.size,
    },
    fonts: {
      total: index.fonts.fonts.length,
      knownCoverage: fontRegistryToJson(index.fonts).knownCoverage,
    },
    stringTable: {
      files: index.stringTable.tables.length,
      entries: index.stringTable.tables.reduce((count, table) => count + table.entries.length, 0),
      diagnostics: index.stringTable.diagnostics,
    },
    scripts: {
      total: index.scripts.scripts.length,
      createWidgets: index.scripts.refs.createWidgets.length,
      findWidgets: index.scripts.refs.findWidgets.length,
      setText: index.scripts.refs.setText.length,
      loadImages: index.scripts.refs.loadImages.length,
    },
  };
}

function writeHistoryTransaction(transaction) {
  const historyRoot = path.join(path.dirname(transaction.filePath), ".dzui", "history");
  fs.mkdirSync(historyRoot, { recursive: true });
  const safeBase = path.basename(transaction.filePath ?? "layout").replace(/[^A-Za-z0-9_.-]/g, "_");
  const historyPath = path.join(historyRoot, `${Date.now()}-${safeBase}.json`);
  fs.writeFileSync(historyPath, JSON.stringify({ ...transaction, historyPath }, null, 2), "utf8");
  return historyPath;
}

function readLayout(filePath) {
  const absoluteFilePath = path.resolve(requireString(filePath, "file"));
  if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
    throw Object.assign(new Error(`Layout file does not exist: ${absoluteFilePath}`), { code: -32602 });
  }
  return parseLayout(fs.readFileSync(absoluteFilePath, "utf8"), { filePath: absoluteFilePath });
}

function resolveProjectRoot(root) {
  const resolved = path.resolve(root ?? defaultProjectRoot ?? "");
  if (!root && !defaultProjectRoot) {
    throw Object.assign(new Error("Project root is required."), { code: -32602 });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw Object.assign(new Error(`Project root does not exist: ${resolved}`), { code: -32602 });
  }
  return resolved;
}

function toolResult(value) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(value, null, 2),
    }],
    structuredContent: value,
  };
}

function pluginTrustOptions(input) {
  return {
    requireSignature: input.requireSignature === true,
    requireTrusted: input.requireTrusted === true,
    trustPolicy: input.trustPolicy,
    trustPolicyPath: input.trustPolicyPath,
    trustedKeys: input.trustedKeys,
    trustedKeysPath: input.trustedKeysPath,
  };
}

function withoutSource(value) {
  const { source, ...rest } = value;
  return rest;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error(`${name} must be a non-empty string.`), { code: -32602 });
  }
  return value;
}

function jsonRpcError(code, message) {
  return { code, message };
}

function writeResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function sendHttpJson(response, status, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendSseReady(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  sseClients.add(response);
  response.on("close", () => {
    sseClients.delete(response);
  });
  response.write(`event: ready\ndata: ${JSON.stringify({ ok: true, server: "dzui-mcp" })}\n\n`);
}

function setCorsHeaders(response, origin) {
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type, mcp-protocol-version, mcp-session-id");
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHost(host) {
  const normalized = String(host ?? "").toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1";
}

function normalizeHttpEndpoint(endpoint) {
  const text = String(endpoint || "/mcp").trim();
  return text.startsWith("/") ? text : `/${text}`;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) {
        reject(Object.assign(new Error("Request body is too large."), { code: -32600 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function stripBom(value) {
  return String(value).replace(/^\uFEFF/, "");
}

function parseArgs(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(arg, next);
      index += 1;
    } else {
      options.set(arg, "true");
    }
  }
  return options;
}
