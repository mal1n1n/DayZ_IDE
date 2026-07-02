import fs from "node:fs";
import path from "node:path";

import { buildFontRegistry } from "../fonts/registry.mjs";
import { parseImageSet, parseSetImageRef } from "../imageset/parser.mjs";
import { buildStringTableIndex } from "../localization/stringtable.mjs";
import { countByExtension, findInterestingFiles } from "../project/files.mjs";
import { normalizeSlashes, normalizeVirtualRef, relativeVirtual } from "../project/path-utils.mjs";
import { buildScriptIndex } from "../scripts/scanner.mjs";
import { buildStyleRegistry } from "../styles/registry.mjs";
import { readDdsHeader } from "./dds.mjs";
import { parseEddsMeta } from "./meta.mjs";

export const builtinImageSets = new Set(["dayz_gui", "dayz_crosshairs"]);

export function buildProjectAssetIndex(root, options = {}) {
  const files = options.files ?? findInterestingFiles(root);
  const indexes = buildAssetIndexes(root, files);
  const metaByGuidName = new Map();
  const edds = [];
  const imageSets = [];
  const fonts = buildFontRegistry(root, files);
  const stringTable = buildStringTableIndex(root, files);
  const scripts = buildScriptIndex(root, files);
  const vanillaIndexes = buildVanillaAssetIndexes(options.vanillaRoots ?? process.env.DZUI_VANILLA_ASSETS, root);
  const styles = buildStyleRegistry(root, files, {
    externalRegistries: vanillaIndexes.map((index) => index.styles).filter(Boolean),
  });
  const vanillaImageSetByName = new Map();

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".edds") continue;
    edds.push({
      filePath,
      virtualPath: relativeVirtual(root, filePath),
      ...readDdsHeader(filePath),
    });
  }

  for (const filePath of files) {
    if (!filePath.toLowerCase().endsWith(".edds.meta")) continue;
    const meta = parseEddsMeta(fs.readFileSync(filePath, "utf8"), filePath);
    const eddsPath = filePath.slice(0, -".meta".length);
    const entry = {
      filePath,
      virtualPath: relativeVirtual(root, filePath),
      eddsPath,
      eddsVirtualPath: relativeVirtual(root, eddsPath),
      ...meta,
    };
    if (entry.normalizedName) {
      metaByGuidName.set(entry.normalizedName.toLowerCase(), entry);
    }
  }

  for (const filePath of files) {
    if (path.extname(filePath).toLowerCase() !== ".imageset") continue;
    imageSets.push(parseImageSet(fs.readFileSync(filePath, "utf8"), {
      filePath,
      virtualPath: relativeVirtual(root, filePath),
    }));
  }

  for (const vanillaIndex of vanillaIndexes) {
    for (const [name, imageSet] of vanillaIndex.imageSetByName) {
      if (!vanillaImageSetByName.has(name)) vanillaImageSetByName.set(name, imageSet);
    }
  }

  return {
    root,
    files,
    counts: countByExtension(files),
    indexes,
    metaByGuidName,
    edds,
    imageSets,
    imageSetByName: new Map(imageSets.map((set) => [set.name.toLowerCase(), set])),
    styles,
    fonts,
    stringTable,
    scripts,
    vanillaIndexes,
    vanillaImageSetByName,
  };
}

export function buildAssetIndexes(root, files) {
  const byExactVirtual = new Map();
  const byLowerVirtual = new Map();
  const byFileName = new Map();

  for (const filePath of files) {
    const virtualPath = relativeVirtual(root, filePath);
    const lower = virtualPath.toLowerCase();
    byExactVirtual.set(virtualPath, filePath);
    byLowerVirtual.set(lower, filePath);

    const name = path.basename(filePath).toLowerCase();
    if (!byFileName.has(name)) byFileName.set(name, []);
    byFileName.get(name).push(filePath);
  }

  return { byExactVirtual, byLowerVirtual, byFileName };
}

export function normalizeAssetRoots(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(path.delimiter).map((entry) => entry.trim()).filter(Boolean);
}

function buildVanillaAssetIndexes(value, projectRoot) {
  const project = path.resolve(projectRoot);
  return normalizeAssetRoots(value)
    .map((root) => path.resolve(root))
    .filter((root, index, roots) => roots.indexOf(root) === index)
    .filter((root) => root !== project && fs.existsSync(root) && fs.statSync(root).isDirectory())
    .map((root) => buildExternalAssetIndex(root, "vanilla"));
}

function buildExternalAssetIndex(root, source) {
  const files = findInterestingFiles(root);
  const indexes = buildAssetIndexes(root, files);
  const metaByGuidName = new Map();
  const edds = [];
  const imageSets = [];
  const styles = buildStyleRegistry(root, files);

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".edds") continue;
    edds.push({
      filePath,
      virtualPath: relativeVirtual(root, filePath),
      source,
      ...readDdsHeader(filePath),
    });
  }

  for (const filePath of files) {
    if (!filePath.toLowerCase().endsWith(".edds.meta")) continue;
    const meta = parseEddsMeta(fs.readFileSync(filePath, "utf8"), filePath);
    const eddsPath = filePath.slice(0, -".meta".length);
    const entry = {
      filePath,
      virtualPath: relativeVirtual(root, filePath),
      eddsPath,
      eddsVirtualPath: relativeVirtual(root, eddsPath),
      source,
      ...meta,
    };
    if (entry.normalizedName) {
      metaByGuidName.set(entry.normalizedName.toLowerCase(), entry);
    }
  }

  for (const filePath of files) {
    if (path.extname(filePath).toLowerCase() !== ".imageset") continue;
    imageSets.push({
      ...parseImageSet(fs.readFileSync(filePath, "utf8"), {
        filePath,
        virtualPath: relativeVirtual(root, filePath),
      }),
      source,
    });
  }

  return {
    source,
    root,
    files,
    counts: countByExtension(files),
    indexes,
    metaByGuidName,
    edds,
    imageSets,
    imageSetByName: new Map(imageSets.map((set) => [set.name.toLowerCase(), set])),
    styles,
  };
}

export function resolveAsset(ref, projectIndex) {
  if (!ref || String(ref).startsWith("set:")) return null;

  const normalized = normalizeVirtualRef(ref);
  const local = resolveAssetInIndex(ref, normalized, projectIndex, "project");
  if (local.ok) return local;

  let vanillaCandidates = 0;
  for (const vanillaIndex of projectIndex.vanillaIndexes ?? []) {
    const vanilla = resolveAssetInIndex(ref, normalized, vanillaIndex, "vanilla");
    if (vanilla.ok) return vanilla;
    vanillaCandidates += vanilla.candidates ?? 0;
  }

  return {
    ...local,
    vanillaCandidates,
  };
}

function resolveAssetInIndex(ref, normalized, assetIndex, source) {
  const direct = assetIndex.indexes.byLowerVirtual.get(normalized.toLowerCase());
  if (direct) return assetResolution("virtual", ref, normalized, direct, assetIndex.root, { source });

  const metaHit = assetIndex.metaByGuidName.get(normalized.toLowerCase());
  if (metaHit?.eddsPath && fs.existsSync(metaHit.eddsPath)) {
    return assetResolution("meta-name", ref, normalized, metaHit.eddsPath, assetIndex.root, { meta: metaHit, source });
  }

  const basename = path.basename(normalized).toLowerCase();
  const sameName = assetIndex.indexes.byFileName.get(basename) ?? [];
  if (sameName.length === 1) {
    return assetResolution("basename", ref, normalized, sameName[0], assetIndex.root, { source });
  }

  const suffixHits = [];
  for (const [virtualPath, filePath] of assetIndex.indexes.byLowerVirtual) {
    if (virtualPath.endsWith(normalized.toLowerCase())) suffixHits.push(filePath);
  }
  if (suffixHits.length === 1) {
    return assetResolution("suffix", ref, normalized, suffixHits[0], assetIndex.root, { source });
  }

  return {
    ok: false,
    ref,
    normalized,
    filePath: null,
    virtualPath: null,
    mode: "unresolved",
    candidates: sameName.length + suffixHits.length,
  };
}

export function resolveImageReference(ref, projectIndex) {
  const setRef = parseSetImageRef(ref);
  if (setRef) return resolveSetImageReference(ref, setRef, projectIndex);

  const asset = resolveAsset(ref, projectIndex);
  if (asset?.ok) return { ...asset, kind: "asset" };

  if (/^(dz|dayz)\//i.test(normalizeSlashes(String(ref)))) {
    return {
      ok: false,
      external: true,
      mode: "vanilla-path",
      ref,
      normalized: normalizeVirtualRef(ref),
    };
  }

  return {
    ...(asset ?? { ref, normalized: normalizeVirtualRef(ref), filePath: null, virtualPath: null }),
    ok: false,
    kind: "asset",
  };
}

export function resolveSetImageReference(ref, setRef, projectIndex) {
  const setName = setRef.setName.toLowerCase();
  const imageSet = projectIndex.imageSetByName.get(setName) ?? projectIndex.vanillaImageSetByName?.get(setName);
  if (!imageSet && builtinImageSets.has(setName)) {
    return {
      ok: false,
      external: true,
      mode: "builtin-set",
      kind: "set-image",
      ref,
      ...setRef,
    };
  }

  if (!imageSet) {
    return {
      ok: false,
      mode: "set-unresolved",
      kind: "set-image",
      ref,
      ...setRef,
    };
  }

  const image = imageSet.images.find((candidate) => candidate.name.toLowerCase() === setRef.imageName.toLowerCase());
  if (!image) {
    return {
      ok: false,
      mode: "set-image-unresolved",
      kind: "set-image",
      ref,
      imageSet,
      ...setRef,
    };
  }

  const textureRef = imageSet.textureRefs[0] ?? null;
  const texture = textureRef ? resolveAsset(textureRef, projectIndex) : null;
  return {
    ok: Boolean(texture?.ok),
    mode: texture?.ok ? "imageset" : "imageset-texture-unresolved",
    kind: "set-image",
    ref,
    imageSet,
    image,
    textureRef,
    texture,
    ...setRef,
  };
}

export function collectImageReferenceDiagnostics(imageRefs, projectIndex) {
  const diagnostics = [];
  const externalRefs = [];

  for (const imageRef of imageRefs) {
    if (!imageRef.ref?.trim()) continue;
    const resolved = resolveImageReference(imageRef.ref, projectIndex);

    if (resolved.external) {
      externalRefs.push({
        type: resolved.mode,
        ref: imageRef.ref,
        file: imageRef.virtualPath,
        line: imageRef.line,
      });
      continue;
    }

    if (!resolved.ok) {
      diagnostics.push({
        type: resolved.kind === "asset" && resolved.mode === "unresolved" ? "asset-unresolved" : resolved.mode,
        ref: imageRef.ref,
        file: imageRef.virtualPath,
        line: imageRef.line,
        ...(resolved.imageSet ? { imageset: resolved.imageSet.virtualPath } : {}),
        ...(resolved.candidates !== undefined ? { candidates: resolved.candidates } : {}),
      });
    }
  }

  return { diagnostics, externalRefs };
}

export function collectImageSetTextureDiagnostics(projectIndex) {
  const diagnostics = [];

  for (const set of projectIndex.imageSets) {
    for (const textureRef of set.textureRefs) {
      const resolved = resolveAsset(textureRef, projectIndex);
      if (!resolved?.ok) {
        diagnostics.push({
          type: "imageset-texture-unresolved",
          imageset: set.virtualPath,
          ref: textureRef,
        });
      }
    }
  }

  return diagnostics;
}

function assetResolution(mode, ref, normalized, filePath, root, extra = {}) {
  return {
    ok: true,
    ref,
    normalized,
    filePath,
    virtualPath: relativeVirtual(root, filePath),
    mode,
    ...extra,
  };
}
