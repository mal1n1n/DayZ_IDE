import path from "node:path";

import { normalizeVirtualRef } from "../project/path-utils.mjs";

export function parseEddsMeta(content, filePath) {
  const name = content.match(/\bName\s+"([^"]+)"/)?.[1] ?? null;
  const sourceFile = content.match(/\bSourceFile\s+"([^"]+)"/)?.[1] ?? null;
  const normalizedName = name ? normalizeVirtualRef(name) : null;
  const sourcePath = sourceFile ? path.resolve(path.dirname(filePath), sourceFile) : null;
  return { name, normalizedName, sourceFile, sourcePath };
}
