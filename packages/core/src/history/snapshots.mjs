import crypto from "node:crypto";

export function createSourceSnapshot({ filePath = null, source, label = null }) {
  const createdAt = new Date().toISOString();
  const hash = hashSource(source);
  return {
    id: `${createdAt}:${hash.slice(0, 12)}`,
    filePath,
    label,
    hash,
    source,
    createdAt,
  };
}

export function createEditTransaction({ filePath = null, beforeSource, afterSource, edit, label = null }) {
  return {
    id: crypto.randomUUID(),
    filePath,
    label,
    before: createSourceSnapshot({ filePath, source: beforeSource, label: "before" }),
    after: createSourceSnapshot({ filePath, source: afterSource, label: "after" }),
    edit,
    createdAt: new Date().toISOString(),
  };
}

export function undoTransaction(transaction) {
  return {
    source: transaction.before.source,
    restoredHash: transaction.before.hash,
  };
}

export function redoTransaction(transaction) {
  return {
    source: transaction.after.source,
    restoredHash: transaction.after.hash,
  };
}

export function hashSource(source) {
  return crypto.createHash("sha1").update(source).digest("hex");
}
