import path from "node:path";

export function normalizeSlashes(value) {
  return value.replaceAll("\\", "/");
}

export function relativeVirtual(root, filePath) {
  return normalizeSlashes(path.relative(root, filePath));
}

export function normalizeVirtualRef(value) {
  let normalized = normalizeSlashes(String(value).trim().replace(/^"|"$/g, ""));
  normalized = normalized.replace(/^\{[0-9a-fA-F]+\}/, "");
  const marker = "/ClientMods/";
  const markerIndex = normalized.toLowerCase().indexOf(marker.toLowerCase());
  if (markerIndex >= 0) {
    normalized = normalized.slice(markerIndex + marker.length);
  }
  return normalized.replace(/^\/+/, "");
}
