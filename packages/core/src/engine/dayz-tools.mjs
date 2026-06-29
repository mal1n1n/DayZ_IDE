import fs from "node:fs";
import path from "node:path";

export function discoverDayzTools(options = {}) {
  const env = options.env ?? process.env;
  const toolsRoot = firstExisting([
    options.toolsRoot,
    env.DAYZ_TOOLS,
    env.DAYZ_TOOLS_ROOT,
    "C:/Program Files (x86)/Steam/steamapps/common/DayZ Tools",
    "C:/Program Files/Steam/steamapps/common/DayZ Tools",
  ]);
  const dayzRoot = firstExisting([
    options.dayzRoot,
    env.DAYZ_ROOT,
    "C:/Program Files (x86)/Steam/steamapps/common/DayZ",
    "C:/Program Files/Steam/steamapps/common/DayZ",
  ]);
  const pDrive = firstExisting([
    options.pDrive,
    env.DAYZ_P_DRIVE,
    "P:/",
  ]);

  return {
    toolsRoot,
    dayzRoot,
    pDrive,
    workbench: findExecutable(toolsRoot, [
      "Bin/Workbench/WorkbenchApp.exe",
      "Workbench/WorkbenchApp.exe",
      "Bin/Workbench.exe",
    ]),
    dayzDiag: findExecutable(dayzRoot, [
      "DayZDiag_x64.exe",
      "DayZ_x64.exe",
    ]),
    imageToPaa: findExecutable(toolsRoot, [
      "Bin/ImageToPAA/ImageToPAA.exe",
      "Bin/ImageToPAA.exe",
    ]),
    addonBuilder: findExecutable(toolsRoot, [
      "Bin/AddonBuilder/AddonBuilder.exe",
      "Bin/AddonBuilder.exe",
      "AddonBuilder/AddonBuilder.exe",
    ]),
    publisher: findExecutable(toolsRoot, [
      "Bin/Publisher/Publisher.exe",
      "Bin/Publisher.exe",
      "Publisher/Publisher.exe",
    ]),
    publisherCmd: findExecutable(toolsRoot, [
      "Bin/Publisher/PublisherCmd.exe",
      "Bin/PublisherCmd.exe",
      "Publisher/PublisherCmd.exe",
    ]),
    texView: findExecutable(toolsRoot, [
      "Bin/TexView/TexView.exe",
      "Bin/TexView.exe",
    ]),
  };
}

export function buildEnginePreviewPlan({ projectRoot, layoutPath, tools = discoverDayzTools() }) {
  const missing = [];
  if (!tools.dayzDiag) missing.push("DayZDiag_x64.exe or DayZ_x64.exe");
  if (!projectRoot) missing.push("projectRoot");
  if (!layoutPath) missing.push("layoutPath");

  return {
    ready: missing.length === 0,
    missing,
    tools,
    projectRoot: projectRoot ? path.resolve(projectRoot) : null,
    layoutPath: layoutPath ? path.resolve(layoutPath) : null,
    steps: [
      "Build or reuse a temporary preview mission/mod that loads the target layout.",
      "Launch DayZDiag with local project/mod paths and scripted preview entrypoint.",
      "Capture screenshot and optional geometry dump.",
      "Compare engine screenshot/geometry with DZUI canvas preview.",
      "Report pixel/geometry differences back to the editor diagnostics panel.",
    ],
  };
}

export function buildEngineLaunchPlan(options = {}) {
  const mode = options.mode === "workbench" ? "workbench" : "dayzDiag";
  const tools = options.tools ?? discoverDayzTools(options);
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : null;
  const layoutPath = options.layoutPath ? path.resolve(options.layoutPath) : null;
  const previewRoot = projectRoot ? path.join(projectRoot, ".dzui", "engine-preview") : null;
  const missionPath = options.missionPath
    ? path.resolve(options.missionPath)
    : previewRoot ? path.join(previewRoot, "missions", "dzui_preview.ChernarusPlus") : null;
  const missing = [];
  const executable = mode === "workbench" ? tools.workbench : tools.dayzDiag;

  if (!projectRoot) missing.push("projectRoot");
  if (!layoutPath) missing.push("layoutPath");
  if (mode === "workbench" && !tools.workbench) missing.push("WorkbenchApp.exe");
  if (mode === "dayzDiag" && !tools.dayzDiag) missing.push("DayZDiag_x64.exe or DayZ_x64.exe");

  const command = executable ? {
    executable,
    args: mode === "workbench"
      ? workbenchArgs({ projectRoot, layoutPath, extraArgs: options.extraArgs })
      : dayzDiagArgs({ projectRoot, missionPath, extraArgs: options.extraArgs }),
    cwd: tools.dayzRoot ?? projectRoot ?? process.cwd(),
  } : null;

  return {
    kind: "EngineLaunchPlan",
    mode,
    ready: missing.length === 0,
    missing,
    tools,
    projectRoot,
    layoutPath,
    previewRoot,
    missionPath,
    command,
    steps: [
      "Generate or refresh the temporary DZUI preview mission/mod under .dzui/engine-preview.",
      mode === "workbench"
        ? "Open the project in Workbench so the layout can be inspected against engine UI behavior."
        : "Launch DayZDiag with file patching and the temporary preview mission.",
      "Load the target layout through the preview entrypoint.",
      "Capture screenshot and geometry data for comparison with the DZUI canvas preview.",
      "Return fidelity diagnostics to the editor.",
    ],
    notes: [
      "This is a launch plan only; it does not start external executables.",
      "Command-line arguments may need project-specific adjustment once the temporary preview mission is generated.",
    ],
  };
}

export function buildEnginePreviewWorkspace(options = {}) {
  const projectRoot = path.resolve(requiredString(options.projectRoot, "projectRoot"));
  const layoutPath = path.resolve(requiredString(options.layoutPath, "layoutPath"));
  const previewRoot = path.resolve(options.previewRoot ?? path.join(projectRoot, ".dzui", "engine-preview"));
  const missionName = sanitizeFilePart(options.missionName ?? "dzui_preview");
  const worldName = sanitizeFilePart(options.worldName ?? "ChernarusPlus");
  const missionPath = path.resolve(
    options.missionPath ?? path.join(previewRoot, "missions", `${missionName}.${worldName}`),
  );
  const layoutRef = options.layoutRef ?? layoutReference(projectRoot, layoutPath);
  const menuClass = sanitizeIdentifier(options.menuClass ?? "DzuiPreviewMenu");
  const missionClass = sanitizeIdentifier(options.missionClass ?? "DzuiPreviewMission");
  const width = positiveInteger(options.width, 1280);
  const height = positiveInteger(options.height, 720);
  const language = nonEmptyString(options.language) ?? "English";
  const launchPlan = buildEngineLaunchPlan({
    ...options,
    projectRoot,
    layoutPath,
    missionPath,
  });
  const manifest = {
    kind: "DzuiEnginePreviewWorkspace",
    version: 1,
    projectRoot,
    layoutPath,
    layoutRef,
    previewRoot,
    missionPath,
    missionName,
    worldName,
    menuClass,
    missionClass,
    viewport: { width, height },
    language,
  };
  const files = [
    {
      role: "mission-init",
      filePath: path.join(missionPath, "init.c"),
      source: renderPreviewMissionInit({
        layoutRef,
        menuClass,
        missionClass,
        width,
        height,
        language,
      }),
    },
    {
      role: "manifest",
      filePath: path.join(previewRoot, "dzui-preview-workspace.json"),
      source: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      role: "readme",
      filePath: path.join(previewRoot, "README.txt"),
      source: renderPreviewWorkspaceReadme({ manifest, launchPlan }),
    },
    {
      role: "launch-dayzdiag",
      filePath: path.join(previewRoot, "launch-dayzdiag.cmd"),
      source: renderDayzDiagLaunchCmd(launchPlan),
    },
  ];

  return {
    ...manifest,
    files,
    launchPlan,
  };
}

export function writeEnginePreviewWorkspace(options = {}) {
  const workspace = buildEnginePreviewWorkspace(options);
  for (const file of workspace.files) {
    fs.mkdirSync(path.dirname(file.filePath), { recursive: true });
    fs.writeFileSync(file.filePath, file.source, "utf8");
  }
  return {
    ...workspace,
    written: true,
    files: workspace.files.map((file) => ({
      role: file.role,
      filePath: file.filePath,
      bytes: Buffer.byteLength(file.source, "utf8"),
    })),
  };
}

function workbenchArgs({ projectRoot, layoutPath, extraArgs }) {
  return [
    ...(projectRoot ? [projectRoot] : []),
    ...(layoutPath ? [`-dzuiLayout=${layoutPath}`] : []),
    ...arrayOfStrings(extraArgs),
  ];
}

function dayzDiagArgs({ projectRoot, missionPath, extraArgs }) {
  return [
    "-filePatching",
    ...(projectRoot ? [`-mod=${projectRoot}`] : []),
    ...(missionPath ? [`-mission=${missionPath}`] : []),
    ...arrayOfStrings(extraArgs),
  ];
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim());
}

function renderPreviewMissionInit({ layoutRef, menuClass, missionClass, width, height, language }) {
  return `static const string DZUI_PREVIEW_LAYOUT = "${escapeEnforceString(layoutRef)}";
static const int DZUI_PREVIEW_WIDTH = ${width};
static const int DZUI_PREVIEW_HEIGHT = ${height};
static const string DZUI_PREVIEW_LANGUAGE = "${escapeEnforceString(language)}";

class ${menuClass}: UIScriptedMenu
{
  protected Widget m_Root;

  override Widget Init()
  {
    m_Root = GetGame().GetWorkspace().CreateWidgets(DZUI_PREVIEW_LAYOUT);
    return m_Root;
  }

  override void OnHide()
  {
    super.OnHide();
    if (m_Root)
    {
      m_Root.Unlink();
      m_Root = null;
    }
  }
}

class ${missionClass}: MissionGameplay
{
  protected ref ${menuClass} m_DzuiPreviewMenu;

  override void OnInit()
  {
    super.OnInit();
    GetGame().GetCallQueue(CALL_CATEGORY_GUI).CallLater(ShowDzuiPreview, 500, false);
  }

  void ShowDzuiPreview()
  {
    if (!m_DzuiPreviewMenu)
    {
      m_DzuiPreviewMenu = new ${menuClass};
      GetGame().GetUIManager().ShowScriptedMenu(m_DzuiPreviewMenu, NULL);
    }
  }
}

Mission CreateCustomMission(string path)
{
  return new ${missionClass};
}
`;
}

function renderPreviewWorkspaceReadme({ manifest, launchPlan }) {
  const command = launchPlan.command
    ? `${launchPlan.command.executable} ${launchPlan.command.args.join(" ")}`
    : `Missing: ${launchPlan.missing.join(", ") || "none"}`;
  return [
    "DZUI engine preview workspace",
    "",
    `Layout: ${manifest.layoutRef}`,
    `Mission: ${manifest.missionPath}`,
    `Viewport: ${manifest.viewport.width}x${manifest.viewport.height}`,
    `Language: ${manifest.language}`,
    "",
    "DayZDiag launch plan:",
    command,
    "",
    "This workspace is generated by DZUI and can be recreated at any time.",
    "",
  ].join("\n");
}

function renderDayzDiagLaunchCmd(launchPlan) {
  if (!launchPlan.command) {
    return [
      "@echo off",
      "echo DZUI could not find DayZDiag_x64.exe or DayZ_x64.exe.",
      "echo Configure DAYZ_ROOT or pass a DayZ root when generating the workspace.",
      "exit /b 2",
      "",
    ].join("\r\n");
  }
  return [
    "@echo off",
    "setlocal",
    `cd /d "${escapeCmd(launchPlan.command.cwd)}"`,
    `"${escapeCmd(launchPlan.command.executable)}" ${launchPlan.command.args.map((arg) => `"${escapeCmd(arg)}"`).join(" ")}`,
    "",
  ].join("\r\n");
}

function layoutReference(projectRoot, layoutPath) {
  const relative = path.relative(projectRoot, layoutPath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeSlashes(relative);
  }
  return normalizeSlashes(layoutPath);
}

function normalizeSlashes(value) {
  return String(value).replaceAll("\\", "/");
}

function escapeEnforceString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function escapeCmd(value) {
  return String(value).replaceAll("\"", "\"\"");
}

function sanitizeIdentifier(value) {
  const text = String(value ?? "").replace(/[^A-Za-z0-9_]/g, "_");
  const normalized = /^[A-Za-z_]/.test(text) ? text : `Dzui_${text}`;
  return normalized || "DzuiPreview";
}

function sanitizeFilePart(value) {
  const text = String(value ?? "").replace(/[^A-Za-z0-9_.-]/g, "_");
  return text || "dzui_preview";
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}

function firstExisting(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    const normalized = path.resolve(String(candidate));
    if (fs.existsSync(normalized)) return normalized;
  }
  return null;
}

function findExecutable(root, relativeCandidates) {
  if (!root) return null;
  for (const relativePath of relativeCandidates) {
    const candidate = path.join(root, relativePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
