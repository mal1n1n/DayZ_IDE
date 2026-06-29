import fs from "node:fs";
import path from "node:path";

import { buildTextureConversionPlan } from "../assets/conversion.mjs";
import { buildPboWorkflowPlan } from "../build/workflow.mjs";
import { buildWorkshopPublishPlan } from "../build/workshop.mjs";
import { buildEngineCapturePlan } from "../engine/capture-workflow.mjs";
import { buildEngineLaunchPlan, discoverDayzTools } from "../engine/dayz-tools.mjs";
import { buildProjectAssetIndex } from "../assets/index.mjs";
import { validateProject } from "../validation/layout.mjs";

export function buildToolchainReadinessReport(options = {}) {
  const projectRoot = optionalResolved(options.projectRoot);
  const layoutPath = optionalResolved(options.layoutPath);
  const tools = options.tools ?? discoverDayzTools(options);
  const checks = [];
  const workflows = {};
  let projectIndex = null;
  let validation = null;

  addCheck(checks, {
    id: "project.root",
    label: "Project root",
    status: directoryExists(projectRoot) ? "ready" : "missing",
    message: directoryExists(projectRoot) ? "Project root is available." : "Select an existing DayZ ClientMods/project root.",
    path: projectRoot,
    requiredFor: ["validation", "build", "workshop", "engine"],
    weight: 2,
  });

  addToolChecks(checks, tools);

  if (directoryExists(projectRoot)) {
    try {
      projectIndex = options.projectIndex ?? buildProjectAssetIndex(projectRoot);
      validation = options.validation ?? validateProject(projectRoot, { projectIndex });
      const clean = validation.diagnosticCount === 0;
      addCheck(checks, {
        id: "project.validation",
        label: "Project validation",
        status: clean ? "ready" : options.allowDiagnostics === true ? "warning" : "blocked",
        message: clean
          ? "Project validation is clean."
          : `${validation.diagnosticCount} diagnostics found${options.allowDiagnostics === true ? "; allowed for planning." : "."}`,
        requiredFor: ["build", "workshop"],
        weight: 3,
        details: {
          diagnosticCount: validation.diagnosticCount,
        },
      });
      workflows.validation = {
        ready: clean,
        diagnosticCount: validation.diagnosticCount,
        diagnostics: validation.diagnostics?.slice(0, 20) ?? [],
      };
    } catch (error) {
      addCheck(checks, {
        id: "project.validation",
        label: "Project validation",
        status: "blocked",
        message: errorMessage(error),
        requiredFor: ["build", "workshop"],
        weight: 3,
      });
      workflows.validation = {
        ready: false,
        error: errorMessage(error),
      };
    }

    workflows.build = safePlan("build", () => buildPboWorkflowPlan({
      projectRoot,
      addonSource: options.addonSource,
      outputRoot: options.outputRoot,
      prefix: options.prefix,
      tools,
      projectIndex,
      validation,
      allowDiagnostics: options.allowDiagnostics === true,
    }));
    addWorkflowCheck(checks, "workflow.build", "PBO build workflow", workflows.build, ["AddonBuilder", "validation"], 3);

    workflows.workshop = safePlan("workshop", () => buildWorkshopPublishPlan({
      projectRoot,
      addonSource: options.addonSource,
      outputRoot: options.outputRoot,
      prefix: options.prefix,
      tools,
      projectIndex,
      validation,
      pboPath: options.pboPath,
      contentRoot: options.contentRoot,
      workshopItemId: options.workshopItemId ?? options.itemId,
      title: options.title,
      changeNote: options.changeNote,
      changeNoteFile: options.changeNoteFile,
      previewImage: options.previewImage,
      command: options.workshopCommand ?? options.command,
      allowDiagnostics: options.allowDiagnostics === true,
      requirePbo: options.requirePbo,
    }));
    addWorkflowCheck(checks, "workflow.workshop", "Workshop publish workflow", workflows.workshop, ["PublisherCmd", "built PBO"], 2);
  } else {
    workflows.validation = skippedWorkflow("Project root is required.");
    workflows.build = skippedWorkflow("Project root is required.");
    workflows.workshop = skippedWorkflow("Project root is required.");
  }

  workflows.engineLaunch = layoutPath && projectRoot
    ? safePlan("engineLaunch", () => buildEngineLaunchPlan({
      mode: options.mode,
      projectRoot,
      layoutPath,
      missionPath: options.missionPath,
      tools,
    }))
    : skippedWorkflow("Project root and layout path are required.");
  addWorkflowCheck(checks, "workflow.engineLaunch", "Engine launch workflow", workflows.engineLaunch, ["DayZDiag/Workbench"], 2);

  workflows.capture = layoutPath && projectRoot
    ? safePlan("capture", () => buildEngineCapturePlan({
      projectRoot,
      layoutPath,
      outputRoot: options.captureOutputRoot,
      expectedScreenshotPath: options.expectedScreenshotPath,
      actualScreenshotPath: options.actualScreenshotPath,
      geometryDumpPath: options.geometryDumpPath,
      pixelDiffPath: options.pixelDiffPath,
      command: options.captureCommand,
      tools,
    }))
    : skippedWorkflow("Project root and layout path are required.");
  addWorkflowCheck(checks, "workflow.capture", "Engine capture workflow", workflows.capture, ["DayZDiag/Workbench capture"], 2);

  const sourceImage = options.sourceImage ?? options.textureSource;
  workflows.textureConversion = sourceImage
    ? safePlan("textureConversion", () => buildTextureConversionPlan({
      sourceImage,
      outputPath: options.textureOutputPath ?? options.outputPath,
      format: options.textureFormat ?? options.format,
      tools,
      converterPath: options.converterPath,
      command: options.textureCommand,
    }))
    : skippedWorkflow("Texture source image is optional; provide one to verify conversion readiness.");
  addWorkflowCheck(checks, "workflow.textureConversion", "Texture conversion workflow", workflows.textureConversion, ["ImageToPAA/custom converter"], sourceImage ? 1.5 : 0);

  const score = scoreChecks(checks);
  const blocking = checks.filter((check) => check.status === "missing" || check.status === "blocked");

  return {
    kind: "ToolchainReadinessReport",
    ready: blocking.length === 0,
    percent: score.percent,
    score,
    generatedAt: new Date().toISOString(),
    inputs: {
      projectRoot,
      layoutPath,
      addonSource: optionalResolved(options.addonSource),
      outputRoot: optionalResolved(options.outputRoot),
      contentRoot: optionalResolved(options.contentRoot),
      sourceImage: sourceImage ? path.resolve(sourceImage) : null,
      textureOutputPath: optionalResolved(options.textureOutputPath ?? options.outputPath),
    },
    tools,
    checks,
    workflows,
    nextActions: blocking.slice(0, 12).map((check) => ({
      id: check.id,
      label: check.label,
      message: check.message,
      requiredFor: check.requiredFor,
    })),
  };
}

function addToolChecks(checks, tools) {
  addCheck(checks, toolCheck("tool.toolsRoot", "DayZ Tools root", tools.toolsRoot, ["all DayZ Tools workflows"], 1));
  addCheck(checks, toolCheck("tool.dayzRoot", "DayZ game root", tools.dayzRoot, ["DayZDiag capture"], 1));
  addCheck(checks, toolCheck("tool.pDrive", "P drive", tools.pDrive, ["Workbench projects", "addon build"], 0.75));
  addCheck(checks, toolCheck("tool.addonBuilder", "AddonBuilder.exe", tools.addonBuilder, ["PBO build"], 2));
  addCheck(checks, toolCheck("tool.imageToPaa", "ImageToPAA.exe", tools.imageToPaa, ["PAA texture conversion"], 1.5));
  addCheck(checks, toolCheck("tool.publisherCmd", "PublisherCmd.exe", tools.publisherCmd, ["Workshop publish"], 1.5));
  addCheck(checks, toolCheck("tool.publisher", "Publisher.exe", tools.publisher, ["manual Workshop publish"], 0.5));
  addCheck(checks, toolCheck("tool.workbench", "WorkbenchApp.exe", tools.workbench, ["Workbench preview"], 0.75));
  addCheck(checks, toolCheck("tool.dayzDiag", "DayZDiag_x64.exe", tools.dayzDiag, ["engine preview/capture"], 2));
  addCheck(checks, toolCheck("tool.texView", "TexView.exe", tools.texView, ["manual texture inspection"], 0.25));
}

function toolCheck(id, label, filePath, requiredFor, weight) {
  return {
    id,
    label,
    status: filePath ? "ready" : "missing",
    message: filePath ? `${label} found.` : `${label} was not found.`,
    path: filePath,
    requiredFor,
    weight,
  };
}

function addWorkflowCheck(checks, id, label, workflow, requiredFor, weight) {
  if (!workflow || workflow.skipped) {
    addCheck(checks, {
      id,
      label,
      status: "skipped",
      message: workflow?.reason ?? "Workflow was skipped.",
      requiredFor,
      weight: 0,
    });
    return;
  }
  if (workflow.error) {
    addCheck(checks, {
      id,
      label,
      status: "blocked",
      message: workflow.error,
      requiredFor,
      weight,
    });
    return;
  }
  addCheck(checks, {
    id,
    label,
    status: workflow.ready ? "ready" : "blocked",
    message: workflow.ready
      ? `${label} is ready.`
      : `Missing: ${(workflow.missing ?? []).join(", ") || "unknown requirement"}.`,
    requiredFor,
    weight,
    details: {
      missing: workflow.missing ?? [],
    },
  });
}

function safePlan(name, factory) {
  try {
    return factory();
  } catch (error) {
    return {
      kind: `${name}PlanError`,
      ready: false,
      error: errorMessage(error),
    };
  }
}

function skippedWorkflow(reason) {
  return {
    ready: false,
    skipped: true,
    reason,
  };
}

function scoreChecks(checks) {
  const scored = checks.filter((check) => Number(check.weight) > 0);
  const total = scored.reduce((sum, check) => sum + check.weight, 0);
  const earned = scored.reduce((sum, check) => {
    if (check.status === "ready") return sum + check.weight;
    if (check.status === "warning") return sum + (check.weight * 0.5);
    return sum;
  }, 0);
  return {
    earned,
    total,
    percent: total > 0 ? Math.round((earned / total) * 100) : 0,
  };
}

function addCheck(checks, check) {
  checks.push({
    id: check.id,
    label: check.label,
    status: check.status,
    message: check.message,
    path: check.path ?? null,
    requiredFor: check.requiredFor ?? [],
    weight: check.weight ?? 0,
    details: check.details ?? undefined,
  });
}

function optionalResolved(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  return path.resolve(value);
}

function directoryExists(dirPath) {
  return Boolean(dirPath) && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
