import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeSlashes } from "../project/path-utils.mjs";

export const pluginManifestFileNames = new Set([
  "dzui.plugin.json",
  "plugin.dzui.json",
]);

export const supportedPluginApiVersions = new Set(["0.1"]);
export const pluginRuntimePackageFileName = "plugin-runtime-package.json";
export const pluginTrustPolicyFileName = "plugin-trust-policy.json";
const pluginSignaturePayloadPrefix = "dzui-plugin-runtime-package-v1";

export function pluginRuntimePackagePath(projectRoot, out = null) {
  return path.resolve(out ?? path.join(requiredProjectRoot(projectRoot), ".dzui", pluginRuntimePackageFileName));
}

export function pluginTrustPolicyPath(projectRoot, out = null) {
  return path.resolve(out ?? path.join(requiredProjectRoot(projectRoot), ".dzui", pluginTrustPolicyFileName));
}

export function buildPluginRuntimeRegistry(projectRoot, options = {}) {
  const report = buildPluginSdkReport(projectRoot, options);
  const diagnostics = [...report.diagnostics];
  const files = [];
  const commands = [];
  const widgetPresets = [];
  const panels = [];
  const validators = [];
  const plugins = [];
  const seenRuntimeIds = new Set();

  for (const plugin of report.plugins) {
    if (!plugin.enabled) continue;
    if (hasPluginError(report, plugin)) continue;

    const manifestFile = describeRuntimeFile(plugin.manifestPath, report.projectRoot, "manifest", plugin);
    const entryFile = plugin.entry?.ok
      ? describeRuntimeFile(plugin.entry.filePath, report.projectRoot, "entry", plugin)
      : null;
    pushFile(files, manifestFile);
    pushFile(files, entryFile);

    const runtimePlugin = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      apiVersion: plugin.apiVersion,
      description: plugin.description,
      manifestVirtualPath: plugin.manifestVirtualPath,
      pluginVirtualRoot: plugin.pluginVirtualRoot,
      entry: publicRuntimeFile(entryFile),
      capabilities: plugin.capabilities,
    };
    plugins.push(runtimePlugin);

    for (const contribution of plugin.contributes.commands) {
      commands.push(runtimeContribution(plugin, contribution, "commands", report.projectRoot, seenRuntimeIds, diagnostics, files));
    }
    for (const contribution of plugin.contributes.widgetPresets) {
      widgetPresets.push(runtimeWidgetPreset(plugin, contribution, report.projectRoot, seenRuntimeIds, diagnostics));
    }
    for (const contribution of plugin.contributes.panels) {
      panels.push(runtimeContribution(plugin, contribution, "panels", report.projectRoot, seenRuntimeIds, diagnostics, files));
    }
    for (const contribution of plugin.contributes.validators) {
      validators.push(runtimeContribution(plugin, contribution, "validators", report.projectRoot, seenRuntimeIds, diagnostics, files));
    }
  }

  return {
    kind: "PluginRuntimeRegistry",
    apiVersion: "0.1",
    ready: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    projectRoot: report.projectRoot,
    pluginCount: plugins.length,
    contributionCounts: {
      commands: commands.length,
      widgetPresets: widgetPresets.length,
      panels: panels.length,
      validators: validators.length,
    },
    diagnostics,
    plugins,
    commands,
    widgetPresets,
    panels,
    validators,
    package: {
      kind: "PluginRuntimePackage",
      fileCount: files.length,
      files: files.map(publicRuntimeFile),
    },
    sdkReport: {
      ready: report.ready,
      manifestCount: report.manifestCount,
      pluginCount: report.pluginCount,
      enabledCount: report.enabledCount,
      disabledCount: report.disabledCount,
    },
  };
}

export function buildPluginRuntimePackage(projectRoot, options = {}) {
  const registry = buildPluginRuntimeRegistry(projectRoot, options);
  const files = registry.package.files
    .map(packageFileRecord)
    .sort(comparePackageRecords);
  const plugins = registry.plugins
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      apiVersion: plugin.apiVersion,
      manifestVirtualPath: plugin.manifestVirtualPath,
      pluginVirtualRoot: plugin.pluginVirtualRoot,
      capabilities: [...plugin.capabilities],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const contributions = {
    commands: registry.commands.map(packageContributionRecord).sort(comparePackageRecords),
    widgetPresets: registry.widgetPresets.map(packageWidgetPresetRecord).sort(comparePackageRecords),
    panels: registry.panels.map(packageContributionRecord).sort(comparePackageRecords),
    validators: registry.validators.map(packageContributionRecord).sort(comparePackageRecords),
  };
  const integrityPayload = {
    apiVersion: "0.1",
    plugins,
    contributions,
    files,
  };
  const packageSha256 = hashJson(integrityPayload);
  const signature = createPluginPackageSignature(packageSha256, options);
  return {
    kind: "PluginRuntimePackageManifest",
    apiVersion: "0.1",
    ready: registry.ready,
    projectRoot: registry.projectRoot,
    packageSha256,
    integrity: {
      algorithm: "sha256",
      signed: Boolean(signature),
      mode: "runtime-manifest",
      signatureAlgorithm: signature?.algorithm ?? null,
      keyId: signature?.keyId ?? null,
    },
    signature,
    pluginCount: plugins.length,
    contributionCounts: registry.contributionCounts,
    plugins,
    contributions,
    files,
    diagnostics: registry.diagnostics,
  };
}

export function writePluginRuntimePackage(projectRoot, options = {}) {
  const manifest = buildPluginRuntimePackage(projectRoot, options);
  const filePath = pluginRuntimePackagePath(projectRoot, options.out);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    ...manifest,
    written: true,
    filePath,
  };
}

export function readPluginTrustPolicy(projectRoot, options = {}) {
  const root = path.resolve(requiredProjectRoot(projectRoot));
  const filePath = pluginTrustPolicyPath(root, options.path ?? options.trustPolicyPath);
  const exists = fs.existsSync(filePath);
  const policy = exists ? readTrustPolicyInput(filePath) : {};
  const trustedKeys = normalizeTrustedKeys(policy.trustedKeys ?? policy.keys);
  return {
    kind: "PluginTrustPolicy",
    apiVersion: "0.1",
    projectRoot: root,
    filePath,
    exists,
    requireSignature: policy.requireSignature === true,
    requireTrusted: policy.requireTrusted === true,
    trustedKeyCount: trustedKeys.length,
    trustedKeys,
  };
}

export function installPluginRuntimeTrust(projectRoot, manifestInput, options = {}) {
  const root = path.resolve(requiredProjectRoot(projectRoot));
  const manifest = readPackageManifestInput(manifestInput ?? options.manifest ?? options.packagePath ?? pluginRuntimePackagePath(root));
  const signature = verifyPluginPackageSignature(manifest, { requireSignature: true });
  const diagnostics = [...signature.diagnostics];
  if (!signature.verified) {
    return {
      kind: "PluginTrustInstall",
      projectRoot: root,
      installed: false,
      ready: false,
      reason: "Plugin runtime package signature verification failed.",
      signature,
      diagnostics,
    };
  }

  const publicKeyPem = manifest.signature?.publicKeyPem;
  if (!publicKeyPem) {
    diagnostics.push(packageDiagnostic("plugin.package.signature.publicKey.missing", "error", "Plugin runtime package signature has no public key to trust."));
    return {
      kind: "PluginTrustInstall",
      projectRoot: root,
      installed: false,
      ready: false,
      reason: "Plugin runtime package signature has no public key to trust.",
      signature,
      diagnostics,
    };
  }

  const filePath = pluginTrustPolicyPath(root, options.out ?? options.trustPolicyPath ?? options.policyPath);
  const existing = fs.existsSync(filePath) ? readTrustPolicyInput(filePath) : {};
  const trustedKeys = normalizeTrustedKeys(existing.trustedKeys ?? existing.keys);
  const key = {
    id: manifest.signature.keyId || publicKeyFingerprint(publicKeyPem),
    algorithm: "ed25519",
    publicKeyPem,
  };
  const alreadyTrusted = Boolean(findTrustedKey({ ...manifest.signature, keyId: key.id, publicKeyPem }, trustedKeys));
  const nextKeys = alreadyTrusted ? trustedKeys : [...trustedKeys, key];
  const policy = {
    kind: "PluginTrustPolicy",
    apiVersion: "0.1",
    requireSignature: existing.requireSignature !== false,
    requireTrusted: existing.requireTrusted !== false,
    trustedKeys: nextKeys,
  };
  if (options.write !== false) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
  }
  return {
    kind: "PluginTrustInstall",
    projectRoot: root,
    filePath,
    written: options.write !== false,
    installed: !alreadyTrusted,
    alreadyTrusted,
    ready: true,
    key,
    policy: {
      requireSignature: policy.requireSignature,
      requireTrusted: policy.requireTrusted,
      trustedKeyCount: policy.trustedKeys.length,
    },
    signature,
    diagnostics,
  };
}

export function verifyPluginRuntimePackage(projectRoot, manifestInput, options = {}) {
  const actual = buildPluginRuntimePackage(projectRoot, options);
  const manifest = readPackageManifestInput(manifestInput ?? options.manifest ?? pluginRuntimePackagePath(projectRoot, options.packagePath));
  const diagnostics = [];
  const fileResults = [];

  if (!manifest || typeof manifest !== "object") {
    diagnostics.push(packageDiagnostic("plugin.package.manifest.invalid", "error", "Plugin runtime package manifest is not an object."));
  } else if (manifest.kind !== "PluginRuntimePackageManifest") {
    diagnostics.push(packageDiagnostic("plugin.package.kind.invalid", "error", `Unexpected plugin package manifest kind: ${manifest.kind ?? "missing"}`));
  }

  if (manifest?.packageSha256 !== actual.packageSha256) {
    diagnostics.push(packageDiagnostic("plugin.package.hash.mismatch", "error", "Plugin runtime package hash does not match the current project runtime registry.", {
      expected: manifest?.packageSha256 ?? null,
      actual: actual.packageSha256,
    }));
  }

  const signature = verifyPluginPackageSignature(manifest, options);
  diagnostics.push(...signature.diagnostics);

  const expectedFiles = new Map((manifest?.files ?? []).map((file) => [packageFileKey(file), file]));
  const actualFiles = new Map(actual.files.map((file) => [packageFileKey(file), file]));
  for (const [key, expected] of expectedFiles) {
    const current = actualFiles.get(key);
    if (!current) {
      diagnostics.push(packageDiagnostic("plugin.package.file.missing", "error", `Packaged plugin file is missing from current runtime: ${expected.virtualPath}`, { key }));
      fileResults.push({ key, virtualPath: expected.virtualPath, status: "missing" });
      continue;
    }
    if (expected.sha256 !== current.sha256 || expected.bytes !== current.bytes) {
      diagnostics.push(packageDiagnostic("plugin.package.file.hash.mismatch", "error", `Packaged plugin file changed: ${expected.virtualPath}`, {
        key,
        expectedSha256: expected.sha256,
        actualSha256: current.sha256,
        expectedBytes: expected.bytes,
        actualBytes: current.bytes,
      }));
      fileResults.push({ key, virtualPath: expected.virtualPath, status: "changed" });
      continue;
    }
    fileResults.push({ key, virtualPath: expected.virtualPath, status: "ok" });
  }
  for (const [key, current] of actualFiles) {
    if (expectedFiles.has(key)) continue;
    diagnostics.push(packageDiagnostic("plugin.package.file.extra", "error", `Current runtime has an unpackaged plugin file: ${current.virtualPath}`, { key }));
    fileResults.push({ key, virtualPath: current.virtualPath, status: "extra" });
  }

  diagnostics.push(...actual.diagnostics);
  const passed = diagnostics.every((diagnostic) => diagnostic.severity !== "error") && actual.ready;
  return {
    kind: "PluginRuntimePackageVerification",
    projectRoot: actual.projectRoot,
    passed,
    ready: passed,
    packageSha256: {
      expected: manifest?.packageSha256 ?? null,
      actual: actual.packageSha256,
    },
    signature,
    expectedFileCount: manifest?.files?.length ?? 0,
    actualFileCount: actual.files.length,
    fileResults,
    diagnostics,
  };
}

export async function runPluginRuntimeCommand(projectRoot, options = {}) {
  const root = path.resolve(requiredProjectRoot(projectRoot));
  const commandId = requiredString(options.commandId ?? options.id, "commandId");
  const registry = buildPluginRuntimeRegistry(root, options);
  const command = findRuntimeCommand(registry.commands, commandId);
  if (!command) {
    return {
      kind: "PluginRuntimeCommandResult",
      executed: false,
      ready: false,
      reason: `Unknown plugin runtime command: ${commandId}`,
      commandId,
      availableCommands: registry.commands.map((entry) => entry.id),
      diagnostics: registry.diagnostics,
    };
  }

  const plugin = registry.plugins.find((entry) => entry.id === command.pluginId);
  const plan = {
    kind: "PluginRuntimeCommandPlan",
    execute: options.execute === true,
    projectRoot: root,
    command: publicCommandDescriptor(command),
    plugin: plugin ? publicPluginDescriptor(plugin) : null,
    trust: {
      required: options.allowUntrusted !== true,
      allowUntrusted: options.allowUntrusted === true,
      packagePath: options.packagePath ?? null,
      requireSignature: options.requireSignature === true,
      requireTrusted: options.requireTrusted === true,
      verified: false,
    },
    diagnostics: registry.diagnostics,
  };

  if (options.execute !== true) return plan;

  let verification = null;
  if (options.allowUntrusted !== true) {
    try {
      verification = verifyPluginRuntimePackage(root, options.manifest ?? options.packagePath, {
        requireSignature: options.requireSignature === true,
        requireTrusted: options.requireTrusted === true,
        trustPolicy: options.trustPolicy,
        trustPolicyPath: options.trustPolicyPath,
        trustedKeys: options.trustedKeys,
        trustedKeysPath: options.trustedKeysPath,
      });
    } catch (error) {
      verification = verificationError(error);
    }
    plan.trust.verified = verification.passed === true;
    if (!verification.passed) {
      return {
        kind: "PluginRuntimeCommandResult",
        executed: false,
        ready: false,
        trusted: false,
        reason: "Plugin runtime package verification failed.",
        command: plan.command,
        plugin: plan.plugin,
        verification,
        diagnostics: [...plan.diagnostics, ...verification.diagnostics],
      };
    }
  }

  if (!plugin?.entry?.filePath) {
    return {
      kind: "PluginRuntimeCommandResult",
      executed: false,
      ready: false,
      trusted: options.allowUntrusted !== true,
      reason: `Plugin command has no executable plugin entry: ${command.id}`,
      command: plan.command,
      plugin: plan.plugin,
      verification,
      diagnostics: plan.diagnostics,
    };
  }

  const moduleUrl = runtimeImportUrl(plugin.entry.filePath);
  const pluginModule = await import(moduleUrl);
  const activated = await activatePluginModule(pluginModule, {
    apiVersion: "0.1",
    projectRoot: root,
    plugin: publicPluginDescriptor(plugin),
    command: publicCommandDescriptor(command),
  });
  const handler = resolveCommandHandler(activated, command);
  if (!handler) {
    return {
      kind: "PluginRuntimeCommandResult",
      executed: false,
      ready: false,
      trusted: options.allowUntrusted !== true,
      reason: `Plugin entry did not register command handler: ${command.contributionId}`,
      command: plan.command,
      plugin: plan.plugin,
      verification,
      diagnostics: plan.diagnostics,
    };
  }

  const result = await runCommandHandler(handler, {
    args: cloneJsonValue(options.args ?? {}),
    projectRoot: root,
    plugin: publicPluginDescriptor(plugin),
    command: publicCommandDescriptor(command),
  });
  return {
    kind: "PluginRuntimeCommandResult",
    executed: true,
    ready: true,
    trusted: options.allowUntrusted !== true,
    command: plan.command,
    plugin: plan.plugin,
    verification,
    result: toJsonSafe(result),
    diagnostics: plan.diagnostics,
  };
}

export function buildPluginSdkReport(projectRoot, options = {}) {
  const root = path.resolve(requiredProjectRoot(projectRoot));
  const diagnostics = [];
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return {
      kind: "PluginSdkReport",
      apiVersion: "0.1",
      ready: false,
      projectRoot: root,
      manifestCount: 0,
      pluginCount: 0,
      enabledCount: 0,
      disabledCount: 0,
      diagnostics: [{
        code: "plugin.project.missing",
        severity: "error",
        message: `Project root does not exist: ${root}`,
        filePath: root,
      }],
      plugins: [],
      contributionCounts: emptyContributionCounts(),
    };
  }

  const manifestFiles = discoverPluginManifests(root, options);
  const plugins = [];
  for (const filePath of manifestFiles) {
    const loaded = readPluginManifest(filePath, root);
    diagnostics.push(...loaded.diagnostics);
    if (loaded.plugin) plugins.push(loaded.plugin);
  }

  diagnostics.push(...validatePluginIdUniqueness(plugins));
  const contributionCounts = countPluginContributions(plugins);
  const enabledPlugins = plugins.filter((plugin) => plugin.enabled);
  return {
    kind: "PluginSdkReport",
    apiVersion: "0.1",
    ready: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    projectRoot: root,
    manifestCount: manifestFiles.length,
    pluginCount: plugins.length,
    enabledCount: enabledPlugins.length,
    disabledCount: plugins.length - enabledPlugins.length,
    diagnostics,
    plugins,
    contributionCounts,
  };
}

export function discoverPluginManifests(projectRoot, options = {}) {
  const root = path.resolve(requiredProjectRoot(projectRoot));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  const files = [];
  walkPluginFiles(root, files, {
    maxDepth: Number(options.maxDepth ?? 8),
  });
  return files
    .filter((filePath) => pluginManifestFileNames.has(path.basename(filePath).toLowerCase()))
    .sort((a, b) => normalizeSlashes(path.relative(root, a)).localeCompare(normalizeSlashes(path.relative(root, b))));
}

export function readPluginManifest(filePath, projectRoot = path.dirname(filePath)) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(projectRoot);
  const diagnostics = [];
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(resolved, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      plugin: null,
      diagnostics: [{
        code: "plugin.manifest.parse",
        severity: "error",
        message: `Unable to parse plugin manifest: ${errorMessage(error)}`,
        filePath: resolved,
      }],
    };
  }

  const normalized = normalizePluginManifest(manifest, resolved, root);
  diagnostics.push(...validatePluginManifest(normalized));
  return { plugin: normalized, diagnostics };
}

export function normalizePluginManifest(manifest, filePath, projectRoot) {
  const pluginDir = path.dirname(filePath);
  const contributes = manifest && typeof manifest === "object" && manifest.contributes && typeof manifest.contributes === "object"
    ? manifest.contributes
    : {};
  const widgetPresets = arrayValue(contributes.widgetPresets ?? contributes.widgets).map((contribution) => normalizeContribution(contribution));
  const commands = arrayValue(contributes.commands).map((contribution) => normalizeContribution(contribution));
  const panels = arrayValue(contributes.panels).map((contribution) => normalizeContribution(contribution));
  const validators = arrayValue(contributes.validators).map((contribution) => normalizeContribution(contribution));
  const entry = typeof manifest?.entry === "string" && manifest.entry.trim()
    ? resolvePluginFile(pluginDir, manifest.entry)
    : null;

  return {
    id: typeof manifest?.id === "string" ? manifest.id.trim() : "",
    name: typeof manifest?.name === "string" ? manifest.name.trim() : "",
    version: typeof manifest?.version === "string" ? manifest.version.trim() : "",
    apiVersion: typeof manifest?.apiVersion === "string" ? manifest.apiVersion.trim() : "0.1",
    description: typeof manifest?.description === "string" ? manifest.description.trim() : "",
    enabled: manifest?.enabled !== false && manifest?.disabled !== true,
    manifestPath: filePath,
    manifestVirtualPath: normalizeSlashes(path.relative(projectRoot, filePath)),
    pluginRoot: pluginDir,
    pluginVirtualRoot: normalizeSlashes(path.relative(projectRoot, pluginDir)),
    entry,
    entryVirtualPath: entry?.ok ? normalizeSlashes(path.relative(projectRoot, entry.filePath)) : null,
    contributes: {
      commands,
      widgetPresets,
      panels,
      validators,
    },
    capabilities: capabilitiesFor({ commands, widgetPresets, panels, validators }),
  };
}

export function validatePluginManifest(plugin) {
  const diagnostics = [];
  if (!plugin.id) {
    diagnostics.push(pluginDiagnostic(plugin, "plugin.manifest.id.missing", "error", "Plugin id is required."));
  } else if (!isValidContributionId(plugin.id)) {
    diagnostics.push(pluginDiagnostic(plugin, "plugin.manifest.id.invalid", "error", `Plugin id must use letters, numbers, dot, underscore, or dash: ${plugin.id}`));
  }
  if (!plugin.name) diagnostics.push(pluginDiagnostic(plugin, "plugin.manifest.name.missing", "error", "Plugin name is required."));
  if (!plugin.version) {
    diagnostics.push(pluginDiagnostic(plugin, "plugin.manifest.version.missing", "error", "Plugin version is required."));
  } else if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(plugin.version)) {
    diagnostics.push(pluginDiagnostic(plugin, "plugin.manifest.version.invalid", "warning", `Plugin version should be semver-like: ${plugin.version}`));
  }
  if (!supportedPluginApiVersions.has(plugin.apiVersion)) {
    diagnostics.push(pluginDiagnostic(plugin, "plugin.manifest.api.unsupported", "warning", `Plugin API version is not known to this DZUI build: ${plugin.apiVersion}`));
  }
  if (plugin.entry) diagnostics.push(...validatePluginFileRef(plugin, plugin.entry, "plugin.manifest.entry"));
  diagnostics.push(...validateContributionGroup(plugin, "commands"));
  diagnostics.push(...validateContributionGroup(plugin, "widgetPresets"));
  diagnostics.push(...validateContributionGroup(plugin, "panels", { fileKey: "entry" }));
  diagnostics.push(...validateContributionGroup(plugin, "validators", { fileKey: "entry" }));
  return diagnostics;
}

function validateContributionGroup(plugin, key, options = {}) {
  const diagnostics = [];
  const seen = new Set();
  for (const contribution of plugin.contributes[key] ?? []) {
    if (!contribution.id) {
      diagnostics.push(pluginDiagnostic(plugin, `plugin.contributes.${key}.id.missing`, "error", `${key} contribution id is required.`));
      continue;
    }
    if (!isValidContributionId(contribution.id)) {
      diagnostics.push(pluginDiagnostic(plugin, `plugin.contributes.${key}.id.invalid`, "error", `${key} contribution id is invalid: ${contribution.id}`, { contributionId: contribution.id }));
    }
    const lower = contribution.id.toLowerCase();
    if (seen.has(lower)) {
      diagnostics.push(pluginDiagnostic(plugin, `plugin.contributes.${key}.id.duplicate`, "error", `${key} contribution id is duplicated: ${contribution.id}`, { contributionId: contribution.id }));
    }
    seen.add(lower);
    if (key === "widgetPresets" && !contribution.typeClass) {
      diagnostics.push(pluginDiagnostic(plugin, "plugin.contributes.widgetPresets.typeClass.missing", "error", `Widget preset ${contribution.id} requires typeClass.`, { contributionId: contribution.id }));
    }
    const fileRef = options.fileKey ? contribution[options.fileKey] : null;
    if (options.fileKey && (typeof fileRef !== "string" || !fileRef.trim())) {
      diagnostics.push(pluginDiagnostic(plugin, `plugin.contributes.${key}.${options.fileKey}.missing`, "error", `${key} contribution ${contribution.id} requires ${options.fileKey}.`, { contributionId: contribution.id }));
      continue;
    }
    if (typeof fileRef === "string" && fileRef.trim()) {
      diagnostics.push(...validatePluginFileRef(plugin, resolvePluginFile(plugin.pluginRoot, fileRef), `plugin.contributes.${key}.${options.fileKey}`, { contributionId: contribution.id }));
    }
  }
  return diagnostics;
}

function validatePluginFileRef(plugin, resolved, code, context = {}) {
  if (!resolved.ok) {
    return [pluginDiagnostic(plugin, `${code}.outside-root`, "error", resolved.reason, context)];
  }
  if (!fs.existsSync(resolved.filePath) || !fs.statSync(resolved.filePath).isFile()) {
    return [pluginDiagnostic(plugin, `${code}.missing`, "error", `Plugin file does not exist: ${resolved.relativePath}`, context)];
  }
  return [];
}

function validatePluginIdUniqueness(plugins) {
  const diagnostics = [];
  const seen = new Map();
  for (const plugin of plugins) {
    const lower = plugin.id.toLowerCase();
    if (!lower) continue;
    if (seen.has(lower)) {
      diagnostics.push(pluginDiagnostic(plugin, "plugin.manifest.id.duplicate", "error", `Plugin id is duplicated: ${plugin.id}`, {
        firstManifestPath: seen.get(lower).manifestPath,
      }));
    } else {
      seen.set(lower, plugin);
    }
  }
  return diagnostics;
}

function normalizeContribution(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...source,
    id: typeof source.id === "string" ? source.id.trim() : "",
    title: typeof source.title === "string" ? source.title.trim() : typeof source.label === "string" ? source.label.trim() : "",
    label: typeof source.label === "string" ? source.label.trim() : typeof source.title === "string" ? source.title.trim() : "",
    category: typeof source.category === "string" ? source.category.trim() : "",
    defaultName: typeof source.defaultName === "string" ? source.defaultName.trim() : "",
    description: typeof source.description === "string" ? source.description.trim() : "",
    typeClass: typeof source.typeClass === "string" ? source.typeClass.trim() : "",
  };
}

function hasPluginError(report, plugin) {
  return report.diagnostics.some((diagnostic) => (
    diagnostic.severity === "error"
      && (diagnostic.pluginId === plugin.id || diagnostic.filePath === plugin.manifestPath)
  ));
}

function runtimeContribution(plugin, contribution, kind, projectRoot, seenRuntimeIds, diagnostics, files) {
  const runtimeId = runtimeContributionId(plugin, contribution);
  checkRuntimeId(plugin, contribution, runtimeId, seenRuntimeIds, diagnostics);
  const entry = typeof contribution.entry === "string" && contribution.entry.trim()
    ? describeRuntimeFile(resolvePluginFile(plugin.pluginRoot, contribution.entry).filePath, projectRoot, `${kind}.entry`, plugin, contribution)
    : null;
  pushFile(files, entry);
  return {
    id: runtimeId,
    pluginId: plugin.id,
    pluginName: plugin.name,
    contributionId: contribution.id,
    title: contribution.title || contribution.label || contribution.id,
    label: contribution.label || contribution.title || contribution.id,
    entry: publicRuntimeFile(entry),
    manifestVirtualPath: plugin.manifestVirtualPath,
  };
}

function runtimeWidgetPreset(plugin, contribution, projectRoot, seenRuntimeIds, diagnostics) {
  const runtimeId = runtimeContributionId(plugin, contribution);
  checkRuntimeId(plugin, contribution, runtimeId, seenRuntimeIds, diagnostics);
  return {
    id: runtimeId,
    pluginId: plugin.id,
    pluginName: plugin.name,
    contributionId: contribution.id,
    source: "plugin",
    label: contribution.label || contribution.title || contribution.id,
    title: contribution.title || contribution.label || contribution.id,
    category: contribution.category || "Plugin",
    typeClass: contribution.typeClass,
    defaultName: contribution.defaultName || defaultNameFromContribution(contribution),
    description: contribution.description || "",
    props: cloneJsonValue(contribution.props ?? {}),
    manifestVirtualPath: plugin.manifestVirtualPath,
    pluginVirtualRoot: normalizeSlashes(path.relative(projectRoot, plugin.pluginRoot)),
  };
}

function packageFileRecord(file) {
  return {
    role: file.role,
    virtualPath: file.virtualPath,
    bytes: file.bytes,
    sha256: file.sha256,
    pluginId: file.pluginId,
    contributionId: file.contributionId,
  };
}

function packageContributionRecord(contribution) {
  return {
    id: contribution.id,
    pluginId: contribution.pluginId,
    contributionId: contribution.contributionId,
    title: contribution.title,
    label: contribution.label,
    entryVirtualPath: contribution.entry?.virtualPath ?? null,
  };
}

function packageWidgetPresetRecord(preset) {
  return {
    id: preset.id,
    pluginId: preset.pluginId,
    contributionId: preset.contributionId,
    label: preset.label,
    category: preset.category,
    typeClass: preset.typeClass,
    defaultName: preset.defaultName,
    props: cloneJsonValue(preset.props),
  };
}

function findRuntimeCommand(commands, commandId) {
  const normalized = String(commandId).trim().toLowerCase();
  const exact = commands.find((command) => command.id.toLowerCase() === normalized);
  if (exact) return exact;
  const byContribution = commands.filter((command) => command.contributionId.toLowerCase() === normalized);
  return byContribution.length === 1 ? byContribution[0] : null;
}

function publicCommandDescriptor(command) {
  return {
    id: command.id,
    pluginId: command.pluginId,
    contributionId: command.contributionId,
    title: command.title,
    label: command.label,
    manifestVirtualPath: command.manifestVirtualPath,
  };
}

function publicPluginDescriptor(plugin) {
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    apiVersion: plugin.apiVersion,
    manifestVirtualPath: plugin.manifestVirtualPath,
    pluginVirtualRoot: plugin.pluginVirtualRoot,
    capabilities: [...plugin.capabilities],
  };
}

function verificationError(error) {
  const message = errorMessage(error);
  return {
    kind: "PluginRuntimePackageVerification",
    passed: false,
    ready: false,
    diagnostics: [packageDiagnostic("plugin.package.verify.failed", "error", message)],
  };
}

function runtimeImportUrl(filePath) {
  const stat = fs.statSync(filePath);
  return `${pathToFileURL(filePath).href}?dzui=${stat.mtimeMs}`;
}

async function activatePluginModule(pluginModule, context) {
  const candidate = pluginModule.default ?? pluginModule;
  if (typeof candidate?.activate === "function") {
    return candidate.activate(Object.freeze({ ...context }));
  }
  if (typeof pluginModule.activate === "function") {
    return pluginModule.activate(Object.freeze({ ...context }));
  }
  return candidate;
}

function resolveCommandHandler(activated, command) {
  const commands = activated?.commands ?? activated?.commandHandlers;
  if (!commands) return null;
  if (commands instanceof Map) {
    return commands.get(command.contributionId) ?? commands.get(command.id) ?? null;
  }
  return commands[command.contributionId] ?? commands[command.id] ?? null;
}

async function runCommandHandler(handler, context) {
  if (typeof handler === "function") return handler(context);
  if (typeof handler?.run === "function") return handler.run(context);
  if (typeof handler?.execute === "function") return handler.execute(context);
  return null;
}

function toJsonSafe(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function comparePackageRecords(a, b) {
  return stableJson(a).localeCompare(stableJson(b));
}

function packageFileKey(file) {
  return [
    file?.role ?? "",
    file?.pluginId ?? "",
    file?.contributionId ?? "",
    file?.virtualPath ?? "",
  ].join(":");
}

function readPackageManifestInput(input) {
  if (typeof input === "string") {
    const filePath = path.resolve(input);
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  }
  return input;
}

function createPluginPackageSignature(packageSha256, options = {}) {
  const privateKeyPem = readPemInput(options.signPrivateKeyPem ?? options.privateKeyPem, options.signPrivateKeyPath ?? options.privateKeyPath);
  if (!privateKeyPem) return null;
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKeyPem = readPemInput(options.signPublicKeyPem ?? options.publicKeyPem, options.signPublicKeyPath ?? options.publicKeyPath)
    ?? crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  const keyId = String(options.signKeyId ?? options.keyId ?? publicKeyFingerprint(publicKeyPem)).trim();
  return {
    algorithm: "ed25519",
    keyId,
    publicKeyPem,
    value: crypto.sign(null, pluginSignaturePayload(packageSha256), privateKey).toString("base64"),
  };
}

function verifyPluginPackageSignature(manifest, options = {}) {
  const policy = normalizePluginTrustPolicy(options);
  const required = options.requireSignature === true || policy.requireSignature === true || options.requireTrusted === true || policy.requireTrusted === true;
  const requireTrusted = options.requireTrusted === true || policy.requireTrusted === true;
  const signature = manifest?.signature;
  const diagnostics = [];
  const result = {
    required,
    requireTrusted,
    signed: false,
    verified: false,
    trusted: false,
    algorithm: signature?.algorithm ?? null,
    keyId: signature?.keyId ?? null,
    diagnostics,
  };

  if (!signature) {
    if (required) {
      diagnostics.push(packageDiagnostic("plugin.package.signature.missing", "error", "Plugin runtime package requires a cryptographic signature."));
    }
    return result;
  }

  result.signed = true;
  if (signature.algorithm !== "ed25519") {
    diagnostics.push(packageDiagnostic("plugin.package.signature.algorithm", "error", `Unsupported plugin package signature algorithm: ${signature.algorithm ?? "missing"}`));
    return result;
  }
  if (typeof signature.value !== "string" || !signature.value.trim()) {
    diagnostics.push(packageDiagnostic("plugin.package.signature.value", "error", "Plugin runtime package signature value is missing."));
    return result;
  }
  if (typeof manifest?.packageSha256 !== "string" || !manifest.packageSha256.trim()) {
    diagnostics.push(packageDiagnostic("plugin.package.signature.payload", "error", "Plugin runtime package hash is missing for signature verification."));
    return result;
  }

  const trustedKey = findTrustedKey(signature, policy.trustedKeys);
  const publicKeyPem = trustedKey?.publicKeyPem ?? signature.publicKeyPem;
  if (!publicKeyPem) {
    diagnostics.push(packageDiagnostic("plugin.package.signature.publicKey.missing", "error", "Plugin runtime package signature has no public key and no matching trusted key."));
    return result;
  }

  try {
    result.verified = crypto.verify(
      null,
      pluginSignaturePayload(manifest.packageSha256),
      crypto.createPublicKey(publicKeyPem),
      Buffer.from(signature.value, "base64"),
    );
  } catch (error) {
    diagnostics.push(packageDiagnostic("plugin.package.signature.invalid", "error", `Unable to verify plugin package signature: ${errorMessage(error)}`));
    return result;
  }

  if (!result.verified) {
    diagnostics.push(packageDiagnostic("plugin.package.signature.invalid", "error", "Plugin runtime package signature does not match the package hash."));
    return result;
  }

  result.trusted = Boolean(trustedKey);
  if (requireTrusted && !result.trusted) {
    diagnostics.push(packageDiagnostic("plugin.package.signature.untrusted", "error", `Plugin runtime package signature key is not trusted: ${signature.keyId ?? "unknown"}`));
  }
  return result;
}

function normalizePluginTrustPolicy(options = {}) {
  const fromPolicy = readTrustPolicyInput(options.trustPolicy ?? options.trustPolicyPath);
  const fromTrustedKeys = readTrustPolicyInput(options.trustedKeys ?? options.trustedKeysPath);
  const policy = fromPolicy && !Array.isArray(fromPolicy) ? fromPolicy : {};
  const trustedKeys = [
    ...normalizeTrustedKeys(policy.trustedKeys ?? policy.keys),
    ...normalizeTrustedKeys(Array.isArray(fromPolicy) ? fromPolicy : null),
    ...normalizeTrustedKeys(Array.isArray(fromTrustedKeys) ? fromTrustedKeys : fromTrustedKeys?.trustedKeys ?? fromTrustedKeys?.keys),
    ...normalizeTrustedKeys(options.trustedKeys),
  ];
  return {
    requireSignature: policy.requireSignature === true,
    requireTrusted: policy.requireTrusted === true,
    trustedKeys,
  };
}

function readTrustPolicyInput(input) {
  if (!input) return null;
  if (typeof input === "string") {
    return JSON.parse(fs.readFileSync(path.resolve(input), "utf8").replace(/^\uFEFF/, ""));
  }
  return input;
}

function normalizeTrustedKeys(value) {
  return arrayValue(value).map((entry) => {
    const publicKeyPem = readPemInput(entry?.publicKeyPem ?? entry?.publicKey, entry?.publicKeyPath);
    return {
      id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : publicKeyPem ? publicKeyFingerprint(publicKeyPem) : "",
      algorithm: entry?.algorithm ?? "ed25519",
      publicKeyPem,
    };
  }).filter((entry) => entry.publicKeyPem);
}

function findTrustedKey(signature, trustedKeys) {
  return trustedKeys.find((entry) => {
    if (entry.algorithm !== "ed25519") return false;
    if (signature.keyId && entry.id === signature.keyId) return true;
    return signature.publicKeyPem && publicKeysEqual(entry.publicKeyPem, signature.publicKeyPem);
  }) ?? null;
}

function readPemInput(pem, filePath) {
  if (typeof pem === "string" && pem.trim()) return pem;
  if (typeof filePath === "string" && filePath.trim()) return fs.readFileSync(path.resolve(filePath), "utf8");
  return null;
}

function publicKeysEqual(left, right) {
  try {
    return publicKeyFingerprint(left) === publicKeyFingerprint(right);
  } catch {
    return false;
  }
}

function publicKeyFingerprint(publicKeyPem) {
  const der = crypto.createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return `ed25519:${crypto.createHash("sha256").update(der).digest("hex")}`;
}

function pluginSignaturePayload(packageSha256) {
  return Buffer.from(`${pluginSignaturePayloadPrefix}\n${packageSha256}\n`, "utf8");
}

function packageDiagnostic(code, severity, message, context = {}) {
  return {
    code,
    severity,
    message,
    context,
  };
}

function hashJson(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function runtimeContributionId(plugin, contribution) {
  return `${plugin.id}/${contribution.id}`;
}

function checkRuntimeId(plugin, contribution, runtimeId, seenRuntimeIds, diagnostics) {
  const lower = runtimeId.toLowerCase();
  if (seenRuntimeIds.has(lower)) {
    diagnostics.push(pluginDiagnostic(plugin, "plugin.runtime.id.duplicate", "error", `Runtime contribution id is duplicated: ${runtimeId}`, {
      contributionId: contribution.id,
      runtimeId,
    }));
  }
  seenRuntimeIds.add(lower);
}

function describeRuntimeFile(filePath, projectRoot, role, plugin, contribution = null) {
  if (!filePath) return null;
  const source = fs.readFileSync(filePath);
  return {
    role,
    filePath,
    virtualPath: normalizeSlashes(path.relative(projectRoot, filePath)),
    bytes: source.byteLength,
    sha256: crypto.createHash("sha256").update(source).digest("hex"),
    pluginId: plugin.id,
    contributionId: contribution?.id ?? null,
  };
}

function publicRuntimeFile(file) {
  if (!file) return null;
  return {
    role: file.role,
    filePath: file.filePath,
    virtualPath: file.virtualPath,
    bytes: file.bytes,
    sha256: file.sha256,
    pluginId: file.pluginId,
    contributionId: file.contributionId,
  };
}

function pushFile(files, file) {
  if (!file) return;
  if (files.some((candidate) => candidate.filePath === file.filePath && candidate.role === file.role && candidate.contributionId === file.contributionId)) return;
  files.push(file);
}

function defaultNameFromContribution(contribution) {
  const text = contribution.label || contribution.title || contribution.id || "PluginWidget";
  const compact = String(text).replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/\s+([A-Za-z0-9])/g, (_, char) => char.toUpperCase());
  return compact ? compact[0].toUpperCase() + compact.slice(1) : "PluginWidget";
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneJsonValue(entry)]));
  }
  return value;
}

function resolvePluginFile(pluginDir, value) {
  const filePath = path.resolve(pluginDir, value);
  const relativePath = normalizeSlashes(path.relative(pluginDir, filePath));
  if (relativePath.startsWith("../") || relativePath === ".." || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      reason: `Plugin file path escapes plugin root: ${value}`,
      relativePath,
    };
  }
  return { ok: true, filePath, relativePath };
}

function walkPluginFiles(dir, result, options, depth = 0) {
  if (depth > options.maxDepth) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipPluginDir(entry.name, fullPath)) continue;
      walkPluginFiles(fullPath, result, options, depth + 1);
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
}

function shouldSkipPluginDir(name, fullPath) {
  const lower = name.toLowerCase();
  if (lower === ".git" || lower === "node_modules") return true;
  const normalized = normalizeSlashes(fullPath).toLowerCase();
  return normalized.includes("/.dzui/history/")
    || normalized.includes("/.dzui/preview-cache/")
    || normalized.includes("/.dzui/engine-preview/")
    || normalized.includes("/.dzui/tmp/")
    || normalized.includes("/.dzui/build/");
}

function capabilitiesFor(contributes) {
  return Object.entries(contributes)
    .filter(([, value]) => value.length > 0)
    .map(([key]) => key)
    .sort();
}

function countPluginContributions(plugins) {
  const counts = emptyContributionCounts();
  for (const plugin of plugins) {
    if (!plugin.enabled) continue;
    for (const key of Object.keys(counts)) counts[key] += plugin.contributes[key]?.length ?? 0;
  }
  return counts;
}

function emptyContributionCounts() {
  return {
    commands: 0,
    widgetPresets: 0,
    panels: 0,
    validators: 0,
  };
}

function pluginDiagnostic(plugin, code, severity, message, context = {}) {
  return {
    code,
    severity,
    message,
    filePath: plugin.manifestPath,
    pluginId: plugin.id || null,
    context,
  };
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function isValidContributionId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(value));
}

function requiredProjectRoot(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("projectRoot is required.");
  return value;
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
