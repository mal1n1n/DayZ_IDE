import path from "node:path";
import { pathToFileURL } from "node:url";

const browserImageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const nativeTextureExtensions = new Set([".edds", ".dds", ".paa", ".tga"]);

export function renderPreviewHtml(model, options = {}) {
  const title = options.title ?? path.basename(model.filePath ?? "layout-preview");
  const data = buildPreviewData(model, options);
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - DZUI Preview</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #151817;
      --panel: #1f2423;
      --panel-2: #252b2a;
      --line: #3c4543;
      --text: #edf4f1;
      --muted: #9dafaa;
      --accent: #64c8a6;
      --warn: #d5a24d;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      overflow: hidden;
    }
    .app {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr minmax(260px, 340px);
      height: 100vh;
      min-width: 860px;
    }
    aside {
      background: var(--panel);
      border-color: var(--line);
      overflow: auto;
    }
    aside:first-child { border-right: 1px solid var(--line); }
    aside:last-child { border-left: 1px solid var(--line); }
    header {
      height: 44px;
      display: flex;
      align-items: center;
      padding: 0 14px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      color: var(--muted);
      gap: 8px;
      white-space: nowrap;
    }
    main {
      display: grid;
      grid-template-rows: 44px 1fr;
      min-width: 0;
    }
    .stageHeader {
      background: #191d1c;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      color: var(--muted);
      font-size: 13px;
    }
    .stage {
      display: block;
      overflow: auto;
      padding: 0;
      background: #8b8b8b;
    }
    canvas {
      display: block;
      background: #8b8b8b;
      image-rendering: auto;
      max-width: none;
      max-height: none;
    }
    .tree, .details, .diagnostics {
      padding: 10px;
      font-size: 12px;
    }
    .treeItem {
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 6px 8px;
      margin: 2px 0;
      cursor: pointer;
      color: var(--text);
    }
    .treeItem:hover, .treeItem.active {
      border-color: #52605c;
      background: var(--panel-2);
    }
    .treeItem .type {
      display: block;
      color: var(--muted);
      font-size: 11px;
      margin-top: 2px;
    }
    dl {
      display: grid;
      grid-template-columns: 82px 1fr;
      gap: 7px 10px;
      margin: 0;
    }
    dt { color: var(--muted); }
    dd { margin: 0; word-break: break-word; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 2px 7px;
      border-radius: 5px;
      background: #29302f;
      color: var(--muted);
      font-size: 12px;
    }
    select {
      height: 26px;
      border: 1px solid var(--line);
      border-radius: 5px;
      background: #151918;
      color: var(--text);
      padding: 0 7px;
    }
    .diag {
      border-top: 1px solid var(--line);
      padding: 9px 0;
      color: var(--muted);
    }
    .diag strong { color: var(--warn); font-weight: 600; }
    .empty { color: var(--muted); }
  </style>
</head>
<body>
  <div class="app">
    <aside>
      <header>Layout Tree</header>
      <div class="tree" id="tree"></div>
    </aside>
    <main>
      <div class="stageHeader">
        <span id="title"></span>
        <span>
          <select id="previewState" aria-label="Preview state">
            <option value="normal">normal</option>
            <option value="hover">hover</option>
            <option value="selected">selected</option>
            <option value="disabled">disabled</option>
          </select>
          <span class="pill" id="size"></span>
        </span>
      </div>
      <div class="stage">
        <canvas id="canvas"></canvas>
      </div>
    </main>
    <aside>
      <header>Inspector</header>
      <div class="details" id="details"></div>
      <header>Diagnostics</header>
      <div class="diagnostics" id="diagnostics"></div>
    </aside>
  </div>
  <script type="application/json" id="preview-data">${json}</script>
  <script>
    const data = JSON.parse(document.getElementById("preview-data").textContent);
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const imageCache = new Map();
    let selectedId = data.nodes[0]?.id ?? null;
    let previewState = data.previewState || "normal";

    canvas.width = data.viewport.width;
    canvas.height = data.viewport.height;
    document.getElementById("title").textContent = data.title;
    document.getElementById("size").textContent = data.viewport.width + "x" + data.viewport.height;
    document.getElementById("previewState").value = previewState;
    document.getElementById("previewState").addEventListener("change", (event) => {
      previewState = event.target.value;
      draw();
    });

    renderTree();
    renderDiagnostics();
    renderDetails();
    draw();

    function renderTree() {
      const tree = document.getElementById("tree");
      tree.innerHTML = "";
      for (const node of data.nodes) {
        const item = document.createElement("div");
        item.className = "treeItem" + (node.id === selectedId ? " active" : "");
        item.style.marginLeft = (node.depth * 12) + "px";
        item.dataset.id = node.id;
        item.innerHTML = escapeHtml(node.name) + '<span class="type">' + escapeHtml(node.typeClass) + '</span>';
        item.addEventListener("click", () => {
          selectedId = node.id;
          renderTree();
          renderDetails();
          draw();
        });
        tree.appendChild(item);
      }
    }

    function renderDetails() {
      const details = document.getElementById("details");
      const node = data.nodes.find((candidate) => candidate.id === selectedId);
      if (!node) {
        details.innerHTML = '<p class="empty">No widget selected.</p>';
        return;
      }
      details.innerHTML = '<dl>'
        + row("Name", node.name)
        + row("Type", node.typeClass)
        + row("Line", String(node.source.line))
        + row("Box", fmtBox(node.box))
        + row("Text", node.text || "")
        + row("Style", node.style || "")
        + row("Images", node.images.map((image) => image.ref).join("\\n"))
        + '</dl>';
    }

    function renderDiagnostics() {
      const box = document.getElementById("diagnostics");
      if (!data.diagnostics.length) {
        box.innerHTML = '<p class="empty">No diagnostics.</p>';
        return;
      }
      box.innerHTML = data.diagnostics.map((diagnostic) => {
        return '<div class="diag"><strong>' + escapeHtml(diagnostic.code || diagnostic.type || "diagnostic")
          + '</strong><br>' + escapeHtml(diagnostic.message || diagnostic.ref || "")
          + (diagnostic.line ? '<br>line ' + diagnostic.line : "")
          + '</div>';
      }).join("");
    }

    async function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#8b8b8b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const node of renderOrderedNodes(data.nodes)) {
        if (!node.visible) continue;
        await drawNode(node);
      }
    }

    async function drawNode(node) {
      const { x, y, width, height } = node.box;
      const selected = node.id === selectedId;
      const isImage = node.typeClass.toLowerCase().includes("image");
      const isText = node.typeClass.toLowerCase().includes("text");

      if (node.images.length) {
        for (const image of node.images) {
          const drawn = await drawImageSlot(image, x, y, width, height);
          if (drawn) continue;
          drawImagePlaceholder(image, x, y, width, height);
        }
      } else if (!isText && Array.isArray(colorForState(node))) {
        ctx.fillStyle = rgbaCss(colorForState(node), "rgba(16, 22, 21, 0)", alphaForState(node));
        ctx.fillRect(x, y, width, height);
      }

      if (node.text) {
        ctx.fillStyle = rgbaCss(colorForState(node), "#edf4f1", alphaForState(node));
        ctx.font = Math.max(12, Math.min(24, height * 0.45)) + "px Segoe UI, Arial";
        ctx.textBaseline = "middle";
        ctx.fillText(node.text, x + 6, y + (height / 2), Math.max(1, width - 12));
      }

      ctx.strokeStyle = selected ? rgbaCss(node.stateColors?.selected, "#64c8a6", 1) : "rgba(237, 244, 241, 0.24)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
    }

    function colorForState(node) {
      if (previewState === "normal") return node.color;
      return node.stateColors?.[previewState] ?? node.color;
    }

    function alphaForState(node) {
      if (previewState === "disabled" && !node.stateColors?.disabled) return Number(node.alpha ?? 1) * 0.45;
      return Number(node.alpha ?? 1);
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
      return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
    }

    function applyFallbackAlpha(fallback, alphaMultiplier = 1) {
      const alpha = clamp01(Number(alphaMultiplier ?? 1));
      if (alpha >= 0.999) return fallback;
      const text = String(fallback);
      const rgba = text.match(/^rgba\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\)$/i);
      if (rgba) {
        return "rgba(" + rgba[1] + ", " + rgba[2] + ", " + rgba[3] + ", " + clamp01(Number(rgba[4]) * alpha) + ")";
      }
      const rgb = text.match(/^rgb\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\)$/i);
      if (rgb) {
        return "rgba(" + rgb[1] + ", " + rgb[2] + ", " + rgb[3] + ", " + alpha + ")";
      }
      const hex = text.match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        const value = Number.parseInt(hex[1], 16);
        return "rgba(" + ((value >> 16) & 255) + ", " + ((value >> 8) & 255) + ", " + (value & 255) + ", " + alpha + ")";
      }
      return fallback;
    }

    function clamp01(value) {
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
    }

    async function drawImageSlot(image, x, y, width, height) {
      if (!image.url) return false;
      const bitmap = await loadImage(image.url).catch(() => null);
      if (!bitmap) return false;
      if (image.crop) {
        ctx.drawImage(bitmap, image.crop.x, image.crop.y, image.crop.width, image.crop.height, x, y, width, height);
      } else {
        ctx.drawImage(bitmap, x, y, width, height);
      }
      return true;
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
      ctx.fillText(image.nativeTexture ? "native texture unavailable" : "image missing", x + 6, y + 6, Math.max(1, width - 12));
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

    function loadImage(url) {
      if (imageCache.has(url)) return imageCache.get(url);
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      imageCache.set(url, promise);
      return promise;
    }

    function row(label, value) {
      return '<dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value || "") + '</dd>';
    }

    function fmtBox(box) {
      return [box.x, box.y, box.width, box.height].map((value) => Number(value).toFixed(1)).join(", ");
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    }
  </script>
</body>
</html>`;
}

export function buildPreviewData(model, options = {}) {
  return {
    title: options.title ?? path.basename(model.filePath ?? "layout-preview"),
    filePath: model.filePath,
    viewport: model.viewport,
    previewState: model.previewState ?? "normal",
    nodes: model.nodes.map((node) => ({
      ...node,
      images: node.images.map((image) => serializeImageSlot(image)),
      styleRender: serializeStyleRender(node.styleRender),
    })),
    diagnostics: collectPreviewDiagnostics(model),
  };
}

function serializeStyleRender(styleRender) {
  if (!styleRender) return null;
  return {
    ...styleRender,
    items: (styleRender.items ?? []).map((item) => ({
      ...serializeImageSlot(item),
      source: item.source ?? "style",
      stateName: item.stateName ?? null,
      itemName: item.itemName ?? null,
    })),
  };
}

function serializeImageSlot(image) {
  const resolved = image.resolved;
  const descriptor = {
    slot: image.slot,
    ref: image.ref,
    line: image.line,
    ok: resolved?.ok ?? false,
    mode: resolved?.mode ?? "unresolved",
    url: null,
    crop: null,
    nativeTexture: null,
    filePath: null,
    virtualPath: resolved?.virtualPath ?? resolved?.texture?.virtualPath ?? null,
  };

  if (resolved?.kind === "set-image") {
    descriptor.crop = resolved.image?.pos && resolved.image?.size ? {
      x: resolved.image.pos[0],
      y: resolved.image.pos[1],
      width: resolved.image.size[0],
      height: resolved.image.size[1],
    } : null;
    applyAssetUrl(descriptor, resolved.texture?.filePath);
    return descriptor;
  }

  applyAssetUrl(descriptor, resolved?.filePath);
  return descriptor;
}

function applyAssetUrl(descriptor, filePath) {
  if (!filePath) return;

  const ext = path.extname(filePath).toLowerCase();
  descriptor.filePath = filePath;
  descriptor.virtualPath = descriptor.virtualPath ?? filePath;
  if (browserImageExtensions.has(ext)) {
    descriptor.url = pathToFileURL(filePath).href;
    return;
  }

  if (nativeTextureExtensions.has(ext)) {
    descriptor.nativeTexture = {
      kind: "source-texture",
      filePath,
      ext,
      format: ext.replace(/^\./, ""),
      url: null,
    };
  }
}

function collectPreviewDiagnostics(model) {
  const diagnostics = [...model.diagnostics];
  for (const node of model.nodes) {
    for (const image of [...node.images, ...(node.styleRender?.items ?? [])]) {
      if (image.resolved?.ok && (image.resolved.filePath || image.resolved.texture?.filePath)) continue;
      diagnostics.push({
        type: "preview-image-unresolved",
        ref: image.ref,
        line: image.line,
        widget: node.name,
        mode: image.resolved?.mode ?? "unresolved",
      });
    }
  }
  return diagnostics;
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
