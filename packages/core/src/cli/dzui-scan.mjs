#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import {
  buildProjectAssetIndex,
  collectImageReferenceDiagnostics,
  collectImageSetTextureDiagnostics,
  parseLayout,
  relativeVirtual,
  walkWidgets,
} from "../index.mjs";

const rootArg = process.argv[2];

if (!rootArg) {
  console.error("Usage: node packages/core/src/cli/dzui-scan.mjs <ClientMods root>");
  process.exit(2);
}

const root = path.resolve(rootArg);

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`Project root does not exist or is not a directory: ${root}`);
  process.exit(2);
}

function parseLayoutImageRefs(content, filePath) {
  const document = parseLayout(content, { filePath });
  const refs = [];

  for (const { node } of walkWidgets(document)) {
    for (const prop of node.props) {
      const imageMatch = prop.key.match(/^image(\d*)$/i);
      if (!imageMatch || prop.values.length === 0) continue;

      refs.push({
        kind: "layout-image",
        filePath,
        virtualPath: relativeVirtual(root, filePath),
        line: prop.line,
        slot: imageMatch[1] === "" ? 0 : Number(imageMatch[1]),
        ref: prop.values.map((value) => value.value).join(" "),
        widget: node.name,
        widgetType: node.typeClass,
      });
    }
  }

  return {
    refs,
    diagnostics: document.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      file: relativeVirtual(root, filePath),
    })),
  };
}

const projectIndex = buildProjectAssetIndex(root);
const interestingFiles = projectIndex.files;
const edds = projectIndex.edds;
const imageSets = projectIndex.imageSets;
const imageRefs = [];
const layoutDiagnostics = [];
const seenImageRefs = new Set();

for (const filePath of interestingFiles) {
  const lowerFilePath = filePath.toLowerCase();
  if (lowerFilePath.endsWith(".layout")) {
    const parsed = parseLayoutImageRefs(fs.readFileSync(filePath, "utf8"), filePath);
    imageRefs.push(...parsed.refs);
    layoutDiagnostics.push(...parsed.diagnostics);
  }
}

for (const ref of [...projectIndex.scripts.refs.loadImages, ...projectIndex.scripts.refs.assetStrings]) {
  if (!/\.(?:edds|paa|png|tga)$/i.test(ref.ref) && !ref.ref.startsWith("set:")) continue;
  const key = `${ref.virtualPath}:${ref.line}:${ref.ref.toLowerCase()}`;
  if (seenImageRefs.has(key)) continue;
  seenImageRefs.add(key);
  imageRefs.push({
    kind: "script-image",
    filePath: ref.filePath,
    virtualPath: ref.virtualPath,
    line: ref.line,
    ref: ref.ref,
  });
}

const setDiagnostics = collectImageSetTextureDiagnostics(projectIndex);
const { diagnostics: assetDiagnostics, externalRefs } = collectImageReferenceDiagnostics(imageRefs, projectIndex);

const eddsReadable = edds.filter((entry) => entry.readable).length;
const largestEdds = [...edds]
  .filter((entry) => entry.readable)
  .sort((a, b) => (b.width * b.height) - (a.width * a.height))
  .slice(0, 8)
  .map((entry) => ({
    path: entry.virtualPath,
    width: entry.width,
    height: entry.height,
    format: entry.format,
  }));

const report = {
  root,
  counts: projectIndex.counts,
  edds: {
    total: edds.length,
    ddsHeaderReadable: eddsReadable,
    unreadable: edds.length - eddsReadable,
    largest: largestEdds,
  },
  imageSets: {
    total: imageSets.length,
    names: imageSets.map((set) => ({
      name: set.name,
      path: set.virtualPath,
      images: set.images.length,
      textures: set.textureRefs.length,
    })),
  },
  styles: {
    files: projectIndex.styles.files.length,
    total: projectIndex.styles.byName.size,
    names: [...projectIndex.styles.byName.values()].slice(0, 40).map((style) => ({
      name: style.name,
      path: style.virtualPath,
      line: style.line,
    })),
  },
  fonts: {
    total: projectIndex.fonts.fonts.length,
    knownCoverage: projectIndex.fonts.fonts.filter((font) => font.coverage?.known).length,
    names: projectIndex.fonts.fonts.slice(0, 40).map((font) => ({
      path: font.virtualPath,
      glyphs: font.coverage?.known ? font.coverage.glyphCount : null,
    })),
  },
  stringTable: {
    files: projectIndex.stringTable.tables.length,
    entries: projectIndex.stringTable.tables.reduce((count, table) => count + table.entries.length, 0),
    diagnostics: projectIndex.stringTable.diagnostics,
  },
  scripts: {
    total: projectIndex.scripts.scripts.length,
    createWidgets: projectIndex.scripts.refs.createWidgets.length,
    findWidgets: projectIndex.scripts.refs.findWidgets.length,
    setText: projectIndex.scripts.refs.setText.length,
    loadImages: projectIndex.scripts.refs.loadImages.length,
    assetStrings: projectIndex.scripts.refs.assetStrings.length,
  },
  imageRefs: {
    total: imageRefs.length,
    diagnostics: assetDiagnostics.slice(0, 100),
    diagnosticCount: assetDiagnostics.length,
    externalRefCount: externalRefs.length,
    externalRefs: externalRefs.slice(0, 40),
  },
  diagnostics: {
    layoutDiagnosticCount: layoutDiagnostics.length,
    layoutDiagnostics: layoutDiagnostics.slice(0, 100),
    imageSetTextureDiagnostics: setDiagnostics,
  },
};

console.log(JSON.stringify(report, null, 2));
