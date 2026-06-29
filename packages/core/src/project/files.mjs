import fs from "node:fs";
import path from "node:path";

export const supportedProjectExtensions = new Set([
  ".layout",
  ".imageset",
  ".styles",
  ".edds",
  ".paa",
  ".png",
  ".tga",
  ".csv",
  ".fnt",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".cpp",
  ".c",
  ".meta",
]);

export function walkFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

export function findInterestingFiles(root, extensions = supportedProjectExtensions) {
  return walkFiles(root).filter((filePath) => extensions.has(path.extname(filePath).toLowerCase()));
}

export function countByExtension(files) {
  const counts = new Map();
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase() || "(none)";
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}
