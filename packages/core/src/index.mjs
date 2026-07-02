export {
  buildAssetIndexes,
  buildProjectAssetIndex,
  builtinImageSets,
  collectImageReferenceDiagnostics,
  collectImageSetTextureDiagnostics,
  normalizeAssetRoots,
  resolveAsset,
  resolveImageReference,
  resolveSetImageReference,
} from "./assets/index.mjs";

export {
  decodeDdsFileToPng,
  decodeDdsRgba,
  decodePngRgba,
  encodePngRgba,
  readPngRgba,
  readDdsHeader,
  readDdsHeaderBuffer,
} from "./assets/dds.mjs";

export {
  discoverExternalPreviewDecoder,
  discoverTexconvPath,
  ensureDecodedPreviewAsset,
  previewCacheKey,
  previewCachePath,
  runExternalPreviewDecoder,
} from "./assets/preview-cache.mjs";

export {
  parseEddsMeta,
} from "./assets/meta.mjs";

export {
  parseImageSet,
  parseSetImageRef,
} from "./imageset/parser.mjs";

export {
  importImageAsset,
  readImageDimensions,
  readPngDimensions,
  serializeImageSet,
  upsertImageSetSprite,
} from "./imageset/authoring.mjs";

export {
  packImageAtlas,
} from "./imageset/atlas.mjs";

export {
  createEditTransaction,
  createSourceSnapshot,
  hashSource,
  redoTransaction,
  undoTransaction,
} from "./history/snapshots.mjs";

export {
  importFontAsset,
  extractBmFontPageRefs,
} from "./fonts/authoring.mjs";

export {
  buildFontCoverageReport,
} from "./fonts/coverage-report.mjs";

export {
  buildFontRegistry,
  fontEntryToJson,
  findMissingGlyphs,
  fontExtensions,
  fontRegistryToJson,
  parseFontCoverage,
  readFontCoverage,
  resolveFontRef,
  summarizeFontCoverage,
} from "./fonts/registry.mjs";

export {
  buildLayoutDiffReport,
  diffLayoutSources,
} from "./layout/diff.mjs";

export {
  applyLayoutPatch,
  generateLayoutPatch,
  generateLayoutPatchFromSources,
  normalizeLayoutPatch,
  resolveLayoutPatchConflicts,
} from "./layout/patch.mjs";

export {
  composeLayoutSource,
} from "./layout/compose.mjs";

export {
  createWidget,
  deleteWidget,
  findWidgetByName,
  findWidgetByPreviewId,
  insertWidgetSource,
  removeWidgetProperty,
  replaceWidgetSource,
  reparentWidget,
  updateWidgetProperty,
} from "./layout/edit.mjs";

export {
  getProperties,
  getProperty,
  layoutToPlainObject,
  parseLayout,
  serializeLayout,
  summarizeLayout,
  walkWidgets,
} from "./layout/parser.mjs";

export {
  buildLayoutPreviewModel,
  computeBox,
} from "./layout/preview-model.mjs";

export {
  buildLayoutTransformPatch,
  layoutTransformActions,
} from "./layout/transform.mjs";

export {
  describeBatchWidgetProperties,
  describeWidgetProperties,
  schemaForProperty,
} from "./layout/property-schema.mjs";

export {
  getWidgetPalettePreset,
  instantiateWidgetPreset,
  listWidgetPalette,
  editorWidgetPalettePresets,
  widgetPalettePresets,
} from "./layout/widget-palette.mjs";

export {
  layoutTokenTypes,
  tokenizeLayout,
} from "./layout/tokenizer.mjs";

export {
  countByExtension,
  findInterestingFiles,
  supportedProjectExtensions,
  walkFiles,
} from "./project/files.mjs";

export {
  normalizeSlashes,
  normalizeVirtualRef,
  relativeVirtual,
} from "./project/path-utils.mjs";

export {
  createDefaultProjectSettings,
  normalizeProjectSettings,
  projectSettingsFileName,
  projectSettingsPath,
  readProjectSettings,
  writeProjectSettings,
} from "./project/settings.mjs";

export {
  buildPluginRuntimePackage,
  buildPluginRuntimeRegistry,
  buildPluginSdkReport,
  discoverPluginManifests,
  installPluginRuntimeTrust,
  pluginManifestFileNames,
  pluginRuntimePackageFileName,
  pluginRuntimePackagePath,
  pluginTrustPolicyFileName,
  pluginTrustPolicyPath,
  readPluginTrustPolicy,
  readPluginManifest,
  runPluginRuntimeCommand,
  supportedPluginApiVersions,
  verifyPluginRuntimePackage,
  writePluginRuntimePackage,
} from "./plugins/sdk.mjs";

export {
  buildPreviewData,
  renderPreviewHtml,
} from "./preview/html.mjs";

export {
  buildScriptIndex,
  scanScriptContent,
} from "./scripts/scanner.mjs";

export {
  generateControllerSkeleton,
  selectNamedWidgets,
} from "./scripts/controller-generator.mjs";

export {
  buildStyleRegistry,
  getStyleParentNames,
  listStylePropertySchemas,
  parseStyleFile,
  resolveStyleInheritance,
  schemaForStyleProperty,
  styleFileToJson,
  validateStyleFile,
} from "./styles/registry.mjs";

export {
  upsertStyleProperty,
} from "./styles/authoring.mjs";

export {
  buildStringTableIndex,
  localizeStringValue,
  normalizeStringKey,
  parseStringTableCsv,
  stringTableToGrid,
  updateStringTableCsv,
} from "./localization/stringtable.mjs";

export {
  validateLayoutDocument,
  validateLayoutFile,
  validateProject,
} from "./validation/layout.mjs";
