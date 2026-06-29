import fs from "node:fs";
import path from "node:path";

import { relativeVirtual } from "../project/path-utils.mjs";

export function scanScriptContent(content, options = {}) {
  const filePath = options.filePath ?? null;
  const virtualPath = options.virtualPath ?? filePath;
  const refs = {
    createWidgets: [],
    findWidgets: [],
    setText: [],
    loadImages: [],
    assetStrings: [],
  };
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    for (const match of line.matchAll(/CreateWidgets\s*\(\s*"([^"]+)"/g)) {
      refs.createWidgets.push(refEntry(match[1], filePath, virtualPath, lineNumber));
    }
    for (const match of line.matchAll(/FindAnyWidget\s*\(\s*"([^"]+)"/g)) {
      refs.findWidgets.push(refEntry(match[1], filePath, virtualPath, lineNumber));
    }
    for (const match of line.matchAll(/SetText\s*\(\s*"(#STR_[^"]+)"/g)) {
      refs.setText.push(refEntry(match[1], filePath, virtualPath, lineNumber));
    }
    for (const match of line.matchAll(/LoadImageFile\s*\([^,]+,\s*"([^"]+)"/g)) {
      refs.loadImages.push(refEntry(match[1], filePath, virtualPath, lineNumber));
    }
    for (const match of line.matchAll(/"([^"]+\.(?:layout|edds|paa|png|tga))"/gi)) {
      refs.assetStrings.push(refEntry(match[1], filePath, virtualPath, lineNumber));
    }
  }

  return {
    filePath,
    virtualPath,
    refs,
  };
}

export function buildScriptIndex(root, files) {
  const scripts = [];
  const refs = {
    createWidgets: [],
    findWidgets: [],
    setText: [],
    loadImages: [],
    assetStrings: [],
  };

  for (const filePath of files.filter((candidate) => [".c", ".cpp"].includes(path.extname(candidate).toLowerCase()))) {
    const script = scanScriptContent(fs.readFileSync(filePath, "utf8"), {
      filePath,
      virtualPath: relativeVirtual(root, filePath),
    });
    scripts.push(script);
    for (const key of Object.keys(refs)) refs[key].push(...script.refs[key]);
  }

  return {
    scripts,
    refs,
  };
}

function refEntry(ref, filePath, virtualPath, line) {
  return { ref, filePath, virtualPath, line };
}
