import { loadNativeTextureBitmap } from "./native-textures.mjs";

const recentProjectsStorageKey = "dzui.recentProjects.v1";
const recentProjectsLimit = 10;

const state = {
  data: null,
  selectedId: null,
  selectedIds: new Set(),
  imageCache: new Map(),
  source: "",
  sourceHash: null,
  history: [],
  sourceEditing: false,
  sourceDirty: false,
  imageAssets: [],
  stringTableGrid: null,
  canvasDrag: null,
  suppressCanvasClick: false,
  widgetPalette: [],
  treeDrag: null,
  styleList: null,
  fontRegistry: null,
  layoutPatch: null,
  projectFileTree: null,
  projectTreeOpen: new Set([""]),
  showGrid: true,
  snapToGrid: false,
  gridSize: 8,
  workspace: "editor",
  environmentReady: false,
  bottomDockTab: "source",
  previewResolutionMode: "fixed",
  recentProjects: [],
  layoutConsole: [],
  layoutConsoleSeq: 0,
  layoutConsoleSeen: new Set(),
};

const els = {
  app: document.querySelector(".app"),
  setupOverlay: document.getElementById("setupOverlay"),
  setupProjectsRoot: document.getElementById("setupProjectsRoot"),
  setupStatus: document.getElementById("setupStatus"),
  setupUseDefaults: document.getElementById("setupUseDefaults"),
  setupSave: document.getElementById("setupSave"),
  workspaceTabs: [...document.querySelectorAll("[data-workspace-target]")],
  workspacePanels: [...document.querySelectorAll("[data-workspace-panel]")],
  form: document.getElementById("openForm"),
  layoutPath: document.getElementById("layoutPath"),
  projectRoot: document.getElementById("projectRoot"),
  recentProjectRoot: document.getElementById("recentProjectRoot"),
  projectBrowserRoot: document.getElementById("projectBrowserRoot"),
  recentProjectBrowserRoot: document.getElementById("recentProjectBrowserRoot"),
  projectFileSearch: document.getElementById("projectFileSearch"),
  openProjectFolder: document.getElementById("openProjectFolder"),
  projectFileCount: document.getElementById("projectFileCount"),
  projectFileTree: document.getElementById("projectFileTree"),
  compareLayoutPath: document.getElementById("compareLayoutPath"),
  layoutPatchPath: document.getElementById("layoutPatchPath"),
  width: document.getElementById("viewportWidth"),
  height: document.getElementById("viewportHeight"),
  previewLanguage: document.getElementById("previewLanguage"),
  title: document.getElementById("title"),
  status: document.getElementById("status"),
  viewportBadge: document.getElementById("viewportBadge"),
  previewResolution: document.getElementById("previewResolution"),
  previewState: document.getElementById("previewState"),
  showGrid: document.getElementById("showGrid"),
  snapToGrid: document.getElementById("snapToGrid"),
  gridSize: document.getElementById("gridSize"),
  stage: document.querySelector(".stage"),
  workbenchGridIcon: document.getElementById("workbenchGridIcon"),
  workbenchSnapIcon: document.getElementById("workbenchSnapIcon"),
  scaledPreview: document.getElementById("scaledPreview"),
  gridSizeButton: document.getElementById("gridSizeButton"),
  snapMarginButton: document.getElementById("snapMarginButton"),
  zoomButton: document.getElementById("zoomButton"),
  tree: document.getElementById("tree"),
  details: document.getElementById("details"),
  typedProperties: document.getElementById("typedProperties"),
  images: document.getElementById("images"),
  diagnostics: document.getElementById("diagnostics"),
  canvas: document.getElementById("canvas"),
  sourceView: document.getElementById("sourceView"),
  dockTabs: [...document.querySelectorAll("[data-dock-tab]")],
  dockPanes: [...document.querySelectorAll("[data-dock-panel]")],
  dockActions: [...document.querySelectorAll("[data-dock-actions]")],
  layoutConsole: document.getElementById("layoutConsole"),
  layoutConsoleBadge: document.getElementById("layoutConsoleBadge"),
  layoutDiagnostics: document.getElementById("layoutDiagnostics"),
  layoutModel: document.getElementById("layoutModel"),
  clearLayoutConsole: document.getElementById("clearLayoutConsole"),
  refreshSource: document.getElementById("refreshSource"),
  editSource: document.getElementById("editSource"),
  diffSource: document.getElementById("diffSource"),
  applySource: document.getElementById("applySource"),
  revertSource: document.getElementById("revertSource"),
  undoEdit: document.getElementById("undoEdit"),
  redoEdit: document.getElementById("redoEdit"),
  propertyForm: document.getElementById("propertyForm"),
  propertyKey: document.getElementById("propertyKey"),
  propertyValues: document.getElementById("propertyValues"),
  loadSettings: document.getElementById("loadSettings"),
  saveSettings: document.getElementById("saveSettings"),
  pluginSdk: document.getElementById("pluginSdk"),
  pluginPackagePath: document.getElementById("pluginPackagePath"),
  pluginTrustPolicyPath: document.getElementById("pluginTrustPolicyPath"),
  pluginSignPrivateKey: document.getElementById("pluginSignPrivateKey"),
  pluginSignPublicKey: document.getElementById("pluginSignPublicKey"),
  pluginSignKeyId: document.getElementById("pluginSignKeyId"),
  pluginCommandId: document.getElementById("pluginCommandId"),
  pluginCommandArgsJson: document.getElementById("pluginCommandArgsJson"),
  pluginPackageSave: document.getElementById("pluginPackageSave"),
  pluginTrustInstall: document.getElementById("pluginTrustInstall"),
  pluginPackageVerify: document.getElementById("pluginPackageVerify"),
  pluginCommandRun: document.getElementById("pluginCommandRun"),
  layoutDiff: document.getElementById("layoutDiff"),
  patchGenerate: document.getElementById("patchGenerate"),
  patchResolve: document.getElementById("patchResolve"),
  patchDryRun: document.getElementById("patchDryRun"),
  patchApply: document.getElementById("patchApply"),
  stringTableForm: document.getElementById("stringTableForm"),
  stringKey: document.getElementById("stringKey"),
  stringEnglish: document.getElementById("stringEnglish"),
  loadStringTable: document.getElementById("loadStringTable"),
  stringTableGrid: document.getElementById("stringTableGrid"),
  styleForm: document.getElementById("styleForm"),
  styleFilePath: document.getElementById("styleFilePath"),
  styleName: document.getElementById("styleName"),
  styleKey: document.getElementById("styleKey"),
  styleKeyOptions: document.getElementById("styleKeyOptions"),
  styleValues: document.getElementById("styleValues"),
  styleSchemaHint: document.getElementById("styleSchemaHint"),
  loadStyles: document.getElementById("loadStyles"),
  styleList: document.getElementById("styleList"),
  loadFonts: document.getElementById("loadFonts"),
  fontCoverage: document.getElementById("fontCoverage"),
  fontList: document.getElementById("fontList"),
  fontImportForm: document.getElementById("fontImportForm"),
  fontSource: document.getElementById("fontSource"),
  fontAssetPath: document.getElementById("fontAssetPath"),
  fontSampleText: document.getElementById("fontSampleText"),
  imageImportForm: document.getElementById("imageImportForm"),
  imageSource: document.getElementById("imageSource"),
  imageAssetPath: document.getElementById("imageAssetPath"),
  imageSetPath: document.getElementById("imageSetPath"),
  imageName: document.getElementById("imageName"),
  atlasSources: document.getElementById("atlasSources"),
  atlasMaxWidth: document.getElementById("atlasMaxWidth"),
  atlasPadding: document.getElementById("atlasPadding"),
  atlasPowerOfTwo: document.getElementById("atlasPowerOfTwo"),
  packAtlas: document.getElementById("packAtlas"),
  imageSearch: document.getElementById("imageSearch"),
  loadImages: document.getElementById("loadImages"),
  assetBrowser: document.getElementById("assetBrowser"),
  mcpPort: document.getElementById("mcpPort"),
  mcpStart: document.getElementById("mcpStart"),
  mcpStop: document.getElementById("mcpStop"),
  mcpStatusText: document.getElementById("mcpStatusText"),
  mcpStateDot: document.getElementById("mcpStateDot"),
  mcpEndpoint: document.getElementById("mcpEndpoint"),
  mcpEndpointCopy: document.getElementById("mcpEndpointCopy"),
  mcpLogs: document.getElementById("mcpLogs"),
};

const ctx = els.canvas.getContext("2d");

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

on(els.setupUseDefaults, "click", () => {
  if (!state.environmentStatus?.defaults) return;
  els.setupProjectsRoot.value = state.environmentStatus.defaults.projectsRoot;
});

on(els.setupSave, "click", () => {
  saveEnvironmentSetup();
});

for (const tab of els.workspaceTabs) {
  tab.addEventListener("click", () => setWorkspace(tab.dataset.workspaceTarget));
}

for (const tab of els.dockTabs) {
  tab.addEventListener("click", () => setDockTab(tab.dataset.dockTab));
}

on(els.clearLayoutConsole, "click", () => {
  state.layoutConsole = [];
  state.layoutConsoleSeen = new Set();
  renderLayoutConsole();
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  openLayout();
});

els.previewLanguage.addEventListener("change", () => {
  if (!state.environmentReady) return;
  openLayout();
});

els.previewState.addEventListener("change", () => {
  if (!state.environmentReady) return;
  openLayout();
});

on(els.previewResolution, "change", () => {
  applyPreviewResolution();
});

on(els.workbenchGridIcon, "click", () => {
  els.showGrid.checked = !els.showGrid.checked;
  state.showGrid = els.showGrid.checked;
  syncWorkbenchToolbarState();
  draw();
});

on(els.workbenchSnapIcon, "click", () => {
  els.snapToGrid.checked = !els.snapToGrid.checked;
  state.snapToGrid = els.snapToGrid.checked;
  syncWorkbenchToolbarState();
  setStatus(state.snapToGrid ? "Snap enabled" : "Snap disabled");
});

on(els.scaledPreview, "click", () => {
  els.scaledPreview.classList.toggle("active");
  syncCanvasViewportMode();
  draw();
  setStatus(els.scaledPreview.classList.contains("active") ? "Scaled mode" : "Unscaled mode");
});

on(els.gridSizeButton, "click", () => {
  const sizes = [4, 8, 16, 32, 64];
  const current = readGridSize();
  const next = sizes[(sizes.indexOf(current) + 1 || 1) % sizes.length] ?? 8;
  els.gridSize.value = String(next);
  state.gridSize = next;
  setStatus(`Grid size ${next}`);
  draw();
});

on(els.snapMarginButton, "click", () => {
  els.snapToGrid.checked = !els.snapToGrid.checked;
  state.snapToGrid = els.snapToGrid.checked;
  syncWorkbenchToolbarState();
  setStatus(state.snapToGrid ? "Snap margin enabled" : "Snap margin disabled");
});

on(els.zoomButton, "click", () => {
  setStatus("Zoom 100%");
});

els.showGrid.addEventListener("change", () => {
  state.showGrid = els.showGrid.checked;
  syncWorkbenchToolbarState();
  draw();
});

els.snapToGrid.addEventListener("change", () => {
  state.snapToGrid = els.snapToGrid.checked;
  syncWorkbenchToolbarState();
  setStatus(state.snapToGrid ? "Snap enabled" : "Snap disabled");
});

els.gridSize.addEventListener("change", () => {
  state.gridSize = readGridSize();
  draw();
});

window.addEventListener("keydown", (event) => {
  handleKeyboardNudge(event);
});

els.propertyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSelectedProperty();
});

els.typedProperties.addEventListener("click", (event) => {
  const geometrySave = event.target.closest("[data-save-geometry]");
  if (geometrySave) {
    saveGeometryInspector();
    return;
  }
  const anchorButton = event.target.closest("[data-geometry-anchor]");
  if (anchorButton) {
    selectGeometryAnchor(anchorButton.dataset.geometryAnchor);
    return;
  }
  const button = event.target.closest("[data-save-property]");
  if (!button) return;
  saveTypedProperty(button.closest(".typedProp"));
});

els.typedProperties.addEventListener("change", (event) => {
  if (!event.target.matches("[data-image-picker]")) return;
  const row = event.target.closest(".typedProp");
  const input = row?.querySelector("[data-image-ref]");
  if (input && event.target.value) input.value = event.target.value;
});

els.loadSettings.addEventListener("click", () => {
  loadProjectSettings();
});

els.saveSettings.addEventListener("click", () => {
  saveProjectSettings();
});

on(els.projectRoot, "change", () => {
  const project = els.projectRoot.value.trim();
  if (els.projectBrowserRoot) els.projectBrowserRoot.value = project;
  rememberProjectRoot(project);
});

on(els.projectBrowserRoot, "change", () => {
  const value = els.projectBrowserRoot.value.trim();
  if (value) {
    els.projectRoot.value = value;
    rememberProjectRoot(value);
  }
});

on(els.recentProjectRoot, "change", () => {
  selectRecentProject(els.recentProjectRoot.value);
});

on(els.recentProjectBrowserRoot, "change", () => {
  selectRecentProject(els.recentProjectBrowserRoot.value);
});

on(els.openProjectFolder, "click", () => {
  loadProjectFiles();
});

on(els.projectFileSearch, "keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  renderProjectFileTree();
});

on(els.projectFileSearch, "input", () => {
  renderProjectFileTree();
});

on(els.projectFileTree, "click", (event) => {
  const folder = event.target.closest("[data-project-folder]");
  if (folder) {
    toggleProjectFolder(folder.dataset.projectFolder);
    return;
  }
  const file = event.target.closest("[data-project-file]");
  if (!file) return;
  selectProjectFile(file.dataset.projectFile, file.dataset.projectExt);
});

els.pluginSdk.addEventListener("click", () => {
  loadPluginSdkReport();
});

els.pluginPackageSave.addEventListener("click", () => {
  savePluginRuntimePackage();
});

els.pluginTrustInstall.addEventListener("click", () => {
  installPluginTrustKey();
});

els.pluginPackageVerify.addEventListener("click", () => {
  verifyPluginRuntimePackageUi();
});

els.pluginCommandRun.addEventListener("click", () => {
  runTrustedPluginCommand();
});

els.mcpStart.addEventListener("click", () => {
  startMcpServer();
});

els.mcpStop.addEventListener("click", () => {
  stopMcpServer();
});

els.mcpPort.addEventListener("change", () => {
  updateMcpEndpoint({
    running: false,
    port: Number(els.mcpPort.value || 8765),
    endpoint: `http://127.0.0.1:${els.mcpPort.value || 8765}/mcp`,
    logs: [],
  });
});

els.layoutDiff.addEventListener("click", () => {
  loadLayoutDiffReport();
});

els.patchGenerate.addEventListener("click", () => {
  generateLayoutPatch();
});

els.patchResolve.addEventListener("click", () => {
  resolveLayoutPatch();
});

els.patchDryRun.addEventListener("click", () => {
  runLayoutPatch(false);
});

els.patchApply.addEventListener("click", () => {
  runLayoutPatch(true);
});

els.stringTableForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveStringTableKey();
});

els.loadStringTable.addEventListener("click", () => {
  loadStringTableGrid();
});

els.stringTableGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-string-row]");
  if (!button) return;
  saveStringTableRow(button.closest("[data-string-row]"));
});

els.styleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveStyleProperty();
});

els.styleKey.addEventListener("input", () => {
  updateStyleSchemaHint();
});

els.styleName.addEventListener("input", () => {
  updateStyleSchemaHint();
});

els.loadStyles.addEventListener("click", () => {
  loadStyles();
});

els.styleList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-style-name]");
  if (!item) return;
  selectStyleListItem(item.dataset.styleName);
});

els.loadFonts.addEventListener("click", () => {
  loadFonts();
});

els.fontCoverage.addEventListener("click", () => {
  loadFontCoverageReport();
});

els.fontImportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  importFont();
});

els.imageImportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  importImage();
});

els.packAtlas.addEventListener("click", () => {
  packAtlas();
});

els.loadImages.addEventListener("click", () => {
  loadImageAssets();
});

els.diagnostics.addEventListener("change", (event) => {
  if (!event.target.matches("[data-conflict-action]")) return;
  const row = event.target.closest("[data-conflict-index]");
  row?.classList.toggle("unresolvedChoice", event.target.value === "unresolved");
});

els.imageSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadImageAssets();
  }
});

els.assetBrowser.addEventListener("click", (event) => {
  const button = event.target.closest("[data-use-image]");
  if (!button) return;
  useImageAsset(button.dataset.useImage);
});

els.tree.addEventListener("dragstart", (event) => {
  const item = event.target.closest("[data-tree-node-id]");
  if (!item || !state.data) return;
  state.treeDrag = {
    nodeId: item.dataset.treeNodeId,
    targetId: null,
  };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", item.dataset.treeNodeId);
  item.classList.add("dragging");
});

els.tree.addEventListener("dragover", (event) => {
  const targetId = treeNodeIdFromEvent(event);
  if (!state.treeDrag || !targetId) return;
  const valid = canReparentByIds(state.treeDrag.nodeId, targetId);
  updateTreeDropTarget(valid ? targetId : null);
  if (!valid) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

els.tree.addEventListener("drop", async (event) => {
  const targetId = treeNodeIdFromEvent(event);
  const draggedId = state.treeDrag?.nodeId;
  const valid = Boolean(draggedId && targetId && canReparentByIds(draggedId, targetId));
  clearTreeDragState();
  if (!valid) return;
  event.preventDefault();
  await reparentWidgetByIds(draggedId, targetId);
});

els.tree.addEventListener("dragleave", (event) => {
  if (!state.treeDrag || els.tree.contains(event.relatedTarget)) return;
  updateTreeDropTarget(null);
});

els.tree.addEventListener("dragend", () => {
  clearTreeDragState();
});

els.details.addEventListener("click", (event) => {
  if (event.target.closest("[data-create-child]")) {
    createChildWidget();
  } else if (event.target.closest("[data-delete-widget]")) {
    deleteSelectedWidget();
  } else if (event.target.closest("[data-reparent-widget]")) {
    reparentSelectedWidget();
  } else {
    const transform = event.target.closest("[data-transform-action]");
    if (transform) applyLayoutTransform(transform.dataset.transformAction);
  }
});

els.refreshSource.addEventListener("click", () => {
  refreshSourceState();
});

els.editSource.addEventListener("click", () => {
  state.sourceEditing = true;
  state.sourceDirty = false;
  renderSourceControls();
  els.sourceView.focus();
});

els.diffSource.addEventListener("click", () => {
  previewSourceDiff();
});

els.applySource.addEventListener("click", () => {
  applySourceEdits();
});

els.revertSource.addEventListener("click", () => {
  state.sourceEditing = false;
  state.sourceDirty = false;
  els.sourceView.value = state.source;
  renderSourceControls();
});

els.undoEdit.addEventListener("click", () => {
  restoreFromHistory("undo");
});

els.redoEdit.addEventListener("click", () => {
  restoreFromHistory("redo");
});

els.sourceView.addEventListener("input", () => {
  state.sourceDirty = els.sourceView.value !== state.source;
  renderSourceControls();
});

els.canvas.addEventListener("pointerdown", (event) => {
  if (!state.data) return;
  const { x, y } = canvasPoint(event);
  const selectedGroupBox = selectedDisplayBounds();
  if (selectedGroupBox && isResizeHandleHit(selectedGroupBox, x, y)) {
    const nodes = selectedNodes();
    state.canvasDrag = {
      mode: "resize-group",
      pointerId: event.pointerId,
      start: { x, y },
      nodeId: state.selectedId ?? nodes[0]?.id,
      groupNodeIds: nodes.map((node) => node.id),
      originalBox: { ...selectedGroupBox },
      previewBox: { ...selectedGroupBox },
      originalNodeBoxes: Object.fromEntries(nodes.map((node) => [node.id, { ...node.box }])),
    };
    els.canvas.setPointerCapture(event.pointerId);
    return;
  }
  const hit = [...state.data.nodes].reverse().find((node) => contains(node.box, x, y));
  if (!hit) return;
  if (event.ctrlKey || event.metaKey) {
    selectNodeById(hit.id, event);
    state.suppressCanvasClick = true;
    return;
  }
  const keepGroup = state.selectedIds.has(hit.id) && state.selectedIds.size > 1;
  const groupMoveIds = keepGroup
    ? [...state.selectedIds]
    : [hit.id];
  if (keepGroup) {
    state.selectedId = hit.id;
    renderAll();
  } else {
    selectSingleNode(hit.id);
  }
  state.canvasDrag = {
    mode: dragModeForPoint(hit, x, y),
    pointerId: event.pointerId,
    start: { x, y },
    nodeId: hit.id,
    groupNodeIds: groupMoveIds,
    originalBox: { ...hit.box },
    previewBox: { ...hit.box },
  };
  els.canvas.setPointerCapture(event.pointerId);
});

els.canvas.addEventListener("pointermove", (event) => {
  if (!state.canvasDrag || state.canvasDrag.pointerId !== event.pointerId) return;
  const { x, y } = canvasPoint(event);
  updateCanvasDragPreview(x, y, { snap: shouldSnap(event) });
  state.suppressCanvasClick = true;
  draw();
});

els.canvas.addEventListener("pointerup", (event) => {
  if (!state.canvasDrag || state.canvasDrag.pointerId !== event.pointerId) return;
  finishCanvasDrag();
  els.canvas.releasePointerCapture(event.pointerId);
});

els.canvas.addEventListener("click", (event) => {
  if (state.suppressCanvasClick) {
    state.suppressCanvasClick = false;
    event.preventDefault();
  }
});

setWorkspace("editor");
setDockTab("source");
initializeRecentProjects();
initializeEnvironment();
setInterval(() => {
  if (state.environmentReady) refreshMcpStatus();
}, 5000);

function initializeRecentProjects() {
  state.recentProjects = readStoredRecentProjects();
  renderRecentProjects();
}

function readStoredRecentProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentProjectsStorageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return normalizeRecentProjects(parsed);
  } catch {
    return [];
  }
}

function normalizeRecentProjects(projects) {
  const seen = new Set();
  const normalized = [];
  for (const project of projects) {
    const value = normalizeProjectRoot(project);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
    if (normalized.length >= recentProjectsLimit) break;
  }
  return normalized;
}

function rememberProjectRoot(project) {
  const value = normalizeProjectRoot(project);
  if (!value) return;
  const next = normalizeRecentProjects([
    value,
    ...state.recentProjects.filter((item) => item.toLowerCase() !== value.toLowerCase()),
  ]);
  state.recentProjects = next;
  writeStoredRecentProjects(next);
  persistRecentProjects();
  renderRecentProjects();
}

function mergeRecentProjects(projects, { persist = false } = {}) {
  const next = normalizeRecentProjects([
    ...arrayOfStrings(projects),
    ...state.recentProjects,
  ]);
  const changed = next.join("\n").toLowerCase() !== state.recentProjects.join("\n").toLowerCase();
  state.recentProjects = next;
  writeStoredRecentProjects(next);
  renderRecentProjects();
  if (persist || changed) persistRecentProjects();
}

function writeStoredRecentProjects(projects) {
  try {
    localStorage.setItem(recentProjectsStorageKey, JSON.stringify(normalizeRecentProjects(projects)));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function persistRecentProjects() {
  if (!state.environmentReady || !state.recentProjects.length) return;
  fetch("/api/environment/recent-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recentProjectRoots: state.recentProjects,
    }),
  }).catch(() => {
    // The local dropdown still works when the environment file cannot be written.
  });
}

function renderRecentProjects() {
  const current = normalizeProjectRoot(els.projectRoot?.value) || state.recentProjects[0] || "";
  renderRecentProjectSelect(els.recentProjectRoot, current);
  renderRecentProjectSelect(els.recentProjectBrowserRoot, current);
}

function renderRecentProjectSelect(select, current) {
  if (!select) return;
  const options = state.recentProjects.length
    ? [
        '<option value="">Recent projects</option>',
        ...state.recentProjects.map((project) => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`),
      ]
    : ['<option value="">No recent projects</option>'];
  select.innerHTML = options.join("");
  if (current && state.recentProjects.some((project) => project.toLowerCase() === current.toLowerCase())) {
    select.value = state.recentProjects.find((project) => project.toLowerCase() === current.toLowerCase()) ?? "";
  } else {
    select.value = "";
  }
}

async function selectRecentProject(project) {
  const value = normalizeProjectRoot(project);
  if (!value) return;
  setProjectRootInputs(value);
  rememberProjectRoot(value);
  setStatus("Project selected");
  if (!state.environmentReady) return;
  if (state.workspace === "project") {
    await loadProjectFiles();
  } else if (state.data) {
    await openLayout();
  }
}

function setProjectRootInputs(project) {
  const value = normalizeProjectRoot(project);
  if (!value) return;
  if (els.projectRoot) els.projectRoot.value = value;
  if (els.projectBrowserRoot) els.projectBrowserRoot.value = value;
  renderRecentProjects();
}

function normalizeProjectRoot(project) {
  return String(project ?? "").trim().replace(/[\\/]+$/, "");
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

async function initializeEnvironment() {
  const response = await fetch("/api/environment/status");
  const payload = await response.json();
  state.environmentStatus = payload;
  applyEnvironmentStatus(payload);
  if (!payload.ready) {
    setStatus("Environment setup required");
    renderError("Initialize DayZ IDE environment to continue.");
    return;
  }
  state.environmentReady = true;
  refreshMcpStatus();
  openLayout();
}

function applyEnvironmentStatus(payload) {
  state.environmentReady = payload.ready === true;
  els.app.classList.toggle("blocked", !state.environmentReady);
  els.setupOverlay.hidden = state.environmentReady;
  els.setupProjectsRoot.value = payload.settings?.projectsRoot || payload.defaults?.projectsRoot || "";
  if (payload.settings?.recentProjectRoots?.length) {
    mergeRecentProjects(payload.settings.recentProjectRoots);
  } else if (state.environmentReady && state.recentProjects.length) {
    persistRecentProjects();
  }
  const lastProject = state.recentProjects[0] || "";
  const defaultProject = lastProject || payload.settings?.projectsRoot || payload.defaults?.projectsRoot || "";
  if (!els.projectRoot.value.trim() && defaultProject) {
    els.projectRoot.value = defaultProject;
  }
  if (els.projectBrowserRoot && !els.projectBrowserRoot.value.trim()) {
    els.projectBrowserRoot.value = els.projectRoot.value.trim() || defaultProject;
  }
  renderRecentProjects();
  renderSetupStatus(payload);
}

function renderSetupStatus(payload) {
  const counts = payload.counts ?? {};
  const pathsValid = payload.checks?.projectsRootExists;
  const missing = payload.missing?.length
    ? `<br>Missing: ${escapeHtml(payload.missing.join("; "))}`
    : "";
  els.setupStatus.className = `setupStatus ${payload.ready || pathsValid ? "ready" : "error"}`;
  els.setupStatus.innerHTML = payload.ready || pathsValid
    ? `Ready. Layouts: ${counts.layouts ?? 0}, styles: ${counts.styles ?? 0}, imagesets: ${counts.imageSets ?? 0}.<br>
       ${payload.ready ? "Environment is initialized." : "Click Initialize to save this environment for future launches."}`
    : `Required paths were not validated.${missing}`;
}

async function saveEnvironmentSetup() {
  setStatus("Saving environment");
  const response = await fetch("/api/environment/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectsRoot: els.setupProjectsRoot.value.trim(),
      recentProjectRoots: state.recentProjects,
    }),
  });
  const payload = await response.json();
  state.environmentStatus = payload;
  applyEnvironmentStatus(payload);
  if (!response.ok || !payload.ready) {
    setStatus("Environment setup failed");
    return;
  }
  setStatus("Environment ready");
  await refreshMcpStatus();
  await openLayout();
}

function setWorkspace(name) {
  state.workspace = name || "editor";
  for (const tab of els.workspaceTabs) {
    tab.classList.toggle("active", tab.dataset.workspaceTarget === state.workspace);
  }
  for (const panel of els.workspacePanels) {
    panel.classList.toggle("active", panel.dataset.workspacePanel === state.workspace);
  }
  if (state.workspace === "project" && state.environmentReady && !state.projectFileTree) {
    loadProjectFiles();
  }
}

function setDockTab(name) {
  state.bottomDockTab = name || "source";
  for (const tab of els.dockTabs) {
    const active = tab.dataset.dockTab === state.bottomDockTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const panel of els.dockPanes) {
    panel.classList.toggle("active", panel.dataset.dockPanel === state.bottomDockTab);
  }
  for (const actions of els.dockActions) {
    actions.hidden = actions.dataset.dockActions !== state.bottomDockTab;
  }
}

function applyPreviewResolution() {
  const value = els.previewResolution?.value ?? "";
  if (value === "fit") {
    state.previewResolutionMode = "fit";
    syncCanvasViewportMode();
    setStatus("Fit to window");
    draw();
    return;
  }

  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return;
  state.previewResolutionMode = "fixed";
  els.width.value = match[1];
  els.height.value = match[2];
  els.viewportBadge.textContent = value;
  syncCanvasViewportMode();
  if (!state.environmentReady) return;
  openLayout();
}

function syncPreviewResolutionSelect(width, height) {
  const value = `${Number(width)}x${Number(height)}`;
  if (!els.previewResolution) return;
  if (state.previewResolutionMode === "fit") {
    els.previewResolution.value = "fit";
    return;
  }
  const hasOption = [...els.previewResolution.options].some((option) => option.value === value);
  els.previewResolution.value = hasOption ? value : "fit";
}

function syncWorkbenchToolbarState() {
  els.workbenchGridIcon?.classList.toggle("active", Boolean(state.showGrid));
  els.workbenchSnapIcon?.classList.toggle("active", Boolean(state.snapToGrid));
  els.snapMarginButton?.classList.toggle("active", Boolean(state.snapToGrid));
  if (els.gridSizeButton) els.gridSizeButton.textContent = `Grid Size`;
  if (els.zoomButton) els.zoomButton.textContent = state.previewResolutionMode === "fit" ? "Zoom: Fit" : "Zoom: 100%";
  if (state.data?.viewport) {
    els.viewportBadge.textContent = `${state.data.viewport.width}x${state.data.viewport.height}`;
    syncPreviewResolutionSelect(state.data.viewport.width, state.data.viewport.height);
  }
  syncCanvasViewportMode();
}

function syncCanvasViewportMode() {
  const fit = state.previewResolutionMode === "fit" || els.scaledPreview?.classList.contains("active");
  els.stage?.classList.toggle("fitToWindow", fit);
  els.canvas?.classList.toggle("fitToWindow", fit);
  if (els.zoomButton) els.zoomButton.textContent = state.previewResolutionMode === "fit" ? "Zoom: Fit" : "Zoom: 100%";
}

async function refreshMcpStatus() {
  const response = await fetch("/api/mcp/status").catch(() => null);
  if (!response) return;
  const payload = await response.json().catch(() => null);
  if (!payload) return;
  updateMcpEndpoint(payload);
}

async function startMcpServer() {
  setStatus("Starting MCP");
  const response = await fetch("/api/mcp/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      port: Number(els.mcpPort.value || 8765),
      projectRoot: els.projectRoot.value.trim() || null,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("MCP start failed", payload.error || "Unknown error");
    setStatus("MCP error");
    return;
  }
  updateMcpEndpoint(payload);
  setWorkspace("mcp");
  setStatus(payload.running ? "MCP running" : "MCP stopped");
}

async function stopMcpServer() {
  setStatus("Stopping MCP");
  const response = await fetch("/api/mcp/stop", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("MCP stop failed", payload.error || "Unknown error");
    setStatus("MCP error");
    return;
  }
  updateMcpEndpoint(payload);
  setStatus("MCP stopped");
}

function updateMcpEndpoint(payload) {
  const port = payload.port ?? Number(els.mcpPort.value || 8765);
  const endpoint = payload.endpoint || `http://127.0.0.1:${port}/mcp`;
  els.mcpPort.value = String(port);
  els.mcpEndpoint.textContent = endpoint;
  els.mcpEndpointCopy.textContent = endpoint;
  els.mcpStatusText.textContent = payload.running
    ? `Running${payload.pid ? `, PID ${payload.pid}` : ""}`
    : "Stopped";
  els.mcpStateDot.classList.toggle("running", payload.running === true);
  els.mcpStart.disabled = payload.running === true;
  els.mcpStop.disabled = payload.running !== true;
  const lines = payload.logs?.length
    ? payload.logs
    : [payload.running ? "MCP server is running." : "No MCP process started."];
  els.mcpLogs.textContent = lines.join("\n");
}

async function openLayout() {
  if (!state.environmentReady) {
    setStatus("Environment setup required");
    return;
  }
  setStatus("Loading");
  resetLayoutConsole();
  const params = new URLSearchParams({
    file: els.layoutPath.value,
    width: els.width.value || "1280",
    height: els.height.value || "720",
    language: els.previewLanguage.value || "English",
    previewState: previewStateValue(),
  });
  const project = normalizeProjectRoot(els.projectRoot.value);
  if (project) {
    setProjectRootInputs(project);
    rememberProjectRoot(project);
    params.set("project", project);
  }
  pushLayoutLog("info", "layout.open", "Opening layout", Object.fromEntries(params.entries()));

  let response;
  let data;
  try {
    response = await fetch(`/api/layout?${params}`);
    data = await response.json();
  } catch (error) {
    setStatus("Error");
    state.data = null;
    state.source = "";
    state.sourceHash = null;
    state.history = [];
    state.selectedId = null;
    state.selectedIds = new Set();
    state.sourceEditing = false;
    state.sourceDirty = false;
    pushLayoutLog("error", "layout.api", "GET /api/layout failed", {
      error: errorMessage(error),
    });
    renderError(errorMessage(error));
    return;
  }
  pushLayoutLog(response.ok ? "info" : "error", "layout.api", `GET /api/layout -> ${response.status}`, {
    status: response.status,
    statusText: response.statusText,
  });
  if (!response.ok) {
    setStatus("Error");
    state.data = null;
    state.source = "";
    state.sourceHash = null;
    state.history = [];
    state.selectedId = null;
    state.selectedIds = new Set();
    state.sourceEditing = false;
    state.sourceDirty = false;
    pushLayoutLog("error", "layout.open", data.error || "Unable to open layout.", {
      file: els.layoutPath.value,
      project: project || null,
    });
    renderError(data.error || "Unable to open layout.");
    return;
  }

  state.data = data;
  logLayoutSummary(data);
  state.selectedId = data.nodes[0]?.id ?? null;
  state.selectedIds = new Set(state.selectedId ? [state.selectedId] : []);
  state.sourceEditing = false;
  state.sourceDirty = false;
  els.canvas.width = data.viewport.width;
  els.canvas.height = data.viewport.height;
  syncCanvasViewportMode();
  els.title.textContent = data.title;
  els.viewportBadge.textContent = `${data.viewport.width}x${data.viewport.height}`;
  syncPreviewResolutionSelect(data.viewport.width, data.viewport.height);
  setStatus(`${data.nodes.length} widgets`);
  if (project) {
    await loadStringTableGrid({ silent: true });
    await loadStyles({ silent: true });
    await loadFonts({ silent: true });
  }
  await loadWidgetPalette({ silent: true });
  await refreshSourceState();
  renderAll();
}

function renderAll() {
  renderTree();
  renderDetails();
  renderImages();
  renderDiagnostics();
  renderSourceControls();
  renderLayoutConsole();
  renderLayoutDiagnostics();
  renderLayoutModel();
  syncWorkbenchToolbarState();
  draw();
}

function renderTree() {
  els.tree.innerHTML = "";
  if (!state.data?.nodes.length) {
    els.tree.innerHTML = '<p class="empty">No widgets.</p>';
    return;
  }

  for (const node of state.data.nodes) {
    const item = document.createElement("div");
    const classes = [
      "treeItem",
      node.id === state.selectedId ? "active" : "",
      state.selectedIds.has(node.id) ? "multiSelected" : "",
      node.id === state.treeDrag?.nodeId ? "dragging" : "",
      node.id === state.treeDrag?.targetId ? "dropTarget" : "",
    ].filter(Boolean);
    item.className = classes.join(" ");
    item.style.marginLeft = `${node.depth * 12}px`;
    item.draggable = true;
    item.dataset.treeNodeId = node.id;
    item.innerHTML = `${escapeHtml(node.name)}<span class="type">${escapeHtml(node.typeClass)}</span>`;
    item.addEventListener("click", (event) => {
      selectNodeById(node.id, event);
    });
    els.tree.appendChild(item);
  }
}

function renderDetails() {
  const node = selectedNode();
  const nodes = selectedNodes();
  if (!node) {
    els.details.innerHTML = '<p class="empty">No widget selected.</p>';
    els.typedProperties.innerHTML = '<p class="empty">No widget selected.</p>';
    els.propertyForm.style.display = "none";
    return;
  }

  els.propertyForm.style.display = "";
  populatePropertyForm(node);
  if (nodes.length > 1) {
    renderBatchTypedProperties(nodes);
  } else {
    renderTypedProperties(node);
  }
  const multiSummary = nodes.length > 1 ? renderMultiSelectSummary(nodes) : "";
  els.details.innerHTML = `<dl>
    ${row("Name", node.name)}
    ${row("Type", node.typeClass)}
    ${row("Line", String(node.source.line))}
    ${row("Box", formatBox(node.box))}
    ${row("Text", node.text || "")}
    ${row("Font", node.font || "")}
    ${row("Style", node.style || "")}
    ${row("Priority", String(node.priority))}
  </dl>
  ${multiSummary}
  ${nodes.length === 1 ? renderStructureControls(node) : ""}`;
}

function renderMultiSelectSummary(nodes) {
  const rows = nodes.slice(0, 20).map((node) => (
    `<div>${escapeHtml(node.name)} <code>${escapeHtml(node.typeClass)}</code></div>`
  )).join("");
  const canDistribute = nodes.length >= 3 ? "" : " disabled";
  return `<div class="multiSelectSummary">
    <strong>${nodes.length} widgets selected</strong>
    <div class="transformToolbar" aria-label="Layout transforms">
      <button type="button" data-transform-action="align-left" title="Align left">L</button>
      <button type="button" data-transform-action="align-hcenter" title="Align horizontal center">HC</button>
      <button type="button" data-transform-action="align-right" title="Align right">R</button>
      <button type="button" data-transform-action="align-top" title="Align top">T</button>
      <button type="button" data-transform-action="align-vcenter" title="Align vertical center">VC</button>
      <button type="button" data-transform-action="align-bottom" title="Align bottom">B</button>
      <button type="button" data-transform-action="distribute-horizontal" title="Distribute horizontal"${canDistribute}>Dist H</button>
      <button type="button" data-transform-action="distribute-vertical" title="Distribute vertical"${canDistribute}>Dist V</button>
    </div>
    ${rows}
  </div>`;
}

function renderStructureControls(node) {
  const presets = workbenchWidgetTypePalette();
  const selectedPreset = presets.find((preset) => preset.typeClass === "FrameWidgetClass") ?? presets[0] ?? { typeClass: "FrameWidgetClass", defaultName: `${node.name}Child` };
  const targetOptions = (state.data?.nodes ?? [])
    .filter((candidate) => candidate.id !== node.id && !isDescendantNode(candidate, node.id))
    .map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(" ".repeat(candidate.depth * 2) + candidate.name)}</option>`)
    .join("");
  return `<div class="structureControls">
    ${renderWidgetClassTree(presets, selectedPreset)}
    <div class="structureRow createRow">
      <input data-create-name autocomplete="off" spellcheck="false" value="${escapeHtml(uniqueWidgetName(selectedPreset.defaultName || node.name))}">
      <button type="button" data-create-child>Add Child</button>
    </div>
    <div class="structureRow">
      <select data-reparent-target>${targetOptions}</select>
      <button type="button" data-reparent-widget${targetOptions ? "" : " disabled"}>Reparent</button>
      <button type="button" class="dangerButton" data-delete-widget>Delete</button>
    </div>
  </div>`;
}

els.details.addEventListener("click", (event) => {
  const option = event.target.closest("[data-widget-type-option]");
  if (!option) return;
  selectWidgetTypeOption(option);
});

function renderWidgetClassTree(presets, selectedPreset) {
  const byTypeClass = new Map(presets.map((preset) => [preset.typeClass, preset]));
  const groups = workbenchWidgetGroups().map((group) => ({
    ...group,
    presets: group.names.map((name) => byTypeClass.get(`${name}Class`) ?? workbenchPresetFromName(name)),
  }));
  return `<div class="widgetTypePicker" role="tree" aria-label="Widget classes">
    <input data-create-preset type="hidden" value="${escapeHtml(selectedPreset.id || "")}">
    <input data-create-type type="hidden" value="${escapeHtml(selectedPreset.typeClass)}">
    ${groups.map((group) => renderWidgetClassGroup(group, selectedPreset)).join("")}
  </div>`;
}

function renderWidgetClassGroup(group, selectedPreset) {
  return `<details class="widgetClassGroup" open>
    <summary>${escapeHtml(group.label)}</summary>
    <div class="widgetClassGroupItems">
      ${group.presets.map((preset) => renderWidgetClassOption(preset, selectedPreset)).join("")}
    </div>
  </details>`;
}

function renderWidgetClassOption(preset, selectedPreset) {
  const active = preset.typeClass === selectedPreset.typeClass ? " active" : "";
  return `<button class="widgetClassOption${active}" type="button"
    data-widget-type-option
    data-preset-id="${escapeHtml(preset.id)}"
    data-type="${escapeHtml(preset.typeClass)}"
    data-name="${escapeHtml(preset.defaultName)}">${escapeHtml(workbenchWidgetTypeName(preset))}</button>`;
}

function selectWidgetTypeOption(option) {
  const controls = option.closest(".structureControls");
  const presetInput = controls?.querySelector("[data-create-preset]");
  const typeInput = controls?.querySelector("[data-create-type]");
  const nameInput = controls?.querySelector("[data-create-name]");
  if (presetInput) presetInput.value = option.dataset.presetId || "";
  if (typeInput) typeInput.value = option.dataset.type || "FrameWidgetClass";
  if (nameInput) nameInput.value = uniqueWidgetName(option.dataset.name || "Widget");
  controls?.querySelectorAll("[data-widget-type-option]").forEach((candidate) => {
    candidate.classList.toggle("active", candidate === option);
  });
}

function isDescendantNode(candidate, parentId) {
  let current = candidate;
  while (current?.parentId) {
    if (current.parentId === parentId) return true;
    current = state.data.nodes.find((node) => node.id === current.parentId);
  }
  return false;
}

function canReparentByIds(widgetId, parentWidgetId) {
  if (!state.data || !widgetId || !parentWidgetId) return false;
  if (widgetId === parentWidgetId) return false;
  const widget = state.data.nodes.find((node) => node.id === widgetId);
  const parent = state.data.nodes.find((node) => node.id === parentWidgetId);
  if (!widget || !parent) return false;
  if (widget.parentId === parentWidgetId) return false;
  return !isDescendantNode(parent, widgetId);
}

function treeNodeIdFromEvent(event) {
  return event.target.closest("[data-tree-node-id]")?.dataset.treeNodeId ?? null;
}

function updateTreeDropTarget(targetId) {
  if (!state.treeDrag) return;
  if (state.treeDrag.targetId === targetId) return;
  state.treeDrag.targetId = targetId;
  for (const item of els.tree.querySelectorAll("[data-tree-node-id]")) {
    item.classList.toggle("dropTarget", item.dataset.treeNodeId === targetId);
  }
}

function clearTreeDragState() {
  state.treeDrag = null;
  for (const item of els.tree.querySelectorAll(".treeItem")) {
    item.classList.remove("dragging", "dropTarget");
  }
}

function uniqueChildName(baseName) {
  return uniqueWidgetName(`${baseName}Child`);
}

function uniqueWidgetName(baseName) {
  const existing = new Set((state.data?.nodes ?? []).map((node) => node.name.toLowerCase()));
  let index = 1;
  let name = String(baseName || "Widget");
  while (existing.has(name.toLowerCase())) {
    index += 1;
    name = `${baseName}${index}`;
  }
  return name;
}

function populatePropertyForm(node) {
  const currentKey = els.propertyKey.value.trim();
  if (currentKey && node.props[currentKey]) {
    els.propertyValues.value = node.props[currentKey].join(" ");
    return;
  }

  const key = node.text !== null ? "text"
    : node.images[0] ? `image${node.images[0].slot}`
      : node.props.position ? "position"
        : node.props.size ? "size"
          : "";
  els.propertyKey.value = key;
  els.propertyValues.value = key && node.props[key] ? node.props[key].join(" ") : "";
}

async function saveSelectedProperty() {
  const key = els.propertyKey.value.trim();
  const value = els.propertyValues.value;
  const values = parsePropertyValues(key, value);
  const nodes = selectedNodes();
  if (!state.data || !nodes.length) return;
  if (nodes.length > 1) {
    await saveBatchProperty(nodes, key, values);
  } else {
    await saveProperty(nodes[0], key, values);
  }
}

async function saveTypedProperty(row) {
  const nodes = selectedNodes();
  if (!state.data || !nodes.length || !row) return;
  const key = row.dataset.key;
  const values = readTypedPropertyValues(row);
  if (nodes.length > 1) {
    await saveBatchProperty(nodes, key, values);
  } else {
    await saveProperty(nodes[0], key, values);
  }
}

async function saveProperty(node, key, values) {
  setStatus("Saving");
  const response = await fetch("/api/layout/property", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.data.filePath,
      widgetId: node.id,
      key,
      values,
      project: els.projectRoot.value.trim() || null,
      width: state.data.viewport.width,
      height: state.data.viewport.height,
      language: els.previewLanguage.value || "English",
      previewState: previewStateValue(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    setStatus("Save failed");
    els.diagnostics.innerHTML = `<div class="diag error"><strong>save failed</strong><br>${escapeHtml(payload.error || "Unknown error")}</div>`;
    return;
  }

  state.data = payload.preview;
  syncSelectionAfterPreview(node.id);
  await refreshSourceState();
  setStatus(`Saved ${key}`);
  renderAll();
}

async function saveBatchProperty(nodes, key, values) {
  if (!key) {
    showPanelDiagnostic("batch save", "Property key is required.");
    return;
  }
  setStatus("Saving batch");
  const response = await fetch("/api/layout/patch/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.data.filePath,
      patch: {
        label: `Batch update ${key}`,
        beforeHash: state.sourceHash,
        operations: nodes.map((node) => ({
          op: "updateProperty",
          widgetId: node.id,
          key,
          values,
          meta: {
            reason: "batch-property-update",
            widgetName: node.name,
          },
        })),
      },
      write: true,
      project: els.projectRoot.value.trim() || null,
      width: state.data.viewport.width,
      height: state.data.viewport.height,
      language: els.previewLanguage.value || "English",
      previewState: previewStateValue(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("batch save failed", payload.reason || payload.error || "Unknown error");
    setStatus("Batch save failed");
    return;
  }

  state.data = payload.preview;
  syncSelectionAfterPreview(nodes[0]?.id ?? null, nodes.map((node) => node.id));
  await refreshSourceState();
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>batch property saved</strong><br>
    ${escapeHtml(key)} on ${payload.appliedCount} widgets<br>
    history: ${escapeHtml(payload.transaction?.historyPath || "n/a")}
  </div>`;
  setStatus(`Saved ${key} on ${nodes.length} widgets`);
  renderAll();
}

async function applyLayoutTransform(action, options = {}) {
  const nodes = selectedNodes();
  if (!state.data || !nodes.length) return;
  setStatus("Transforming");
  const response = await fetch("/api/layout/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.data.filePath,
      action,
      widgetIds: nodes.map((node) => node.id),
      delta: options.delta,
      targetBounds: options.targetBounds,
      targetWidth: options.targetWidth,
      targetHeight: options.targetHeight,
      write: true,
      project: els.projectRoot.value.trim() || null,
      width: state.data.viewport.width,
      height: state.data.viewport.height,
      language: els.previewLanguage.value || "English",
      previewState: previewStateValue(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("transform failed", payload.reason || payload.error || "Unknown error");
    setStatus("Transform failed");
    return;
  }

  state.data = payload.preview;
  syncSelectionAfterPreview(nodes[0]?.id ?? null, nodes.map((node) => node.id));
  await refreshSourceState();
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>layout transform</strong><br>
    ${escapeHtml(action)} on ${payload.appliedCount} widgets<br>
    history: ${escapeHtml(payload.transaction?.historyPath || "n/a")}
  </div>`;
  setStatus(`Transformed ${nodes.length} widgets`);
  renderAll();
}

async function createChildWidget() {
  const node = selectedNode();
  if (!state.data || !node) return;
  const presetId = els.details.querySelector("[data-create-preset]")?.value || "";
  const typeClass = els.details.querySelector("[data-create-type]")?.value.trim() || "FrameWidgetClass";
  const selectedPreset = presetForSelectedWidgetType(presetId, typeClass);
  const usePreset = shouldUsePresetPayload(selectedPreset?.id);
  const name = els.details.querySelector("[data-create-name]")?.value.trim()
    || uniqueWidgetName(selectedPreset?.defaultName || uniqueChildName(node.name));
  await applyWidgetStructure("/api/layout/widget/create", {
    parentWidgetId: node.id,
    presetId: usePreset ? selectedPreset.id : null,
    typeClass,
    name,
    props: usePreset ? undefined : defaultWidgetPropsForType(typeClass),
  }, (payload) => payload.preview.nodes.find((candidate) => candidate.name === payload.widget?.name)?.id ?? node.id);
}

async function loadWidgetPalette(options = {}) {
  const params = new URLSearchParams();
  const project = els.projectRoot.value.trim();
  if (project) params.set("project", project);
  const response = await fetch(`/api/layout/palette${params.size ? `?${params}` : ""}`);
  const payload = await response.json();
  if (!response.ok) {
    if (!options.silent) showPanelDiagnostic("widget palette failed", payload.error || "Unknown error");
    return;
  }
  state.widgetPalette = payload.presets ?? [];
}

function fallbackWidgetPalette() {
  return workbenchWidgetGroups().flatMap((group) => group.names).map(workbenchPresetFromName);
}

function workbenchPresetFromName(name) {
  return {
    id: `workbench.${name.toLowerCase()}`,
    category: "Workbench",
    label: name,
    typeClass: `${name}Class`,
    defaultName: name,
  };
}

function workbenchWidgetGroups() {
  return [
    {
      id: "basic",
      label: "Basic",
      names: [
        "ButtonWidget",
        "CheckBoxWidget",
        "ContentWidget",
        "EditBoxWidget",
        "EmbededWidget",
        "FrameWidget",
        "ImageWidget",
        "MultilineEditBoxWidget",
        "MultilineTextWidget",
        "PanelWidget",
        "PasswordEditBoxWidget",
        "ProgressBarWidget",
        "RichTextWidget",
        "SimpleProgressBarWidget",
        "SliderWidget",
        "TextListboxWidget",
        "TextWidget",
        "WindowWidget",
        "XComboBoxWidget",
      ],
    },
    {
      id: "game",
      label: "Game",
      names: [
        "HtmlWidget",
        "ItemPreviewWidget",
        "MapWidget",
        "PlayerPreviewWidget",
        "ServerBrowserWidget",
        "SmartPanelWidget",
        "ThreeStateCheckboxWidget",
      ],
    },
    {
      id: "helpers",
      label: "Helpers",
      names: [
        "GridSpacerWidget",
        "ScrollWidget",
        "WrapSpacerWidget",
      ],
    },
    {
      id: "special",
      label: "Special",
      names: [
        "CanvasWidget",
        "GenericListboxWidget",
        "RenderTargetWidget",
        "RTTextureWidget",
        "UniversalListboxWidget",
        "VideoWidget",
      ],
    },
  ];
}

function workbenchWidgetTypePalette() {
  const editorTypes = state.widgetPalette.filter((preset) => String(preset.id || "").startsWith("editor."));
  return fallbackWidgetPalette().map((fallback) => (
    editorTypes.find((preset) => preset.typeClass === fallback.typeClass) ?? fallback
  ));
}

function workbenchWidgetTypeName(preset) {
  return String(preset.defaultName || preset.typeClass || preset.label || "Widget").replace(/Class$/, "");
}

function presetForSelectedWidgetType(presetId, typeClass) {
  const presets = workbenchWidgetTypePalette();
  return presets.find((preset) => preset.id === presetId)
    ?? presets.find((preset) => preset.typeClass === typeClass)
    ?? null;
}

function defaultWidgetPropsForType(typeClass) {
  const lowerType = String(typeClass).toLowerCase();
  return {
    position: [0, 0],
    size: lowerType.includes("text") ? [0.2, 0.05] : [0.1, 0.1],
    ...(lowerType.includes("text") ? { text: "New text" } : {}),
  };
}

function isWorkbenchWidgetPreset(presetId) {
  return String(presetId || "").startsWith("workbench.");
}

function shouldUsePresetPayload(presetId) {
  return Boolean(presetId) && !isWorkbenchWidgetPreset(presetId);
}

async function deleteSelectedWidget() {
  const node = selectedNode();
  if (!state.data || !node) return;
  const fallbackId = node.parentId || state.data.nodes.find((candidate) => candidate.id !== node.id)?.id || null;
  await applyWidgetStructure("/api/layout/widget/delete", {
    widgetId: node.id,
  }, () => fallbackId);
}

async function reparentSelectedWidget() {
  const node = selectedNode();
  const target = els.details.querySelector("[data-reparent-target]")?.value;
  if (!state.data || !node || !target) return;
  await reparentWidgetByIds(node.id, target);
}

async function reparentWidgetByIds(widgetId, parentWidgetId) {
  const widget = state.data?.nodes.find((node) => node.id === widgetId);
  if (!state.data || !widget || !parentWidgetId) return;
  await applyWidgetStructure("/api/layout/widget/reparent", {
    widgetId,
    parentWidgetId,
  }, (payload) => payload.preview.nodes.find((candidate) => candidate.name === payload.widget?.name)?.id ?? widget.parentId ?? widgetId);
}

async function applyWidgetStructure(url, body, selectNext) {
  setStatus("Updating structure");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.data.filePath,
      ...body,
      project: els.projectRoot.value.trim() || null,
      width: state.data.viewport.width,
      height: state.data.viewport.height,
      language: els.previewLanguage.value || "English",
      previewState: previewStateValue(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("structure update failed", payload.error || "Unknown error");
    setStatus("Structure update failed");
    return;
  }

  state.data = payload.preview;
  syncSelectionAfterPreview(selectNext(payload));
  await refreshSourceState();
  setStatus("Structure updated");
  renderAll();
}

function parsePropertyValues(key, rawValue) {
  const normalizedKey = key.toLowerCase();
  if (["position", "size", "color", "rotation"].includes(normalizedKey)) {
    return rawValue.trim().split(/\s+/).filter(Boolean).map((value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : value;
    });
  }
  return [rawValue];
}

function renderTypedProperties(node) {
  const properties = node.typedProperties ?? [];
  if (!properties.length) {
    els.typedProperties.innerHTML = `${renderGeometryInspector(node)}<p class="empty">No typed properties.</p>`;
    return;
  }

  els.typedProperties.innerHTML = `${renderGeometryInspector(node)}${renderTypedPropertyList(properties)}`;
}

function renderBatchTypedProperties(nodes) {
  const properties = buildBatchTypedProperties(nodes);
  if (!properties.length) {
    els.typedProperties.innerHTML = '<p class="empty">No common typed properties.</p>';
    return;
  }
  els.typedProperties.innerHTML = `<div class="typedBatchIntro">${nodes.length} selected widgets</div>${renderTypedPropertyList(properties)}`;
}

function renderGeometryInspector(node) {
  const geometry = geometryStateFromNode(node);
  const anchors = [
    ["left", "top"], ["center", "top"], ["right", "top"],
    ["left", "center"], ["center", "center"], ["right", "center"],
    ["left", "bottom"], ["center", "bottom"], ["right", "bottom"],
  ].map(([horizontal, vertical]) => {
    const active = geometry.halign === horizontal && geometry.valign === vertical ? " active" : "";
    return `<button type="button" class="anchorCell${active}" data-geometry-anchor="${horizontal}:${vertical}" title="${horizontal} ${vertical}"></button>`;
  }).join("");
  return `<div class="geometryInspector" data-geometry>
    <div class="typedCategory">Geometry</div>
    <div class="geometryHeader">
      <strong>${escapeHtml(node.name)}</strong>
      <code>${escapeHtml(node.typeClass)}</code>
    </div>
    <div class="geometryFields">
      ${renderGeometryField("X", "x", geometry.x.value, geometry.x.unit)}
      ${renderGeometryField("Y", "y", geometry.y.value, geometry.y.unit)}
      ${renderGeometryField("W", "w", geometry.w.value, geometry.w.unit)}
      ${renderGeometryField("H", "h", geometry.h.value, geometry.h.unit)}
    </div>
    <div class="geometryModes">
      <label><span>H anchor</span><select data-geometry-align="halign">
        ${["left", "center", "right"].map((value) => `<option value="${value}"${value === geometry.halign ? " selected" : ""}>${value}</option>`).join("")}
      </select></label>
      <label><span>V anchor</span><select data-geometry-align="valign">
        ${["top", "center", "bottom"].map((value) => `<option value="${value}"${value === geometry.valign ? " selected" : ""}>${value}</option>`).join("")}
      </select></label>
    </div>
    <div class="anchorGrid" aria-label="Anchor presets">${anchors}</div>
    <button type="button" class="typedSave" data-save-geometry>Save Geometry</button>
  </div>`;
}

function renderGeometryField(label, key, value, unit) {
  return `<label class="geometryField">
    <span>${label}</span>
    <input type="number" step="any" data-geometry-value="${key}" value="${escapeHtml(value)}">
    <select data-geometry-unit="${key}">
      <option value="percent"${unit === "percent" ? " selected" : ""}>%</option>
      <option value="px"${unit === "px" ? " selected" : ""}>px</option>
    </select>
  </label>`;
}

function geometryStateFromNode(node) {
  const props = node.props ?? {};
  const position = numericPair(props.position, [0, 0]);
  const size = numericPair(props.size, [1, 1]);
  const exact = node.box?.exact ?? {};
  return {
    x: geometryValue(position[0], exact.positionX),
    y: geometryValue(position[1], exact.positionY),
    w: geometryValue(size[0], exact.sizeX),
    h: geometryValue(size[1], exact.sizeY),
    halign: node.box?.align?.horizontal ?? String(props.halign?.[0] ?? "left"),
    valign: node.box?.align?.vertical ?? String(props.valign?.[0] ?? "top"),
  };
}

function numericPair(values, fallback) {
  if (!Array.isArray(values) || values.length < 2) return fallback;
  return [
    Number.isFinite(Number(values[0])) ? Number(values[0]) : fallback[0],
    Number.isFinite(Number(values[1])) ? Number(values[1]) : fallback[1],
  ];
}

function geometryValue(raw, exact) {
  return {
    unit: exact ? "px" : "percent",
    value: exact ? formatGeometryNumber(raw) : formatGeometryNumber(raw * 100),
  };
}

function formatGeometryNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(4));
}

function renderTypedPropertyList(properties) {
  let category = "";
  return properties.map((property) => {
    const nextCategory = property.category && property.category !== category
      ? `<div class="typedCategory">${escapeHtml(property.category)}</div>`
      : "";
    category = property.category;
    return `${nextCategory}${renderTypedProperty(property)}`;
  }).join("");
}

function renderTypedProperty(property) {
  const values = property.effectiveValues?.length ? property.effectiveValues : property.values;
  const batchMeta = property.batch
    ? `<small class="${property.mixed ? "mixedValue" : ""}">${property.mixed ? "Mixed values" : `${property.selectedCount} selected`}</small>`
    : "";
  const actionLabel = property.batch ? "Apply" : "Save";
  return `<div class="typedProp" data-key="${escapeHtml(property.key)}" data-type="${escapeHtml(property.type)}">
    <div class="typedMeta">
      <span>${escapeHtml(property.label)}</span>
      <code>${escapeHtml(property.key)}</code>
      ${batchMeta}
    </div>
    ${renderTypedControl(property, values)}
    <button type="button" class="typedSave" data-save-property>${actionLabel}</button>
  </div>`;
}

function selectGeometryAnchor(value) {
  const [halign, valign] = String(value || "").split(":");
  const root = els.typedProperties.querySelector("[data-geometry]");
  if (!root || !halign || !valign) return;
  root.querySelector('[data-geometry-align="halign"]').value = halign;
  root.querySelector('[data-geometry-align="valign"]').value = valign;
  for (const button of root.querySelectorAll("[data-geometry-anchor]")) {
    button.classList.toggle("active", button.dataset.geometryAnchor === value);
  }
}

async function saveGeometryInspector() {
  const node = selectedNode();
  const root = els.typedProperties.querySelector("[data-geometry]");
  if (!state.data || !node || !root) return;

  const field = (key) => ({
    value: Number(root.querySelector(`[data-geometry-value="${key}"]`)?.value ?? 0),
    unit: root.querySelector(`[data-geometry-unit="${key}"]`)?.value ?? "percent",
  });
  const x = field("x");
  const y = field("y");
  const w = field("w");
  const h = field("h");
  const halign = root.querySelector('[data-geometry-align="halign"]')?.value ?? "left";
  const valign = root.querySelector('[data-geometry-align="valign"]')?.value ?? "top";
  const position = [
    formatLayoutNumber(x.unit === "px" ? x.value : x.value / 100),
    formatLayoutNumber(y.unit === "px" ? y.value : y.value / 100),
  ];
  const size = [
    formatLayoutNumber(w.unit === "px" ? w.value : w.value / 100),
    formatLayoutNumber(h.unit === "px" ? h.value : h.value / 100),
  ];

  await saveWidgetBox(node, {
    position,
    size,
    props: {
      hexactpos: x.unit === "px" ? 1 : 0,
      vexactpos: y.unit === "px" ? 1 : 0,
      hexactsize: w.unit === "px" ? 1 : 0,
      vexactsize: h.unit === "px" ? 1 : 0,
      halign,
      valign,
    },
  });
}

function buildBatchTypedProperties(nodes) {
  const descriptorSets = nodes.map((node) => node.typedProperties ?? []);
  if (!descriptorSets.length || !descriptorSets[0].length) return [];
  const commonKeys = new Set(descriptorSets[0].map((property) => property.key.toLowerCase()));
  for (const descriptors of descriptorSets.slice(1)) {
    const keys = new Set(descriptors.map((property) => property.key.toLowerCase()));
    for (const key of [...commonKeys]) {
      if (!keys.has(key)) commonKeys.delete(key);
    }
  }
  return descriptorSets[0]
    .filter((property) => commonKeys.has(property.key.toLowerCase()))
    .map((property) => {
      const matches = descriptorSets.map((descriptors) => (
        descriptors.find((item) => item.key.toLowerCase() === property.key.toLowerCase())
      ));
      const signatures = matches.map(typedPropertySignature);
      return {
        ...property,
        batch: true,
        selectedCount: nodes.length,
        mixed: signatures.some((signature) => signature !== signatures[0]),
      };
    });
}

function typedPropertySignature(property) {
  const values = property.effectiveValues?.length ? property.effectiveValues : property.values;
  return values.map((value) => String(value)).join("\u001f");
}

function renderTypedControl(property, values) {
  if (property.type === "numberPair") {
    const axes = property.axes ?? ["a", "b"];
    const first = values[0] ?? 0;
    const second = values[1] ?? 0;
    return `<div class="typedPair">
      <label><span>${escapeHtml(axes[0])}</span><input type="number" step="any" data-number-pair value="${escapeHtml(first)}"></label>
      <label><span>${escapeHtml(axes[1])}</span><input type="number" step="any" data-number-pair value="${escapeHtml(second)}"></label>
    </div>`;
  }
  if (property.type === "boolean") {
    const checked = isTruthyValue(values[0]) ? " checked" : "";
    return `<label class="typedToggle"><input type="checkbox" data-boolean${checked}><span>${escapeHtml(property.label)}</span></label>`;
  }
  if (property.type === "enum") {
    const current = String(values[0] ?? property.options?.[0] ?? "");
    const options = (property.options ?? []).map((option) => {
      const selected = String(option) === current ? " selected" : "";
      return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
    }).join("");
    return `<select data-enum>${options}</select>`;
  }
  if (property.type === "number") {
    return `<input type="number" step="any" data-scalar value="${escapeHtml(values[0] ?? 0)}">`;
  }
  if (property.type === "color") {
    const color = colorStateFromValues(values);
    return `<div class="typedColor" data-color-scale="${color.scale}">
      <input type="color" data-color value="${escapeHtml(color.hex)}">
      <label><span>a</span><input type="number" min="0" max="${color.scale}" step="0.01" data-color-alpha value="${escapeHtml(color.alpha)}"></label>
    </div>`;
  }
  if (property.type === "imageRef") {
    const value = values[0] ?? "";
    return `<div class="imageRefControl">
      <input data-image-ref data-scalar autocomplete="off" spellcheck="false" value="${escapeHtml(value)}">
      <select data-image-picker>
        <option value="">Loaded assets</option>
        ${renderImageAssetOptions(value)}
      </select>
    </div>`;
  }
  const value = property.type === "numberList" ? values.join(" ") : (values[0] ?? "");
  return `<input data-scalar autocomplete="off" spellcheck="false" value="${escapeHtml(value)}">`;
}

function readTypedPropertyValues(row) {
  const type = row.dataset.type;
  if (type === "numberPair") {
    return [...row.querySelectorAll("[data-number-pair]")].map((input) => numberOrText(input.value));
  }
  if (type === "boolean") {
    return [row.querySelector("[data-boolean]").checked ? 1 : 0];
  }
  if (type === "enum") {
    return [row.querySelector("[data-enum]").value];
  }
  if (type === "number") {
    return [numberOrText(row.querySelector("[data-scalar]").value)];
  }
  if (type === "color") {
    return readColorValues(row);
  }
  if (type === "numberList") {
    return row.querySelector("[data-scalar]").value.trim().split(/\s+/).filter(Boolean).map(numberOrText);
  }
  return [row.querySelector("[data-scalar]").value];
}

function renderImageAssetOptions(currentValue) {
  return state.imageAssets.slice(0, 250).map((asset) => {
    const selected = asset.ref === currentValue ? " selected" : "";
    return `<option value="${escapeHtml(asset.ref)}"${selected}>${escapeHtml(asset.ref)}</option>`;
  }).join("");
}

function colorStateFromValues(values) {
  const numbers = values.map(Number).filter((value) => Number.isFinite(value));
  const scale = numbers.slice(0, 3).some((value) => value > 1) ? 255 : 1;
  const r = clampColorChannel(numbers[0] ?? scale, scale);
  const g = clampColorChannel(numbers[1] ?? scale, scale);
  const b = clampColorChannel(numbers[2] ?? scale, scale);
  const alpha = clampColorChannel(numbers[3] ?? scale, scale);
  return {
    scale,
    alpha: formatColorNumber(alpha),
    hex: `#${toHexChannel(r, scale)}${toHexChannel(g, scale)}${toHexChannel(b, scale)}`,
  };
}

function readColorValues(row) {
  const scale = Number(row.querySelector(".typedColor")?.dataset.colorScale ?? 1);
  const rgb = hexToRgb(row.querySelector("[data-color]").value);
  const alpha = clampColorChannel(Number(row.querySelector("[data-color-alpha]").value), scale);
  return [
    formatColorNumber((rgb.r / 255) * scale),
    formatColorNumber((rgb.g / 255) * scale),
    formatColorNumber((rgb.b / 255) * scale),
    formatColorNumber(alpha),
  ].map(numberOrText);
}

function clampColorChannel(value, scale) {
  return Math.max(0, Math.min(scale, Number(value)));
}

function toHexChannel(value, scale) {
  const channel = Math.round((value / scale) * 255);
  return channel.toString(16).padStart(2, "0");
}

function hexToRgb(hex) {
  const normalized = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function formatColorNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(4));
}

function numberOrText(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function isTruthyValue(value) {
  const text = String(value ?? "").toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}

function renderImages() {
  const node = selectedNode();
  const images = node?.images ?? [];
  if (!images.length) {
    els.images.innerHTML = '<p class="empty">No image slots.</p>';
    return;
  }

  els.images.innerHTML = images.map((image) => {
    const stateText = image.url
      ? "browser image"
      : image.nativeTexture
        ? `native ${image.nativeTexture.format || image.nativeTexture.ext || "texture"}`
        : image.mode;
    return `<div class="imageItem">
      <strong>image${image.slot}</strong><br>
      ${escapeHtml(image.ref)}<br>
      ${escapeHtml(stateText)}
    </div>`;
  }).join("");
}

async function loadImageAssets() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("asset browser", "Project root is required.");
    return;
  }
  setStatus("Loading images");
  const params = new URLSearchParams({ project });
  const query = els.imageSearch.value.trim();
  if (query) params.set("q", query);
  const response = await fetch(`/api/assets/images?${params}`);
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("asset browser failed", payload.error || "Unknown error");
    setStatus("Asset browser failed");
    return;
  }
  state.imageAssets = payload.items ?? [];
  renderAssetBrowser();
  setStatus(`${state.imageAssets.length} images`);
}

function renderAssetBrowser() {
  if (!state.imageAssets.length) {
    els.assetBrowser.innerHTML = '<p class="empty">No images loaded.</p>';
    return;
  }
  els.assetBrowser.innerHTML = state.imageAssets.map((asset, index) => {
    const preview = asset.url
      ? `<img src="${escapeHtml(asset.url)}" alt="">`
      : `<div class="emptyThumb">${escapeHtml(asset.kind)}</div>`;
    const crop = asset.crop ? `${asset.crop.x},${asset.crop.y} ${asset.crop.width}x${asset.crop.height}` : "";
    return `<div class="assetItem">
      <div class="assetThumb">${preview}</div>
      <div class="assetInfo">
        <strong>${escapeHtml(asset.ref)}</strong>
        <span>${escapeHtml(asset.virtualPath || asset.textureRef || "")}</span>
        ${crop ? `<span>${escapeHtml(crop)}</span>` : ""}
      </div>
      <button type="button" data-use-image="${index}">Use</button>
    </div>`;
  }).join("");
}

async function useImageAsset(indexText) {
  const node = selectedNode();
  const asset = state.imageAssets[Number(indexText)];
  if (!node || !asset) return;
  const key = node.images[0] ? `image${node.images[0].slot}` : "image0";
  els.propertyKey.value = key;
  els.propertyValues.value = asset.ref;
  await saveProperty(node, key, [asset.ref]);
}

function renderDiagnostics() {
  const diagnostics = state.data?.diagnostics ?? [];
  if (!diagnostics.length) {
    els.diagnostics.innerHTML = '<p class="empty">No diagnostics.</p>';
    return;
  }

  els.diagnostics.innerHTML = diagnostics.map((diagnostic) => {
    const kind = diagnostic.code || diagnostic.type || "diagnostic";
    const severity = kind.includes("unresolved") || kind.includes("missing") ? "warn" : "";
    return `<div class="diag ${severity}">
      <strong>${escapeHtml(kind)}</strong><br>
      ${escapeHtml(diagnostic.message || diagnostic.ref || "")}
      ${diagnostic.widget ? `<br>${escapeHtml(diagnostic.widget)}` : ""}
      ${diagnostic.line ? `<br>line ${diagnostic.line}` : ""}
    </div>`;
  }).join("");
}

function renderLayoutConsole() {
  if (!els.layoutConsole) return;
  if (els.layoutConsoleBadge) {
    els.layoutConsoleBadge.textContent = state.layoutConsole.length > 99 ? "99+" : String(state.layoutConsole.length);
  }
  if (!state.layoutConsole.length) {
    els.layoutConsole.innerHTML = '<p class="empty">No layout console entries.</p>';
    return;
  }

  els.layoutConsole.innerHTML = state.layoutConsole.map((entry) => {
    const details = hasLogDetails(entry.details)
      ? `<details><summary>details</summary><pre>${escapeHtml(stableJson(entry.details))}</pre></details>`
      : "";
    return `<div class="consoleLine ${escapeHtml(entry.level)}">
      <span class="consoleTime">${escapeHtml(formatLogTime(entry.at))}</span>
      <span class="consoleLevel">${escapeHtml(entry.level)}</span>
      <span class="consoleScope">${escapeHtml(entry.scope)}</span>
      <span class="consoleMessage">${escapeHtml(entry.message)}</span>
      ${details}
    </div>`;
  }).join("");
  els.layoutConsole.scrollTop = els.layoutConsole.scrollHeight;
}

function renderLayoutDiagnostics() {
  if (!els.layoutDiagnostics) return;
  if (!state.data) {
    els.layoutDiagnostics.innerHTML = '<p class="empty">No layout loaded.</p>';
    return;
  }

  const diagnostics = state.data.diagnostics ?? [];
  if (!diagnostics.length) {
    els.layoutDiagnostics.innerHTML = '<p class="empty">No diagnostics.</p>';
    return;
  }

  els.layoutDiagnostics.innerHTML = diagnostics.map((diagnostic) => {
    const kind = diagnostic.code || diagnostic.type || "diagnostic";
    const severity = diagnostic.severity || (kind.includes("unresolved") || kind.includes("missing") ? "warning" : "info");
    const details = {
      filePath: diagnostic.filePath ?? state.data.filePath ?? null,
      line: diagnostic.line ?? null,
      column: diagnostic.column ?? null,
      widget: diagnostic.widget ?? diagnostic.context?.widget ?? null,
      mode: diagnostic.mode ?? diagnostic.context?.mode ?? null,
      ref: diagnostic.ref ?? diagnostic.context?.ref ?? null,
      context: diagnostic.context ?? null,
    };
    return `<div class="diag ${diagnosticClass(severity)}">
      <strong>${escapeHtml(kind)}</strong>
      <span>${escapeHtml(severity)}</span><br>
      ${escapeHtml(diagnostic.message || diagnostic.ref || "")}
      <pre>${escapeHtml(stableJson(compactObject(details)))}</pre>
    </div>`;
  }).join("");
}

function renderLayoutModel() {
  if (!els.layoutModel) return;
  if (!state.data) {
    els.layoutModel.textContent = "No layout loaded.";
    return;
  }

  els.layoutModel.textContent = stableJson(layoutModelSummary(state.data));
}

function pushLayoutLog(level, scope, message, details = null) {
  state.layoutConsoleSeq += 1;
  state.layoutConsole.push({
    id: state.layoutConsoleSeq,
    at: new Date(),
    level,
    scope,
    message,
    details: details ? compactObject(details) : null,
  });
  if (state.layoutConsole.length > 500) state.layoutConsole.splice(0, state.layoutConsole.length - 500);
  renderLayoutConsole();
}

function pushLayoutLogOnce(key, level, scope, message, details = null) {
  if (state.layoutConsoleSeen.has(key)) return;
  state.layoutConsoleSeen.add(key);
  pushLayoutLog(level, scope, message, details);
}

function resetLayoutConsole() {
  state.layoutConsole = [];
  state.layoutConsoleSeq = 0;
  state.layoutConsoleSeen = new Set();
  renderLayoutConsole();
}

function logLayoutSummary(data) {
  const imageSlots = collectImageSlots(data);
  const nativeTextures = imageSlots.filter(({ image }) => image.nativeTexture);
  const browserImages = imageSlots.filter(({ image }) => image.url);
  const unresolved = imageSlots.filter(({ image }) => !image.ok);
  pushLayoutLog("info", "layout.model", "Layout model built", {
    filePath: data.filePath,
    title: data.title,
    viewport: data.viewport,
    previewState: data.previewState,
    widgets: data.nodes.length,
    diagnostics: data.diagnostics?.length ?? 0,
    imageSlots: imageSlots.length,
    browserImages: browserImages.length,
    nativeTextures: nativeTextures.length,
    unresolvedImages: unresolved.length,
  });

  for (const diagnostic of data.diagnostics ?? []) {
    const kind = diagnostic.code || diagnostic.type || "diagnostic";
    pushLayoutLogOnce(
      `diagnostic:${kind}:${diagnostic.line ?? ""}:${diagnostic.message || diagnostic.ref || ""}`,
      diagnosticLevel(diagnostic),
      "diagnostic",
      diagnostic.message || diagnostic.ref || kind,
      {
        code: kind,
        line: diagnostic.line ?? null,
        widget: diagnostic.widget ?? diagnostic.context?.widget ?? null,
        ref: diagnostic.ref ?? diagnostic.context?.ref ?? null,
        mode: diagnostic.mode ?? diagnostic.context?.mode ?? null,
      },
    );
  }

  for (const { node, image } of nativeTextures) {
    pushLayoutLogOnce(
      `native-texture:${image.nativeTexture?.filePath || image.nativeTexture?.url || image.ref}:${image.slot}`,
      "warn",
      "image.native",
      "Native texture queued for browser decode",
      imageLogDetails(image, node),
    );
  }
}

function logImageLoadFailure(kind, image, error, node = null) {
  const details = {
    ...imageLogDetails(image, node),
    loader: kind,
    error: errorMessage(error),
  };
  const key = `image-failed:${kind}:${details.url || details.filePath || image.ref}:${image.slot}:${details.error}`;
  pushLayoutLogOnce(
    key,
    kind === "native" ? "warn" : "error",
    "image.load",
    `${kind} image failed: ${image.ref}`,
    details,
  );
}

function logImageLoadSuccess(kind, image, bitmap, node = null) {
  const details = {
    ...imageLogDetails(image, node),
    loader: kind,
    width: bitmap?.width ?? bitmap?.source?.width ?? null,
    height: bitmap?.height ?? bitmap?.source?.height ?? null,
    format: bitmap?.format ?? null,
  };
  const key = `image-loaded:${kind}:${details.url || details.filePath || image.ref}:${image.slot}`;
  pushLayoutLogOnce(key, "info", "image.load", `${kind} image loaded: ${image.ref}`, details);
}

function collectImageSlots(data) {
  return (data?.nodes ?? []).flatMap((node) => (node.images ?? []).map((image) => ({ node, image })));
}

function layoutModelSummary(data) {
  const imageSlots = collectImageSlots(data);
  return {
    title: data.title,
    filePath: data.filePath,
    viewport: data.viewport,
    previewState: data.previewState,
    selectedId: state.selectedId,
    widgets: data.nodes.length,
    roots: data.nodes.filter((node) => node.depth === 0).map((node) => ({
      id: node.id,
      name: node.name,
      typeClass: node.typeClass,
      line: node.source?.line ?? null,
      box: node.box,
    })),
    diagnostics: (data.diagnostics ?? []).length,
    images: {
      total: imageSlots.length,
      browser: imageSlots.filter(({ image }) => image.url).length,
      native: imageSlots.filter(({ image }) => image.nativeTexture).length,
      unresolved: imageSlots.filter(({ image }) => !image.ok).length,
      slots: imageSlots.map(({ node, image }) => ({
        widget: node.name,
        widgetType: node.typeClass,
        line: image.line ?? node.source?.line ?? null,
        slot: image.slot,
        ref: image.ref,
        ok: image.ok,
        mode: image.mode,
        filePath: image.filePath ?? image.nativeTexture?.filePath ?? null,
        virtualPath: image.virtualPath ?? null,
        url: image.url ?? image.nativeTexture?.url ?? null,
        nativeFormat: image.nativeTexture?.format ?? image.nativeTexture?.ext ?? null,
        crop: image.crop ?? null,
      })),
    },
  };
}

function imageLogDetails(image, node = null) {
  return compactObject({
    widget: node?.name ?? null,
    widgetType: node?.typeClass ?? null,
    widgetLine: node?.source?.line ?? null,
    slot: image.slot,
    ref: image.ref,
    imageLine: image.line ?? null,
    ok: image.ok,
    mode: image.mode,
    filePath: image.filePath ?? image.nativeTexture?.filePath ?? null,
    virtualPath: image.virtualPath ?? null,
    url: image.url ?? image.nativeTexture?.url ?? null,
    nativeFormat: image.nativeTexture?.format ?? image.nativeTexture?.ext ?? null,
    crop: image.crop ?? null,
  });
}

function diagnosticLevel(diagnostic) {
  const severity = String(diagnostic.severity || "").toLowerCase();
  if (severity === "error") return "error";
  if (severity === "warning" || severity === "warn") return "warn";
  const kind = String(diagnostic.code || diagnostic.type || "").toLowerCase();
  return kind.includes("unresolved") || kind.includes("missing") ? "warn" : "info";
}

function diagnosticClass(severity) {
  const value = String(severity || "").toLowerCase();
  if (value === "error") return "error";
  if (value === "warning" || value === "warn") return "warn";
  return "";
}

function hasLogDetails(details) {
  return Boolean(details && typeof details === "object" && Object.keys(details).length > 0);
}

function compactObject(value) {
  if (Array.isArray(value)) return value.map(compactObject).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, compactObject(item)])
    .filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatLogTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (number, length = 2) => String(number).padStart(length, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

async function refreshSourceState() {
  if (!state.data?.filePath) {
    state.source = "";
    state.sourceHash = null;
    state.history = [];
    renderSourceControls();
    return;
  }

  const params = new URLSearchParams({ file: state.data.filePath });
  const project = els.projectRoot.value.trim();
  if (project) params.set("project", project);

  const [sourceResponse, historyResponse] = await Promise.all([
    fetch(`/api/layout/source?${params}`),
    fetch(`/api/layout/history?${params}`),
  ]);
  const sourcePayload = await sourceResponse.json();
  const historyPayload = await historyResponse.json();
  if (!sourceResponse.ok || !historyResponse.ok) {
    showPanelDiagnostic("source sync failed", sourcePayload.error || historyPayload.error || "Unknown error");
    pushLayoutLog("error", "source.sync", "Source sync failed", {
      sourceStatus: sourceResponse.status,
      historyStatus: historyResponse.status,
      error: sourcePayload.error || historyPayload.error || "Unknown error",
    });
    return;
  }

  state.source = sourcePayload.source;
  state.sourceHash = sourcePayload.hash;
  state.history = historyPayload.entries ?? [];
  state.sourceEditing = false;
  state.sourceDirty = false;
  pushLayoutLog("info", "source.sync", "Layout source loaded", {
    filePath: sourcePayload.filePath,
    hash: sourcePayload.hash,
    bytes: new Blob([sourcePayload.source || ""]).size,
    historyEntries: state.history.length,
  });
  renderSourceControls();
}

function renderSourceControls() {
  if (!state.sourceEditing || !state.sourceDirty) {
    els.sourceView.value = state.source || "";
  }
  els.sourceView.readOnly = !state.sourceEditing;
  const undoEntry = findHistoryEntry("undo");
  const redoEntry = findHistoryEntry("redo");
  els.editSource.disabled = !state.data?.filePath || state.sourceEditing;
  els.diffSource.disabled = !state.data?.filePath || !state.sourceEditing || !state.sourceDirty;
  els.applySource.disabled = !state.data?.filePath || !state.sourceEditing || !state.sourceDirty;
  els.revertSource.disabled = !state.sourceEditing;
  els.undoEdit.disabled = !undoEntry;
  els.redoEdit.disabled = !redoEntry;
  els.refreshSource.disabled = !state.data?.filePath;
}

function findHistoryEntry(direction) {
  if (!state.sourceHash) return null;
  return state.history.find((entry) => direction === "undo"
    ? entry.afterHash === state.sourceHash
    : entry.beforeHash === state.sourceHash) ?? null;
}

async function restoreFromHistory(direction) {
  const entry = findHistoryEntry(direction);
  if (!entry || !state.data?.filePath) return;

  setStatus(direction === "undo" ? "Undoing" : "Redoing");
  const response = await fetch("/api/layout/history/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.data.filePath,
      historyPath: entry.historyPath,
      direction,
      project: els.projectRoot.value.trim() || null,
      width: state.data.viewport.width,
      height: state.data.viewport.height,
      language: els.previewLanguage.value || "English",
      previewState: previewStateValue(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic(`${direction} failed`, payload.error || "Unknown error");
    setStatus(`${direction} failed`);
    return;
  }

  state.data = payload.preview;
  state.history = payload.history ?? [];
  syncSelectionAfterPreview(state.selectedId);
  await refreshSourceState();
  setStatus(direction === "undo" ? "Undo complete" : "Redo complete");
  renderAll();
}

function previewSourceDiff() {
  if (!state.sourceEditing || !state.sourceDirty) return;
  const diff = buildLineDiff(state.source, els.sourceView.value);
  const rows = diff.rows.slice(0, 80).map((row) => {
    const kind = row.type === "added" ? "diffAdd" : row.type === "removed" ? "diffRemove" : "diffSame";
    const sign = row.type === "added" ? "+" : row.type === "removed" ? "-" : " ";
    return `<div class="${kind}"><code>${sign}${row.line}</code> ${escapeHtml(row.text)}</div>`;
  }).join("");
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>source diff</strong><br>
    +${diff.added} / -${diff.removed} lines
    <div class="diffPreview">${rows || "No line changes."}</div>
  </div>`;
}

function buildLineDiff(before, after) {
  const beforeLines = String(before).split(/\r?\n/);
  const afterLines = String(after).split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  const rows = [];
  let added = 0;
  let removed = 0;
  for (let index = 0; index < max; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];
    if (beforeLine === afterLine) continue;
    if (beforeLine !== undefined) {
      removed += 1;
      rows.push({ type: "removed", line: index + 1, text: beforeLine });
    }
    if (afterLine !== undefined) {
      added += 1;
      rows.push({ type: "added", line: index + 1, text: afterLine });
    }
  }
  return { added, removed, rows };
}

async function applySourceEdits() {
  if (!state.data?.filePath || !state.sourceEditing || !state.sourceDirty) return;

  setStatus("Applying source");
  const response = await fetch("/api/layout/source/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.data.filePath,
      source: els.sourceView.value,
      expectedHash: state.sourceHash,
      project: els.projectRoot.value.trim() || null,
      width: state.data.viewport.width,
      height: state.data.viewport.height,
      language: els.previewLanguage.value || "English",
      previewState: previewStateValue(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    const diagnostics = payload.diagnostics ? renderDiagnosticList(payload.diagnostics) : "";
    els.diagnostics.innerHTML = `<div class="diag error"><strong>source apply failed</strong><br>${escapeHtml(payload.error || "Unknown error")}</div>${diagnostics}`;
    pushLayoutLog("error", "source.apply", "Source apply failed", {
      error: payload.error || "Unknown error",
      diagnostics: payload.diagnostics ?? null,
    });
    setStatus("Source apply failed");
    return;
  }

  state.data = payload.preview;
  state.history = payload.history ?? [];
  state.source = els.sourceView.value;
  state.sourceHash = payload.hash;
  state.sourceEditing = false;
  state.sourceDirty = false;
  syncSelectionAfterPreview(state.selectedId);
  await refreshSourceState();
  pushLayoutLog("info", "source.apply", "Source applied", {
    hash: payload.hash,
    historyPath: payload.transaction?.historyPath ?? null,
  });
  setStatus("Source applied");
  renderAll();
}

async function loadProjectValidation() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("project validation", "Project root is required.");
    return;
  }
  setStatus("Validating project");
  const response = await fetch(`/api/project/validate?project=${encodeURIComponent(project)}`);
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("project validation failed", payload.error || "Unknown error");
    setStatus("Validation failed");
    return;
  }
  const diagnostics = [
    ...payload.layouts.flatMap((layout) => layout.diagnostics),
    ...payload.scripts.diagnostics,
    ...payload.stringTable.diagnostics,
  ];
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>project validation</strong><br>
    ${payload.layoutCount} layouts, ${payload.diagnosticCount} diagnostics
  </div>${renderDiagnosticList(diagnostics)}`;
  setStatus(`Project diagnostics: ${payload.diagnosticCount}`);
}

async function loadProjectFiles() {
  const project = normalizeProjectRoot(els.projectBrowserRoot?.value || els.projectRoot.value);
  if (!project) {
    renderProjectFileTree("Project folder is required.");
    return;
  }
  setProjectRootInputs(project);
  rememberProjectRoot(project);

  setStatus("Scanning project");
  const response = await fetch(`/api/project/files?project=${encodeURIComponent(project)}`);
  const payload = await response.json();
  if (!response.ok) {
    state.projectFileTree = null;
    renderProjectFileTree(payload.error || "Unable to scan project files.");
    showPanelDiagnostic("project files", payload.error || "Unknown error");
    setStatus("Project scan failed");
    return;
  }

  state.projectFileTree = payload.tree ?? null;
  state.projectTreeOpen = new Set([""]);
  renderProjectFileTree(payload.truncated
    ? `Showing first ${payload.total} files. Some files are hidden by the scan limit.`
    : `${payload.directoryCount} folders, ${payload.fileCount} files, ${payload.layoutCount} layouts.`);
  setStatus(`Project files ${payload.fileCount}`);
}

async function selectProjectFile(filePath, ext) {
  if (!filePath) return;
  if (String(ext).toLowerCase() !== ".layout") {
    setStatus("Only .layout files open in the editor");
    return;
  }
  els.layoutPath.value = filePath;
  await openLayout();
}

function toggleProjectFolder(relativePath) {
  if (state.projectTreeOpen.has(relativePath)) {
    state.projectTreeOpen.delete(relativePath);
  } else {
    state.projectTreeOpen.add(relativePath);
  }
  renderProjectFileTree();
}

function renderProjectFileTree(message) {
  if (message && els.projectFileCount) els.projectFileCount.textContent = message;
  if (!els.projectFileTree) return;
  const tree = state.projectFileTree;
  if (!tree) {
    els.projectFileTree.innerHTML = '<p class="empty">No project opened.</p>';
    return;
  }
  const query = els.projectFileSearch?.value.trim().toLowerCase() || "";
  const html = renderProjectTreeNode(tree, 0, query);
  els.projectFileTree.innerHTML = html || '<p class="empty">No matching files.</p>';
}

function renderProjectTreeNode(node, depth, query) {
  if (!projectNodeMatches(node, query)) return "";
  if (node.type === "directory") {
    const relativePath = node.relativePath || "";
    const isOpen = query || state.projectTreeOpen.has(relativePath);
    const children = isOpen
      ? (node.children ?? []).map((child) => renderProjectTreeNode(child, depth + 1, query)).join("")
      : "";
    const label = relativePath ? node.name : node.name || "Project";
    return `<div class="fileTreeRow folder ${isOpen ? "open" : ""}" style="--depth:${depth}" data-project-folder="${escapeHtml(relativePath)}">
      <span class="fileTwisty">${isOpen ? "v" : ">"}</span>
      <span class="fileIcon">[]</span>
      <span class="fileName">${escapeHtml(label)}</span>
    </div>${children}`;
  }

  const ext = node.ext || "";
  const isLayout = ext.toLowerCase() === ".layout";
  return `<div class="fileTreeRow file ${isLayout ? "openable" : ""}" style="--depth:${depth}" data-project-file="${escapeHtml(node.filePath)}" data-project-ext="${escapeHtml(ext)}">
    <span class="fileTwisty"></span>
    <span class="fileIcon">${isLayout ? "L" : "."}</span>
    <span class="fileName">${escapeHtml(node.name)}</span>
    <span class="fileMeta">${escapeHtml(formatProjectFileMeta(node))}</span>
  </div>`;
}

function projectNodeMatches(node, query) {
  if (!query) return true;
  const ownMatch = (node.relativePath || node.name || "").toLowerCase().includes(query);
  if (ownMatch) return true;
  return node.type === "directory" && (node.children ?? []).some((child) => projectNodeMatches(child, query));
}

function formatProjectFileMeta(file) {
  const size = Number(file.size ?? 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(size >= 1024 * 100 ? 0 : 1)} KB`;
  return `${size} B`;
}

async function loadPluginSdkReport() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("plugin SDK", "Project root is required.");
    return;
  }
  setStatus("Scanning plugins");
  const response = await fetch(`/api/project/plugins?project=${encodeURIComponent(project)}`);
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("plugin SDK failed", payload.error || "Unknown error");
    setStatus("Plugin scan failed");
    return;
  }

  const runtimeResponse = await fetch(`/api/project/plugin-runtime?project=${encodeURIComponent(project)}`);
  const runtime = runtimeResponse.ok ? await runtimeResponse.json() : null;
  if (!els.pluginCommandId.value.trim() && runtime?.commands?.[0]?.id) {
    els.pluginCommandId.value = runtime.commands[0].id;
  }
  const packageResponse = await fetch(`/api/project/plugin-package?project=${encodeURIComponent(project)}`);
  const pluginPackage = packageResponse.ok ? await packageResponse.json() : null;
  const counts = payload.contributionCounts ?? {};
  const runtimeCounts = runtime?.contributionCounts ?? {};
  const packageHash = pluginPackage?.packageSha256 ? `${pluginPackage.packageSha256.slice(0, 12)}...` : "n/a";
  const pluginRows = (payload.plugins ?? []).slice(0, 16).map(renderPluginRow).join("");
  els.diagnostics.innerHTML = `<div class="diag ${payload.ready ? "" : "warn"}">
    <strong>plugin SDK</strong><br>
    ${payload.pluginCount} plugins, ${payload.enabledCount} enabled, ${payload.diagnostics?.length ?? 0} diagnostics<br>
    commands: ${counts.commands ?? 0}, widgets: ${counts.widgetPresets ?? 0}, panels: ${counts.panels ?? 0}, validators: ${counts.validators ?? 0}<br>
    runtime: ${runtime?.pluginCount ?? 0} plugins, ${runtimeCounts.widgetPresets ?? 0} widget presets, ${runtime?.package?.fileCount ?? 0} package files<br>
    package: ${pluginPackage?.ready ? "ready" : "not ready"}, sha256 ${escapeHtml(packageHash)}
  </div>
  ${pluginRows ? `<div class="readinessChecks">${pluginRows}</div>` : '<p class="empty">No DZUI plugins found.</p>'}
  ${renderDiagnosticList(payload.diagnostics ?? [])}`;
  setStatus(`Plugins ${payload.pluginCount}`);
}

function renderPluginRow(plugin) {
  const css = plugin.enabled ? "ready" : "skipped";
  const capabilities = plugin.capabilities?.length ? plugin.capabilities.join(", ") : "none";
  return `<div class="readinessCheck ${css}">
    <strong>${escapeHtml(plugin.name || plugin.id)}</strong><br>
    ${escapeHtml(plugin.id)} ${escapeHtml(plugin.version || "")}<br>
    capabilities: ${escapeHtml(capabilities)}<br>
    ${escapeHtml(plugin.manifestVirtualPath || plugin.manifestPath || "")}
  </div>`;
}

async function savePluginRuntimePackage() {
  const project = pluginProjectRoot();
  if (!project) return;
  setStatus("Saving plugin package");
  const body = {
    projectRoot: project,
    out: optionalInputValue(els.pluginPackagePath),
    signPrivateKeyPath: optionalInputValue(els.pluginSignPrivateKey),
    signPublicKeyPath: optionalInputValue(els.pluginSignPublicKey),
    signKeyId: optionalInputValue(els.pluginSignKeyId),
  };
  const payload = await postPluginJson("/api/project/plugin-package/save", body, "plugin package save");
  if (!payload) return;
  renderPluginTrustResult("plugin package saved", payload);
  setStatus(payload.integrity?.signed ? "Plugin package signed" : "Plugin package saved");
}

async function installPluginTrustKey() {
  const project = pluginProjectRoot();
  if (!project) return;
  setStatus("Installing plugin trust key");
  const payload = await postPluginJson("/api/project/plugin-trust", {
    projectRoot: project,
    packagePath: optionalInputValue(els.pluginPackagePath),
    trustPolicyPath: optionalInputValue(els.pluginTrustPolicyPath),
  }, "plugin trust install");
  if (!payload) return;
  renderPluginTrustResult(payload.alreadyTrusted ? "plugin key already trusted" : "plugin key trusted", payload);
  setStatus(payload.ready ? "Plugin key trusted" : "Plugin trust failed");
}

async function verifyPluginRuntimePackageUi() {
  const project = pluginProjectRoot();
  if (!project) return;
  setStatus("Verifying trusted plugin package");
  const payload = await postPluginJson("/api/project/plugin-package/verify", {
    projectRoot: project,
    packagePath: optionalInputValue(els.pluginPackagePath),
    requireTrusted: true,
    trustPolicyPath: optionalInputValue(els.pluginTrustPolicyPath),
  }, "plugin package verify");
  if (!payload) return;
  renderPluginTrustResult("plugin package verification", payload);
  setStatus(payload.passed ? "Plugin package trusted" : "Plugin package not trusted");
}

async function runTrustedPluginCommand() {
  const project = pluginProjectRoot();
  if (!project) return;
  const commandId = els.pluginCommandId.value.trim();
  if (!commandId) {
    showPanelDiagnostic("plugin command", "Command id is required.");
    return;
  }
  let args = {};
  const argsJson = els.pluginCommandArgsJson.value.trim();
  if (argsJson) {
    try {
      args = JSON.parse(argsJson);
    } catch (error) {
      showPanelDiagnostic("plugin command args", error.message);
      return;
    }
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      showPanelDiagnostic("plugin command args", "Command args must be a JSON object.");
      return;
    }
  }
  setStatus("Running plugin command");
  const payload = await postPluginJson("/api/project/plugin-command", {
    projectRoot: project,
    commandId,
    args,
    packagePath: optionalInputValue(els.pluginPackagePath),
    execute: true,
    requireTrusted: true,
    trustPolicyPath: optionalInputValue(els.pluginTrustPolicyPath),
  }, "plugin command");
  if (!payload) return;
  renderPluginTrustResult("plugin command result", payload);
  setStatus(payload.executed ? "Plugin command complete" : "Plugin command refused");
}

async function postPluginJson(url, body, title) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic(title, payload.error || "Unknown error");
    setStatus("Plugin workflow failed");
    return null;
  }
  return payload;
}

function pluginProjectRoot() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("plugin workflow", "Project root is required.");
    return "";
  }
  return project;
}

function optionalInputValue(input) {
  const value = input?.value?.trim() ?? "";
  return value || undefined;
}

function renderPluginTrustResult(title, payload) {
  const verification = payload.verification ?? payload;
  const signature = verification.signature ?? payload.signature ?? {};
  const hash = typeof payload.packageSha256 === "string"
    ? payload.packageSha256
    : verification.packageSha256?.expected ?? verification.packageSha256?.actual ?? "";
  const key = payload.key ?? {};
  const commandResult = payload.result
    ? `<br>result: <code>${escapeHtml(JSON.stringify(payload.result))}</code>`
    : "";
  const filePath = payload.filePath ? `<br>file: ${escapeHtml(payload.filePath)}` : "";
  const keyLine = key.id ? `<br>key: ${escapeHtml(key.id)}` : signature.keyId ? `<br>key: ${escapeHtml(signature.keyId)}` : "";
  const policyLine = payload.policy ? `<br>trusted keys: ${payload.policy.trustedKeyCount}` : "";
  const ok = payload.ready !== false && payload.passed !== false && payload.executed !== false;
  const signed = signature.signed ?? payload.integrity?.signed;
  const verified = signature.verified === true;
  const trusted = signature.trusted === true;
  els.diagnostics.innerHTML = `<div class="diag ${ok ? "" : "warn"}">
    <strong>${escapeHtml(title)}</strong><br>
    ready: ${payload.ready === false ? "no" : "yes"}${payload.passed !== undefined ? `<br>passed: ${payload.passed ? "yes" : "no"}` : ""}${payload.executed !== undefined ? `<br>executed: ${payload.executed ? "yes" : "no"}` : ""}<br>
    signed: ${signed ? "yes" : "no"}, verified: ${verified ? "yes" : "no"}, trusted: ${trusted ? "yes" : "no"}<br>
    sha256: ${escapeHtml(hash ? `${hash.slice(0, 16)}...` : "n/a")}${keyLine}${policyLine}${filePath}${commandResult}
  </div>${renderDiagnosticList(payload.diagnostics ?? verification.diagnostics ?? [])}`;
}

async function loadProjectSettings() {
  const project = normalizeProjectRoot(els.projectRoot.value);
  if (!project) {
    showPanelDiagnostic("project settings", "Project root is required.");
    return;
  }
  setProjectRootInputs(project);
  rememberProjectRoot(project);
  setStatus("Loading settings");
  const response = await fetch(`/api/project/settings?project=${encodeURIComponent(project)}`);
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("settings load failed", payload.error || "Unknown error");
    setStatus("Settings load failed");
    return;
  }

  const settings = payload.settings ?? {};
  if (settings.layoutPath) els.layoutPath.value = settings.layoutPath;
  if (settings.preview?.width) els.width.value = settings.preview.width;
  if (settings.preview?.height) els.height.value = settings.preview.height;
  if (settings.preview?.width && settings.preview?.height) {
    state.previewResolutionMode = "fixed";
    syncPreviewResolutionSelect(settings.preview.width, settings.preview.height);
  }
  if (settings.preview?.language) ensureLanguageOption(settings.preview.language);
  if (settings.preview?.state) els.previewState.value = settings.preview.state;
  els.diagnostics.innerHTML = `<div class="diag ${payload.exists ? "" : "warn"}">
    <strong>project settings</strong><br>
    ${payload.exists ? "loaded" : "using defaults"}<br>
    ${escapeHtml(payload.filePath)}
  </div>`;
  setStatus(payload.exists ? "Settings loaded" : "Default settings loaded");
  if (settings.layoutPath) await openLayout();
}

async function saveProjectSettings() {
  const project = normalizeProjectRoot(els.projectRoot.value);
  if (!project) {
    showPanelDiagnostic("project settings", "Project root is required.");
    return;
  }
  setProjectRootInputs(project);
  rememberProjectRoot(project);
  setStatus("Saving settings");
  const response = await fetch("/api/project/settings/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectRoot: project,
      settings: {
        layoutPath: els.layoutPath.value.trim() || null,
        preview: {
          width: Number(els.width.value || 1280),
          height: Number(els.height.value || 720),
          language: els.previewLanguage.value || "English",
          state: previewStateValue(),
        },
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("settings save failed", payload.error || "Unknown error");
    setStatus("Settings save failed");
    return;
  }
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>project settings saved</strong><br>
    ${escapeHtml(payload.filePath)}<br>
    layout: ${escapeHtml(payload.settings.layoutPath || "none")}
  </div>`;
  setStatus("Settings saved");
}

function ensureLanguageOption(language) {
  const value = String(language || "English");
  if (![...els.previewLanguage.options].some((option) => option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    els.previewLanguage.append(option);
  }
  els.previewLanguage.value = value;
}

async function loadControllerSkeleton() {
  if (!state.data?.filePath) {
    showPanelDiagnostic("controller", "Open a layout first.");
    return;
  }
  setStatus("Generating controller");
  const response = await fetch(`/api/script/controller?file=${encodeURIComponent(state.data.filePath)}&layout=${encodeURIComponent(els.layoutPath.value)}`);
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("controller failed", payload.error || "Unknown error");
    setStatus("Controller failed");
    return;
  }
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>controller skeleton</strong><br>
    ${escapeHtml(payload.className)} (${payload.widgets.length} widgets)
    <pre>${escapeHtml(payload.source)}</pre>
  </div>`;
  setStatus("Controller generated");
}

async function saveStringTableKey() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("stringtable", "Project root is required.");
    return;
  }
  const key = els.stringKey.value.trim();
  if (!key) {
    showPanelDiagnostic("stringtable", "Key is required.");
    return;
  }
  const file = `${project.replace(/[\\/]$/, "")}/stringtable.csv`;
  const response = await fetch("/api/stringtable/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file,
      key,
      values: {
        English: els.stringEnglish.value,
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("stringtable failed", payload.error || "Unknown error");
    return;
  }
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>stringtable saved</strong><br>
    ${escapeHtml(payload.key)} (${payload.inserted ? "inserted" : "updated"})
  </div>`;
  await loadStringTableGrid({ silent: true });
  await openLayout();
  setStatus("String saved");
}

async function loadStringTableGrid(options = {}) {
  const project = els.projectRoot.value.trim();
  if (!project) {
    if (!options.silent) showPanelDiagnostic("stringtable", "Project root is required.");
    return;
  }
  const response = await fetch(`/api/stringtable?project=${encodeURIComponent(project)}`);
  const payload = await response.json();
  if (!response.ok) {
    if (!options.silent) showPanelDiagnostic("stringtable failed", payload.error || "Unknown error");
    return;
  }
  state.stringTableGrid = payload;
  renderStringTableGrid();
  updateLanguageOptions(payload.columns ?? []);
  if (!options.silent) setStatus(`${payload.rows.length} strings`);
}

function updateLanguageOptions(columns) {
  const current = els.previewLanguage.value || "English";
  const nextColumns = columns.length ? columns : ["English"];
  els.previewLanguage.innerHTML = nextColumns.map((column) => {
    const selected = column === current ? " selected" : "";
    return `<option value="${escapeHtml(column)}"${selected}>${escapeHtml(column)}</option>`;
  }).join("");
  if (!nextColumns.includes(current)) {
    els.previewLanguage.value = nextColumns.includes("English") ? "English" : nextColumns[0];
  }
}

function renderStringTableGrid() {
  const grid = state.stringTableGrid;
  if (!grid) {
    els.stringTableGrid.innerHTML = '<p class="empty">No stringtable loaded.</p>';
    return;
  }
  const columns = grid.columns ?? [];
  if (!grid.rows?.length) {
    els.stringTableGrid.innerHTML = '<p class="empty">Stringtable is empty.</p>';
    return;
  }
  const template = `minmax(120px, 0.9fr) repeat(${Math.max(1, columns.length)}, minmax(120px, 1fr)) auto`;
  els.stringTableGrid.innerHTML = `<div class="stringGridHeader" style="grid-template-columns: ${escapeHtml(template)}">
    <span>Key</span>
    ${columns.map((column) => `<span>${escapeHtml(column)}</span>`).join("")}
    <span></span>
  </div>
  ${grid.rows.slice(0, 120).map((row, index) => `<div class="stringGridRow" style="grid-template-columns: ${escapeHtml(template)}" data-string-row="${index}" data-key="${escapeHtml(row.key)}">
    <code>${escapeHtml(row.key)}</code>
    ${columns.map((column) => `<input data-string-column="${escapeHtml(column)}" value="${escapeHtml(row.values[column] ?? "")}">`).join("")}
    <button type="button" data-save-string-row="${index}">Save</button>
  </div>`).join("")}`;
}

async function saveStringTableRow(row) {
  if (!row || !state.stringTableGrid?.filePath) return;
  const values = {};
  for (const input of row.querySelectorAll("[data-string-column]")) {
    values[input.dataset.stringColumn] = input.value;
  }
  const response = await fetch("/api/stringtable/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.stringTableGrid.filePath,
      key: row.dataset.key,
      values,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("string row failed", payload.error || "Unknown error");
    return;
  }
  await loadStringTableGrid({ silent: true });
  await openLayout();
  setStatus(`Saved ${payload.key}`);
}

async function loadStyles(options = {}) {
  const params = new URLSearchParams();
  const file = els.styleFilePath.value.trim();
  const project = els.projectRoot.value.trim();
  if (file) {
    params.set("file", file);
  } else if (project) {
    params.set("project", project);
  } else {
    if (!options.silent) showPanelDiagnostic("styles", "Project root or style file is required.");
    return;
  }

  const response = await fetch(`/api/styles?${params}`);
  const payload = await response.json();
  if (!response.ok) {
    if (!options.silent) showPanelDiagnostic("styles failed", payload.error || "Unknown error");
    return;
  }
  state.styleList = payload;
  if (!file && payload.filePath) els.styleFilePath.value = payload.filePath;
  renderStyleKeyOptions(payload.propertySchemas ?? []);
  renderStyleList();
  updateStyleSchemaHint();
  if (!options.silent) setStatus(`${payload.styles?.length ?? 0} styles`);
}

function renderStyleList() {
  const data = state.styleList;
  if (!data) {
    els.styleList.innerHTML = '<p class="empty">No styles loaded.</p>';
    return;
  }
  const styles = data.styles ?? [];
  if (!styles.length) {
    els.styleList.innerHTML = `<p class="empty">${data.sourceExists ? "No styles found." : "Style file will be created on save."}</p>`;
    return;
  }

  const diagnostics = (data.diagnostics ?? []).slice(0, 8).map((diagnostic) => (
    `<div class="diag ${diagnostic.severity === "error" ? "error" : "warn"}">
      <strong>${escapeHtml(diagnostic.code)}</strong><br>${escapeHtml(diagnostic.message)}
    </div>`
  )).join("");
  const summary = `<div class="diag ${data.diagnosticCount ? "warn" : ""}">
    <strong>style registry</strong><br>
    styles: ${styles.length}<br>
    diagnostics: ${data.diagnosticCount ?? 0}
  </div>`;
  const rows = styles.slice(0, 120).map((style) => {
    const props = (style.effectiveProps ?? style.props ?? []).slice(0, 5).map((prop) => {
      const source = prop.inherited ? ` [${prop.sourceStyle}]` : "";
      return `${prop.key}${source} ${prop.values.join(" ")}`.trim();
    });
    const totalProps = (style.effectiveProps ?? style.props ?? []).length;
    const more = totalProps > props.length ? ` +${totalProps - props.length}` : "";
    const parents = (style.parentStyles ?? []).length ? `extends ${style.parentStyles.join(", ")}` : style.typeClass;
    const issueCount = style.diagnostics?.length ?? 0;
    return `<button class="styleItem" type="button" data-style-name="${escapeHtml(style.name)}">
      <span>
        <strong>${escapeHtml(style.name)}</strong>
        <code>${escapeHtml(parents)}</code>
      </span>
      <small>${escapeHtml(props.join("; ") || "empty")}${escapeHtml(more)}</small>
      ${issueCount ? `<small class="styleIssues">${issueCount} diagnostic${issueCount === 1 ? "" : "s"}</small>` : ""}
    </button>`;
  }).join("");
  els.styleList.innerHTML = `${summary}${diagnostics}${rows}`;
}

function selectStyleListItem(styleName) {
  const style = state.styleList?.styles?.find((candidate) => candidate.name === styleName);
  if (!style) return;
  els.styleName.value = style.name;
  const prop = style.props?.[0];
  if (prop) {
    els.styleKey.value = prop.key;
    els.styleValues.value = prop.values.join(" ");
  }
  updateStyleSchemaHint(style);
}

function renderStyleKeyOptions(schemas) {
  if (!els.styleKeyOptions) return;
  els.styleKeyOptions.innerHTML = schemas
    .map((schema) => `<option value="${escapeHtml(schema.key)}" label="${escapeHtml(schema.type)}"></option>`)
    .join("");
}

function updateStyleSchemaHint(selectedStyle = null) {
  if (!els.styleSchemaHint) return;
  const key = els.styleKey.value.trim();
  const styleName = els.styleName.value.trim();
  const style = selectedStyle ?? state.styleList?.styles?.find((candidate) => candidate.name === styleName);
  const schema = findStyleSchema(key);
  const effective = key
    ? style?.effectiveProps?.find((prop) => prop.key.toLowerCase() === key.toLowerCase())
    : null;
  const diagnostics = (style?.diagnostics ?? [])
    .filter((diagnostic) => !key || diagnostic.context?.property?.toLowerCase?.() === key.toLowerCase())
    .slice(0, 4);

  if (!key && !style) {
    els.styleSchemaHint.innerHTML = "";
    return;
  }

  const bits = [];
  if (schema) {
    const expected = schema.maxValues === null
      ? `${schema.minValues}+`
      : schema.minValues === schema.maxValues
        ? `${schema.minValues}`
        : `${schema.minValues}-${schema.maxValues}`;
    bits.push(`<strong>${escapeHtml(schema.type)}</strong>`);
    bits.push(`values: ${escapeHtml(expected)}`);
    bits.push(`preview: ${escapeHtml(schema.previewSupport ?? "unknown")}`);
  }
  if (effective?.inherited) {
    bits.push(`inherited from ${escapeHtml(effective.sourceStyle)}`);
  } else if (effective) {
    bits.push("defined on selected style");
  }

  const diagnosticHtml = diagnostics.map((diagnostic) => (
    `<div class="schemaDiag ${diagnostic.severity === "error" ? "error" : ""}">
      <strong>${escapeHtml(diagnostic.code)}</strong> ${escapeHtml(diagnostic.message)}
    </div>`
  )).join("");

  els.styleSchemaHint.innerHTML = `
    <div>${bits.join(" | ") || "raw style property"}</div>
    ${diagnosticHtml}
  `;
}

function findStyleSchema(key) {
  if (!key) return null;
  const schemas = state.styleList?.propertySchemas ?? [];
  const exact = schemas.find((schema) => schema.key.toLowerCase() === key.toLowerCase());
  if (exact) return exact;
  if (key.toLowerCase().endsWith("color")) {
    return {
      key,
      type: "rgba",
      minValues: 4,
      maxValues: 4,
      previewSupport: "partial",
    };
  }
  if (key.toLowerCase().includes("font")) {
    return {
      key,
      type: "font-ref",
      minValues: 1,
      maxValues: null,
      previewSupport: "partial",
    };
  }
  return {
    key,
    type: "raw-values",
    minValues: 0,
    maxValues: null,
    previewSupport: "unknown",
  };
}

async function saveStyleProperty() {
  const file = els.styleFilePath.value.trim();
  const styleName = els.styleName.value.trim();
  const key = els.styleKey.value.trim();
  if (!file) {
    showPanelDiagnostic("styles", "Style file is required.");
    return;
  }
  if (!styleName) {
    showPanelDiagnostic("styles", "Style name is required.");
    return;
  }
  if (!key) {
    showPanelDiagnostic("styles", "Property key is required.");
    return;
  }

  const response = await fetch("/api/styles/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file,
      styleName,
      key,
      values: parseLooseValues(els.styleValues.value),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("style save failed", payload.error || "Unknown error");
    return;
  }
  els.styleFilePath.value = payload.filePath;
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>style saved</strong><br>
    ${escapeHtml(payload.style.name)}.${escapeHtml(key)}
    (${payload.insertedStyle ? "new style" : payload.insertedProperty ? "new property" : "updated"})
  </div>`;
  await loadStyles({ silent: true });
  if (state.data) await openLayout();
  setStatus("Style saved");
}

function parseLooseValues(rawValue) {
  const values = [];
  const pattern = /"((?:\\.|[^"\\])*)"|(\S+)/g;
  for (const match of String(rawValue).matchAll(pattern)) {
    const text = (match[1] ?? match[2] ?? "").replace(/\\(["\\])/g, "$1");
    const number = Number(text);
    values.push(Number.isFinite(number) && text.trim() !== "" ? number : text);
  }
  return values;
}

async function loadFonts(options = {}) {
  const project = els.projectRoot.value.trim();
  if (!project) {
    if (!options.silent) showPanelDiagnostic("fonts", "Project root is required.");
    return;
  }
  const params = new URLSearchParams({ project });
  const layout = state.data?.filePath || els.layoutPath.value.trim();
  if (layout) params.set("layout", layout);
  const response = await fetch(`/api/fonts?${params}`);
  const payload = await response.json();
  if (!response.ok) {
    if (!options.silent) showPanelDiagnostic("fonts failed", payload.error || "Unknown error");
    return;
  }
  state.fontRegistry = payload;
  renderFontList();
  if (!options.silent) setStatus(`${payload.count ?? 0} fonts`);
}

async function loadFontCoverageReport() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("font coverage", "Project root is required.");
    return;
  }
  const params = new URLSearchParams({ project });
  const layout = state.data?.filePath || els.layoutPath.value.trim();
  if (layout) params.set("layout", layout);
  const languages = state.stringTableGrid?.columns?.join(",");
  if (languages) params.set("languages", languages);
  setStatus("Checking font coverage");
  const response = await fetch(`/api/font/coverage?${params}`);
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("font coverage failed", payload.error || "Unknown error");
    setStatus("Font coverage failed");
    return;
  }
  state.fontRegistry = payload;
  renderFontCoverageReport(payload);
  setStatus(`Font coverage ${payload.ready ? "ready" : "warnings"}`);
}

function renderFontCoverageReport(report) {
  const diagnostics = (report.diagnostics ?? []).slice(0, 10).map((diagnostic) => (
    `<div class="diag warn"><strong>${escapeHtml(diagnostic.code)}</strong><br>${escapeHtml(diagnostic.message)}</div>`
  )).join("");
  const rows = (report.fonts ?? []).slice(0, 80).map((font) => {
    const languages = (font.languages ?? []).map((language) => (
      `${language.language}: ${language.missingGlyphCount ? `${language.missingGlyphCount} missing` : "ok"}`
    )).join("; ");
    const pages = (font.atlasPages ?? []).map((page) => (
      `${page.ref}${page.exists ? "" : " missing"}`
    )).join(", ");
    return `<div class="fontItem">
      <span>
        <strong>${escapeHtml(font.virtualPath)}</strong>
        <code>${font.used ? `${font.sampleCount} samples` : "unused"}</code>
      </span>
      <small>${escapeHtml(languages || font.coverage?.reason || "no text samples")}</small>
      <small>${escapeHtml(pages ? `atlas: ${pages}` : "")}</small>
    </div>`;
  }).join("");
  els.fontList.innerHTML = `<div class="diag ${report.ready ? "" : "warn"}">
    <strong>font language coverage</strong><br>
    layouts: ${report.layoutCount ?? 0}<br>
    languages: ${escapeHtml((report.targetLanguages ?? []).join(", ") || "literal")}<br>
    fonts: ${report.fontCount ?? 0}, used: ${report.usedFontCount ?? 0}<br>
    missing glyphs: ${report.missingGlyphCount ?? 0}, unknown coverage: ${report.unknownCoverageCount ?? 0}
  </div>${diagnostics}${rows || '<p class="empty">No fonts found.</p>'}`;
}

function renderFontList() {
  const data = state.fontRegistry;
  if (!data) {
    els.fontList.innerHTML = '<p class="empty">No fonts loaded.</p>';
    return;
  }
  const diagnostics = (data.diagnostics ?? []).slice(0, 8).map((diagnostic) => (
    `<div class="diag warn"><strong>${escapeHtml(diagnostic.code)}</strong><br>${escapeHtml(diagnostic.message)}</div>`
  )).join("");
  const rows = (data.fonts ?? []).slice(0, 80).map((font) => {
    const coverage = font.coverage ?? {};
    const known = coverage.known ? `${coverage.glyphCount} glyphs` : "coverage unknown";
    const ranges = (coverage.ranges ?? []).slice(0, 3).map((range) => range.label).join(", ");
    return `<div class="fontItem">
      <span>
        <strong>${escapeHtml(font.virtualPath)}</strong>
        <code>${escapeHtml(known)}</code>
      </span>
      <small>${escapeHtml(ranges || coverage.reason || "")}</small>
    </div>`;
  }).join("");
  els.fontList.innerHTML = `<div class="diag ${data.diagnosticCount ? "warn" : ""}">
    <strong>font coverage</strong><br>
    fonts: ${data.count ?? 0}<br>
    known coverage: ${data.knownCoverage ?? 0}<br>
    diagnostics: ${data.diagnosticCount ?? 0}
  </div>${diagnostics}${rows || '<p class="empty">No fonts found.</p>'}`;
}

async function importFont() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("font import", "Project root is required.");
    return;
  }
  const sourceFont = els.fontSource.value.trim();
  if (!sourceFont) {
    showPanelDiagnostic("font import", "Source font is required.");
    return;
  }
  const response = await fetch("/api/font/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectRoot: project,
      sourceFont,
      fontVirtualPath: els.fontAssetPath.value.trim() || undefined,
      sampleText: els.fontSampleText.value,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("font import failed", payload.error || "Unknown error");
    return;
  }
  const pages = (payload.pages ?? []).map((page) => page.virtualPath).join(", ");
  const missing = payload.missingGlyphs?.length
    ? `<br>missing glyphs: ${escapeHtml(payload.missingGlyphs.map((glyph) => glyph.hex).join(", "))}`
    : "";
  els.diagnostics.innerHTML = `<div class="diag ${payload.diagnosticCount ? "warn" : ""}">
    <strong>font imported</strong><br>
    ${escapeHtml(payload.fontVirtualPath)}<br>
    ref: ${escapeHtml(payload.fontRef)}<br>
    glyphs: ${payload.coverage?.known ? payload.coverage.glyphCount : "unknown"}<br>
    pages: ${escapeHtml(pages || "none")}${missing}
  </div>${renderDiagnosticList(payload.diagnostics ?? [])}`;
  await loadFonts({ silent: true });
  setStatus("Font imported");
}

async function importImage() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("image import", "Project root is required.");
    return;
  }
  const response = await fetch("/api/image/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectRoot: project,
      sourceImage: els.imageSource.value.trim(),
      assetVirtualPath: els.imageAssetPath.value.trim(),
      imageSetVirtualPath: els.imageSetPath.value.trim(),
      imageName: els.imageName.value.trim() || undefined,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("image import failed", payload.error || "Unknown error");
    return;
  }
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>image imported</strong><br>
    ${escapeHtml(payload.assetVirtualPath)}<br>
    ${escapeHtml(payload.setRef)}
  </div>`;
  setStatus("Image imported");
}

async function packAtlas() {
  const project = els.projectRoot.value.trim();
  if (!project) {
    showPanelDiagnostic("atlas pack", "Project root is required.");
    return;
  }
  const sources = els.atlasSources.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!sources.length) {
    showPanelDiagnostic("atlas pack", "At least one PNG source path is required.");
    return;
  }
  const assetVirtualPath = els.imageAssetPath.value.trim();
  const imageSetVirtualPath = els.imageSetPath.value.trim();
  if (!assetVirtualPath || !imageSetVirtualPath) {
    showPanelDiagnostic("atlas pack", "Asset path and imageset path are required.");
    return;
  }

  const response = await fetch("/api/atlas/pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectRoot: project,
      sources,
      assetVirtualPath,
      imageSetVirtualPath,
      maxWidth: Number(els.atlasMaxWidth.value || 2048),
      padding: Number(els.atlasPadding.value || 0),
      powerOfTwo: els.atlasPowerOfTwo.checked,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("atlas pack failed", payload.error || "Unknown error");
    return;
  }
  els.diagnostics.innerHTML = `<div class="diag">
    <strong>atlas packed</strong><br>
    ${escapeHtml(payload.assetVirtualPath)} ${payload.atlas.width}x${payload.atlas.height}<br>
    sprites: ${payload.placements.length}
  </div>`;
  await loadImageAssets({ silent: true });
  setStatus("Atlas packed");
}

function renderDiagnosticList(diagnostics) {
  if (!diagnostics.length) return "";
  return diagnostics.slice(0, 80).map((diagnostic) => {
    const kind = diagnostic.code || diagnostic.type || "diagnostic";
    const severity = diagnostic.severity === "error" ? "error" : diagnostic.severity === "warning" ? "warn" : "";
    return `<div class="diag ${severity}">
      <strong>${escapeHtml(kind)}</strong><br>
      ${escapeHtml(diagnostic.message || diagnostic.ref || "")}
      ${diagnostic.line ? `<br>line ${diagnostic.line}` : ""}
    </div>`;
  }).join("");
}

function showPanelDiagnostic(title, message) {
  els.diagnostics.innerHTML = `<div class="diag error"><strong>${escapeHtml(title)}</strong><br>${escapeHtml(message)}</div>`;
  pushLayoutLog("error", "panel", title, { message });
}

async function draw() {
  if (!state.data) {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    return;
  }

  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.fillStyle = "#474747";
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
  drawGrid();

  for (const node of renderOrderedNodes(state.data.nodes)) {
    if (!node.visible) continue;
    await drawNode(node);
  }
  drawGroupSelectionBounds();
  drawDragGuides();
}

async function drawNode(node) {
  const displayBox = dragDisplayBox(node);
  const { x, y, width, height } = displayBox;
  const selected = node.id === state.selectedId;
  const multiSelected = state.selectedIds.has(node.id);
  const lowerType = node.typeClass.toLowerCase();
  const isText = lowerType.includes("text");
  const styleDrawn = await drawStyleRender(node, x, y, width, height);

  if (node.images.length) {
    for (const image of node.images) {
      const drawn = await drawImageSlot(image, x, y, width, height, node);
      if (!drawn) drawImagePlaceholder(image, x, y, width, height);
    }
  } else if (!styleDrawn && !isText && !isEditorRootBackdrop(node) && Array.isArray(renderColorForNode(node))) {
    ctx.fillStyle = rgbaCss(renderColorForNode(node), "rgba(16, 22, 21, 0)", renderAlphaForNode(node));
    ctx.fillRect(x, y, width, height);
  }

  if (node.text) {
    const textInset = checkboxTextInset(node);
    ctx.fillStyle = rgbaCss(renderColorForNode(node), "#edf4f1", renderAlphaForNode(node));
    const fontSize = Number(node.textLayout?.exactSize)
      || Math.max(12, Math.min(24, height * 0.45));
    ctx.font = `${node.textLayout?.bold ? 700 : 400} ${Math.max(1, fontSize)}px Segoe UI, Arial`;
    ctx.textAlign = textCanvasAlign(node.textLayout?.halign);
    ctx.textBaseline = textCanvasBaseline(node.textLayout?.valign);
    const textX = textCanvasX(node, x, width, textInset);
    const textY = textCanvasY(node, y, height);
    ctx.fillText(node.text, textX, textY, Math.max(1, width - 12 - textInset));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  ctx.strokeStyle = selected
    ? rgbaCss(node.stateColors?.selected, "#64c8a6", 1)
    : multiSelected
      ? "#d5a24d"
      : "rgba(237, 244, 241, 0.24)";
  ctx.lineWidth = selected || multiSelected ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  if (selected || multiSelected) {
    ctx.fillStyle = selected ? "#64c8a6" : "#d5a24d";
    ctx.fillRect(x + width - 7, y + height - 7, 6, 6);
  }
}

function drawGrid() {
  if (!state.showGrid || !state.data) return;
  const step = readGridSize();
  if (step < 2) return;
  ctx.save();
  ctx.strokeStyle = "rgba(237, 244, 241, 0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < els.canvas.width; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, els.canvas.height);
  }
  for (let y = step; y < els.canvas.height; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(els.canvas.width, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawDragGuides() {
  const drag = state.canvasDrag;
  if (!drag) return;
  const box = selectedDisplayBounds() ?? drag.previewBox;
  const lines = [
    ["v", box.x],
    ["v", box.x + (box.width / 2)],
    ["v", box.x + box.width],
    ["h", box.y],
    ["h", box.y + (box.height / 2)],
    ["h", box.y + box.height],
  ];
  ctx.save();
  ctx.strokeStyle = state.snapToGrid ? "rgba(100, 200, 166, 0.55)" : "rgba(213, 162, 77, 0.42)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (const [axis, value] of lines) {
    const rounded = Math.round(value) + 0.5;
    if (axis === "v") {
      ctx.moveTo(rounded, 0);
      ctx.lineTo(rounded, els.canvas.height);
    } else {
      ctx.moveTo(0, rounded);
      ctx.lineTo(els.canvas.width, rounded);
    }
  }
  ctx.stroke();
  if (drag.activeGuides?.length) {
    ctx.strokeStyle = "rgba(100, 200, 166, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const guide of drag.activeGuides) {
      const rounded = Math.round(guide.value) + 0.5;
      if (guide.axis === "x") {
        ctx.moveTo(rounded, 0);
        ctx.lineTo(rounded, els.canvas.height);
      } else {
        ctx.moveTo(0, rounded);
        ctx.lineTo(els.canvas.width, rounded);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawGroupSelectionBounds() {
  const box = selectedDisplayBounds();
  if (!box) return;
  ctx.save();
  ctx.strokeStyle = "rgba(213, 162, 77, 0.72)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(
    Math.round(box.x) + 0.5,
    Math.round(box.y) + 0.5,
    Math.max(0, Math.round(box.width) - 1),
    Math.max(0, Math.round(box.height) - 1),
  );
  ctx.setLineDash([]);
  ctx.fillStyle = "#d5a24d";
  ctx.fillRect(box.x + box.width - 8, box.y + box.height - 8, 8, 8);
  ctx.restore();
}

function rgbaCss(values, fallback, alphaMultiplier = 1) {
  if (!Array.isArray(values) || values.length < 3) return applyFallbackAlpha(fallback, alphaMultiplier);
  const rgbScale = values.slice(0, 3).some((value) => Number(value) > 1) ? 255 : 1;
  const alphaValue = Number(values[3] ?? rgbScale);
  const alphaScale = alphaValue > 1 ? 255 : 1;
  const red = Math.round(clamp01(Number(values[0]) / rgbScale) * 255);
  const green = Math.round(clamp01(Number(values[1]) / rgbScale) * 255);
  const blue = Math.round(clamp01(Number(values[2]) / rgbScale) * 255);
  const alpha = clamp01((alphaValue / alphaScale) * Number(alphaMultiplier ?? 1));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function applyFallbackAlpha(fallback, alphaMultiplier = 1) {
  const alpha = clamp01(Number(alphaMultiplier ?? 1));
  if (alpha >= 0.999) return fallback;
  const text = String(fallback);
  const rgba = text.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgba) {
    return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${clamp01(Number(rgba[4]) * alpha)})`;
  }
  const rgb = text.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = Number.parseInt(hex[1], 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  return fallback;
}

function renderColorForNode(node) {
  return node.renderColor ?? node.color;
}

function renderAlphaForNode(node) {
  return Number(node.renderAlpha ?? node.alpha ?? 1);
}

function isEditorRootBackdrop(node) {
  if (node.depth !== 0 || !state.data?.viewport) return false;
  const box = node.box ?? {};
  return Math.abs((box.x ?? 0)) < 0.5
    && Math.abs((box.y ?? 0)) < 0.5
    && Math.abs((box.width ?? 0) - state.data.viewport.width) < 0.5
    && Math.abs((box.height ?? 0) - state.data.viewport.height) < 0.5;
}

function previewStateValue() {
  return els.previewState?.value || "normal";
}

function clamp01(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

function dragDisplayBox(node) {
  const drag = state.canvasDrag;
  if (!drag) return node.box;
  if (drag.mode === "resize-group" && drag.groupNodeIds?.includes(node.id)) {
    const originalNodeBox = drag.originalNodeBoxes?.[node.id] ?? node.box;
    return scaleBoxWithinBounds(originalNodeBox, drag.originalBox, drag.previewBox);
  }
  if (drag.mode === "move" && drag.groupNodeIds?.includes(node.id)) {
    const dx = drag.previewBox.x - drag.originalBox.x;
    const dy = drag.previewBox.y - drag.originalBox.y;
    return {
      ...node.box,
      x: node.box.x + dx,
      y: node.box.y + dy,
    };
  }
  return drag.nodeId === node.id ? drag.previewBox : node.box;
}

async function drawImageSlot(image, x, y, width, height, node = null) {
  let bitmap = null;
  if (image.url) {
    try {
      bitmap = await loadImage(image.url);
      logImageLoadSuccess("browser", image, bitmap, node);
    } catch (error) {
      logImageLoadFailure("browser", image, error, node);
      return false;
    }
  } else if (image.nativeTexture?.url) {
    try {
      bitmap = await loadNativeTexture(image.nativeTexture);
      logImageLoadSuccess("native", image, bitmap, node);
    } catch (error) {
      logImageLoadFailure("native", image, error, node);
      return false;
    }
  } else {
    logImageLoadFailure("unresolved", image, new Error("Image slot has no browser URL or native texture URL."), node);
    return false;
  }
  if (!bitmap) return false;
  const source = bitmap.source ?? bitmap;
  if (image.crop) {
    ctx.drawImage(source, image.crop.x, image.crop.y, image.crop.width, image.crop.height, x, y, width, height);
  } else {
    ctx.drawImage(source, x, y, width, height);
  }
  return true;
}

async function drawStyleRender(node, x, y, width, height) {
  const render = node.styleRender;
  const items = render?.items ?? [];
  if (!items.length || width <= 0 || height <= 0) return false;
  if (render.widgetType === "CheckBoxWidget") {
    return drawCheckboxStyle(node, x, y, width, height);
  }
  if (items.every((item) => /whitepixel/i.test(item.ref ?? ""))) return false;
  const nine = styleNineSlice(items);
  if (nine.center && Object.values(nine).some((item) => item && item !== nine.center)) {
    return drawNineSliceStyle(nine, node, x, y, width, height);
  }
  const center = findStyleItem(items, ["center", "background", "panel", "image", "body"]) ?? items[0];
  return drawImageSlot(center, x, y, width, height, node);
}

async function drawCheckboxStyle(node, x, y, width, height) {
  const items = node.styleRender?.items ?? [];
  const drawable = items.filter((item) => {
    const name = styleItemKey(item);
    return name.includes("checkbox") || name.includes("check") || name.includes("mark");
  });
  const targets = drawable.length ? drawable : items.slice(0, 1);
  let drawnAny = false;
  for (const item of targets) {
    const naturalWidth = item.crop?.width ?? Math.min(20, height);
    const naturalHeight = item.crop?.height ?? Math.min(20, height);
    const drawWidth = Math.min(width, naturalWidth);
    const drawHeight = Math.min(height, naturalHeight);
    const drawX = x;
    const drawY = y + ((height - drawHeight) / 2);
    drawnAny = await drawImageSlot(item, drawX, drawY, drawWidth, drawHeight, node) || drawnAny;
  }
  return drawnAny;
}

function checkboxTextInset(node) {
  if (node.styleRender?.widgetType !== "CheckBoxWidget") return 0;
  const item = findStyleItem(node.styleRender.items ?? [], ["checkbox", "checkboxnormal", "check"]);
  return item ? (item.crop?.width ?? 20) + 4 : 24;
}

function textCanvasAlign(halign) {
  if (halign === "center") return "center";
  if (halign === "right") return "right";
  return "left";
}

function textCanvasBaseline(valign) {
  if (valign === "top") return "top";
  if (valign === "bottom") return "bottom";
  return "middle";
}

function textCanvasX(node, x, width, inset) {
  const halign = node.textLayout?.halign;
  if (halign === "center") return x + (width / 2) + (inset / 2);
  if (halign === "right") return x + width - 6;
  return x + 6 + inset;
}

function textCanvasY(node, y, height) {
  const valign = node.textLayout?.valign;
  if (valign === "top") return y + 2;
  if (valign === "bottom") return y + height - 2;
  return y + (height / 2);
}

function styleNineSlice(items) {
  return {
    leftTop: findStyleItem(items, ["lefttop", "topleft"]),
    top: findStyleItem(items, ["top"]),
    rightTop: findStyleItem(items, ["righttop", "topright"]),
    left: findStyleItem(items, ["left"]),
    center: findStyleItem(items, ["center", "middle"]),
    right: findStyleItem(items, ["right"]),
    leftBottom: findStyleItem(items, ["leftbottom", "bottomleft"]),
    bottom: findStyleItem(items, ["bottom"]),
    rightBottom: findStyleItem(items, ["rightbottom", "bottomright"]),
  };
}

async function drawNineSliceStyle(nine, node, x, y, width, height) {
  const leftWidth = Math.min(
    Math.max(naturalWidth(nine.left, naturalWidth(nine.leftTop, 0)), 0),
    width / 2,
  );
  const rightWidth = Math.min(
    Math.max(naturalWidth(nine.right, naturalWidth(nine.rightTop, 0)), 0),
    width / 2,
  );
  const topHeight = Math.min(
    Math.max(naturalHeight(nine.top, naturalHeight(nine.leftTop, 0)), 0),
    height / 2,
  );
  const bottomHeight = Math.min(
    Math.max(naturalHeight(nine.bottom, naturalHeight(nine.leftBottom, 0)), 0),
    height / 2,
  );
  const middleWidth = Math.max(0, width - leftWidth - rightWidth);
  const middleHeight = Math.max(0, height - topHeight - bottomHeight);
  const jobs = [
    [nine.leftTop, x, y, leftWidth, topHeight],
    [nine.top, x + leftWidth, y, middleWidth, topHeight],
    [nine.rightTop, x + leftWidth + middleWidth, y, rightWidth, topHeight],
    [nine.left, x, y + topHeight, leftWidth, middleHeight],
    [nine.center, x + leftWidth, y + topHeight, middleWidth, middleHeight],
    [nine.right, x + leftWidth + middleWidth, y + topHeight, rightWidth, middleHeight],
    [nine.leftBottom, x, y + topHeight + middleHeight, leftWidth, bottomHeight],
    [nine.bottom, x + leftWidth, y + topHeight + middleHeight, middleWidth, bottomHeight],
    [nine.rightBottom, x + leftWidth + middleWidth, y + topHeight + middleHeight, rightWidth, bottomHeight],
  ];
  let drawnAny = false;
  for (const [item, dx, dy, dw, dh] of jobs) {
    if (!item || dw <= 0 || dh <= 0) continue;
    drawnAny = await drawImageSlot(item, dx, dy, dw, dh, node) || drawnAny;
  }
  return drawnAny;
}

function findStyleItem(items, names) {
  const wanted = new Set(names.map((name) => String(name).toLowerCase()));
  return items.find((item) => wanted.has(styleItemKey(item))) ?? null;
}

function styleItemKey(item) {
  return String(item?.itemName ?? item?.imageName ?? item?.ref ?? "")
    .trim()
    .toLowerCase()
    .replace(/^.*\bimage:/, "")
    .replace(/[^a-z0-9]/g, "");
}

function naturalWidth(item, fallback = 0) {
  return Number(item?.crop?.width ?? fallback);
}

function naturalHeight(item, fallback = 0) {
  return Number(item?.crop?.height ?? fallback);
}

function renderOrderedNodes(nodes) {
  const childrenByParent = new Map();
  for (const [index, node] of nodes.entries()) {
    const parentId = node.parentId ?? null;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push({ node, index });
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => {
      const priority = Number(a.node.priority ?? 0) - Number(b.node.priority ?? 0);
      return priority || a.index - b.index;
    });
  }

  const ordered = [];
  const append = (parentId) => {
    for (const entry of childrenByParent.get(parentId) ?? []) {
      ordered.push(entry.node);
      append(entry.node.id);
    }
  };
  append(null);
  return ordered;
}

function drawImagePlaceholder(image, x, y, width, height) {
  ctx.fillStyle = "rgba(213, 162, 77, 0.18)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(213, 162, 77, 0.72)";
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  ctx.setLineDash([]);
  ctx.fillStyle = "#f0d094";
  ctx.font = "12px Segoe UI, Arial";
  ctx.textBaseline = "top";
  ctx.fillText(imagePlaceholderText(image), x + 6, y + 6, Math.max(1, width - 12));
}

function loadImage(url) {
  if (state.imageCache.has(url)) return state.imageCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
  state.imageCache.set(url, promise);
  return promise;
}

function loadNativeTexture(texture) {
  const key = `native:${texture.url}`;
  if (state.imageCache.has(key)) return state.imageCache.get(key);
  const promise = loadNativeTextureBitmap(texture);
  state.imageCache.set(key, promise);
  return promise;
}

function imagePlaceholderText(image) {
  if (image.nativeTexture) {
    const format = image.nativeTexture.format || String(image.nativeTexture.ext || "texture").replace(/^\./, "");
    return `${format.toUpperCase()} native decoder pending`;
  }
  return "image missing";
}

function selectedNode() {
  return state.data?.nodes.find((node) => node.id === state.selectedId) ?? null;
}

function selectedNodes() {
  const ids = state.selectedIds.size
    ? state.selectedIds
    : new Set(state.selectedId ? [state.selectedId] : []);
  return (state.data?.nodes ?? []).filter((node) => ids.has(node.id));
}

function selectedDisplayBounds() {
  const nodes = selectedNodes();
  if (nodes.length < 2) return null;
  return boxesBounds(nodes.map((node) => dragDisplayBox(node)));
}

function selectSingleNode(nodeId) {
  state.selectedId = nodeId;
  state.selectedIds = new Set(nodeId ? [nodeId] : []);
  renderAll();
}

function selectNodeById(nodeId, event = {}) {
  if (!nodeId) return;
  if (event.shiftKey && state.data && state.selectedId) {
    const nodes = state.data.nodes;
    const from = nodes.findIndex((node) => node.id === state.selectedId);
    const to = nodes.findIndex((node) => node.id === nodeId);
    if (from >= 0 && to >= 0) {
      const [start, end] = from < to ? [from, to] : [to, from];
      state.selectedIds = new Set(nodes.slice(start, end + 1).map((node) => node.id));
      state.selectedId = nodeId;
      renderAll();
      return;
    }
  }

  if (event.ctrlKey || event.metaKey) {
    const next = new Set(state.selectedIds.size ? state.selectedIds : [state.selectedId].filter(Boolean));
    if (next.has(nodeId) && next.size > 1) {
      next.delete(nodeId);
      state.selectedId = [...next][next.size - 1] ?? null;
    } else {
      next.add(nodeId);
      state.selectedId = nodeId;
    }
    state.selectedIds = next;
    renderAll();
    return;
  }

  selectSingleNode(nodeId);
}

function syncSelectionAfterPreview(primaryId = state.selectedId, desiredIds = [...state.selectedIds]) {
  const available = new Set((state.data?.nodes ?? []).map((node) => node.id));
  const nextIds = desiredIds.filter((id) => available.has(id));
  const nextPrimary = available.has(primaryId)
    ? primaryId
    : nextIds[0] ?? state.data?.nodes[0]?.id ?? null;
  state.selectedId = nextPrimary;
  state.selectedIds = new Set(nextIds.length ? nextIds : nextPrimary ? [nextPrimary] : []);
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  const scaleX = els.canvas.width / rect.width;
  const scaleY = els.canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function dragModeForPoint(node, x, y) {
  return isResizeHandleHit(node.box, x, y) ? "resize" : "move";
}

function updateCanvasDragPreview(x, y, options = {}) {
  const drag = state.canvasDrag;
  const dx = x - drag.start.x;
  const dy = y - drag.start.y;
  let previewBox;
  if (drag.mode === "resize" || drag.mode === "resize-group") {
    const width = Math.max(4, drag.originalBox.width + dx);
    const height = Math.max(4, drag.originalBox.height + dy);
    previewBox = {
      ...drag.originalBox,
      width,
      height,
    };
  } else {
    const nextX = drag.originalBox.x + dx;
    const nextY = drag.originalBox.y + dy;
    previewBox = {
      ...drag.originalBox,
      x: nextX,
      y: nextY,
    };
  }
  const snapped = options.snap ? snapPreviewBox(previewBox, drag) : { box: previewBox, guides: [] };
  drag.previewBox = snapped.box;
  drag.activeGuides = snapped.guides;
}

function shouldSnap(event = {}) {
  return state.snapToGrid && !event.altKey;
}

function readGridSize() {
  const value = Number(els.gridSize.value || state.gridSize || 8);
  const size = Number.isFinite(value) && value >= 1 ? Math.round(value) : 8;
  state.gridSize = size;
  if (String(els.gridSize.value) !== String(size)) els.gridSize.value = String(size);
  return size;
}

function snapValue(value) {
  const step = readGridSize();
  return Math.round(Number(value) / step) * step;
}

function snapPreviewBox(box, drag) {
  const guideSnap = snapBoxToGuides(box, drag);
  const gridSnap = snapBoxToGrid(guideSnap.box, drag, {
    skipX: guideSnap.snappedX,
    skipY: guideSnap.snappedY,
  });
  return {
    box: gridSnap,
    guides: guideSnap.guides,
  };
}

function snapBoxToGrid(box, drag, options = {}) {
  const next = { ...box };
  if (drag.mode === "resize" || drag.mode === "resize-group") {
    if (!options.skipX) {
      const right = snapValue(next.x + next.width);
      next.width = Math.max(4, right - next.x);
    }
    if (!options.skipY) {
      const bottom = snapValue(next.y + next.height);
      next.height = Math.max(4, bottom - next.y);
    }
    return next;
  }
  if (!options.skipX) next.x = snapValue(next.x);
  if (!options.skipY) next.y = snapValue(next.y);
  return next;
}

function snapBoxToGuides(box, drag) {
  const targets = guideTargetsForDrag(drag);
  const threshold = smartGuideThreshold();
  const guides = [];
  const next = { ...box };
  if (drag.mode === "resize" || drag.mode === "resize-group") {
    const xSnap = bestResizeGuideSnap(next, targets, "x", threshold);
    const ySnap = bestResizeGuideSnap(next, targets, "y", threshold);
    if (xSnap) {
      next.width = xSnap.size;
      guides.push(xSnap.guide);
    }
    if (ySnap) {
      next.height = ySnap.size;
      guides.push(ySnap.guide);
    }
    return { box: next, guides, snappedX: Boolean(xSnap), snappedY: Boolean(ySnap) };
  }

  const xSnap = bestMoveGuideSnap(next, targets, "x", threshold);
  const ySnap = bestMoveGuideSnap(next, targets, "y", threshold);
  if (xSnap) {
    next.x += xSnap.delta;
    guides.push(xSnap.guide);
  }
  if (ySnap) {
    next.y += ySnap.delta;
    guides.push(ySnap.guide);
  }
  return { box: next, guides, snappedX: Boolean(xSnap), snappedY: Boolean(ySnap) };
}

function bestMoveGuideSnap(box, targets, axis, threshold) {
  const anchors = axis === "x"
    ? [box.x, box.x + (box.width / 2), box.x + box.width]
    : [box.y, box.y + (box.height / 2), box.y + box.height];
  let best = null;
  for (const anchor of anchors) {
    for (const target of targets) {
      if (target.axis !== axis) continue;
      const delta = target.value - anchor;
      const distance = Math.abs(delta);
      if (distance > threshold) continue;
      if (!best || distance < best.distance) {
        best = { distance, delta, guide: target };
      }
    }
  }
  return best;
}

function bestResizeGuideSnap(box, targets, axis, threshold) {
  const isX = axis === "x";
  const start = isX ? box.x : box.y;
  const size = isX ? box.width : box.height;
  const anchors = [
    {
      value: start + size,
      sizeForTarget: (target) => target - start,
    },
    {
      value: start + (size / 2),
      sizeForTarget: (target) => (target - start) * 2,
    },
  ];
  let best = null;
  for (const anchor of anchors) {
    for (const target of targets) {
      if (target.axis !== axis) continue;
      const distance = Math.abs(target.value - anchor.value);
      const nextSize = anchor.sizeForTarget(target.value);
      if (distance > threshold || nextSize < 4) continue;
      if (!best || distance < best.distance) {
        best = { distance, size: nextSize, guide: target };
      }
    }
  }
  return best;
}

function guideTargetsForDrag(drag) {
  const targets = [];
  const draggedIds = new Set(drag.groupNodeIds?.length ? drag.groupNodeIds : [drag.nodeId].filter(Boolean));
  const draggedNodes = (state.data?.nodes ?? []).filter((node) => draggedIds.has(node.id));
  const commonParentId = commonNodeParentId(draggedNodes);
  const parentBox = commonParentBox(draggedNodes);
  if (parentBox) addGuideTargetBox(targets, parentBox, "parent");

  for (const node of state.data?.nodes ?? []) {
    if (draggedIds.has(node.id)) continue;
    if (commonParentId !== null && (node.parentId ?? null) !== commonParentId) continue;
    addGuideTargetBox(targets, node.box, "sibling");
  }
  return targets;
}

function addGuideTargetBox(targets, box, source) {
  if (!box || box.width <= 0 || box.height <= 0) return;
  targets.push(
    { axis: "x", value: box.x, source, edge: "left" },
    { axis: "x", value: box.x + (box.width / 2), source, edge: "center" },
    { axis: "x", value: box.x + box.width, source, edge: "right" },
    { axis: "y", value: box.y, source, edge: "top" },
    { axis: "y", value: box.y + (box.height / 2), source, edge: "center" },
    { axis: "y", value: box.y + box.height, source, edge: "bottom" },
  );
}

function commonNodeParentId(nodes) {
  if (!nodes.length) return null;
  const parentId = nodes[0].parentId ?? null;
  return nodes.every((node) => (node.parentId ?? null) === parentId) ? parentId : null;
}

function commonParentBox(nodes) {
  if (!nodes.length) return viewportBox();
  const parentId = commonNodeParentId(nodes);
  if (parentId === null && nodes.some((node) => (node.parentId ?? null) !== null)) return viewportBox();
  return nodes[0].parentBox ?? viewportBox();
}

function viewportBox() {
  return {
    x: 0,
    y: 0,
    width: state.data?.viewport?.width ?? els.canvas.width,
    height: state.data?.viewport?.height ?? els.canvas.height,
  };
}

function smartGuideThreshold() {
  return Math.max(4, Math.min(8, readGridSize()));
}

function keyboardNudgeStep(event) {
  if (event.shiftKey) return 10;
  if (state.snapToGrid) return readGridSize();
  return 1;
}

async function handleKeyboardNudge(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  if (isTypingTarget(event.target) || state.sourceEditing || !state.data || !selectedNodes().length) return;
  event.preventDefault();
  const step = keyboardNudgeStep(event);
  const delta = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[event.key];
  await applyLayoutTransform("translate", { delta });
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

function isResizeHandleHit(box, x, y) {
  const handle = Math.max(8, Math.min(18, Math.min(box.width, box.height) * 0.25));
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  return x >= right - handle && x <= right + handle
    && y >= bottom - handle && y <= bottom + handle;
}

function boxesBounds(boxes) {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function scaleBoxWithinBounds(box, sourceBounds, targetBounds) {
  const scaleX = sourceBounds.width > 0 ? targetBounds.width / sourceBounds.width : 1;
  const scaleY = sourceBounds.height > 0 ? targetBounds.height / sourceBounds.height : 1;
  return {
    ...box,
    x: targetBounds.x + ((box.x - sourceBounds.x) * scaleX),
    y: targetBounds.y + ((box.y - sourceBounds.y) * scaleY),
    width: Math.max(4, box.width * scaleX),
    height: Math.max(4, box.height * scaleY),
  };
}

async function finishCanvasDrag() {
  const drag = state.canvasDrag;
  state.canvasDrag = null;
  const node = state.data?.nodes.find((candidate) => candidate.id === drag.nodeId);
  if (!node) return;

  const moved = Math.abs(drag.previewBox.x - drag.originalBox.x) > 0.5
    || Math.abs(drag.previewBox.y - drag.originalBox.y) > 0.5;
  const resized = Math.abs(drag.previewBox.width - drag.originalBox.width) > 0.5
    || Math.abs(drag.previewBox.height - drag.originalBox.height) > 0.5;
  if (!moved && !resized) {
    draw();
    return;
  }

  if (moved && drag.mode === "move" && (drag.groupNodeIds?.length ?? 0) > 1) {
    await applyLayoutTransform("translate", {
      delta: [
        drag.previewBox.x - drag.originalBox.x,
        drag.previewBox.y - drag.originalBox.y,
      ],
    });
    return;
  }

  if (resized && drag.mode === "resize-group" && (drag.groupNodeIds?.length ?? 0) > 1) {
    await applyLayoutTransform("resize-group", {
      targetBounds: drag.previewBox,
    });
    return;
  }

  const boxValues = boxToLayoutValues(node, drag.previewBox);
  await saveWidgetBox(node, {
    position: moved ? boxValues.position : null,
    size: resized ? boxValues.size : null,
  });
}

function boxToLayoutValues(node, box) {
  const parent = node.parentBox ?? { x: 0, y: 0, width: state.data.viewport.width, height: state.data.viewport.height };
  const widthValue = node.box.exact?.sizeX ? box.width : box.width / parent.width;
  const heightValue = node.box.exact?.sizeY ? box.height : box.height / parent.height;
  const offsetX = inverseAlignOffset({
    start: box.x,
    size: box.width,
    parentStart: parent.x,
    parentSize: parent.width,
    align: node.box.align?.horizontal ?? "left",
  });
  const offsetY = inverseAlignOffset({
    start: box.y,
    size: box.height,
    parentStart: parent.y,
    parentSize: parent.height,
    align: node.box.align?.vertical ?? "top",
  });
  return {
    position: [
      formatLayoutNumber(node.box.exact?.positionX ? offsetX : offsetX / parent.width),
      formatLayoutNumber(node.box.exact?.positionY ? offsetY : offsetY / parent.height),
    ],
    size: [
      formatLayoutNumber(widthValue),
      formatLayoutNumber(heightValue),
    ],
  };
}

function inverseAlignOffset({ start, size, parentStart, parentSize, align }) {
  if (align === "center") return start - (parentStart + ((parentSize - size) / 2));
  if (align === "right" || align === "bottom") return parentStart + parentSize - size - start;
  return start - parentStart;
}

function formatLayoutNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(6));
}

async function saveWidgetBox(node, { position, size, props = null }) {
  setStatus("Saving box");
  const response = await fetch("/api/layout/box", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: state.data.filePath,
      widgetId: node.id,
      position,
      size,
      props,
      project: els.projectRoot.value.trim() || null,
      width: state.data.viewport.width,
      height: state.data.viewport.height,
      language: els.previewLanguage.value || "English",
      previewState: previewStateValue(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    showPanelDiagnostic("box save failed", payload.error || "Unknown error");
    setStatus("Box save failed");
    draw();
    return;
  }
  state.data = payload.preview;
  syncSelectionAfterPreview(node.id);
  await refreshSourceState();
  setStatus("Box saved");
  renderAll();
}

function contains(box, x, y) {
  return x >= box.x && y >= box.y && x <= box.x + box.width && y <= box.y + box.height;
}

function setStatus(value) {
  els.status.textContent = value;
}

function renderError(message) {
  els.title.textContent = "Unable to open layout";
  els.tree.innerHTML = '<p class="empty">No layout loaded.</p>';
  els.details.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
  els.typedProperties.innerHTML = "";
  els.images.innerHTML = "";
  els.diagnostics.innerHTML = "";
  renderSourceControls();
  renderLayoutDiagnostics();
  renderLayoutModel();
  renderLayoutConsole();
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
}

function row(label, value) {
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "")}</dd>`;
}

function formatBox(box) {
  return [box.x, box.y, box.width, box.height].map((value) => Number(value).toFixed(1)).join(", ");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function truncateText(value, limit) {
  const text = String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n... truncated ${text.length - limit} chars`;
}
