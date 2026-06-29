import fs from "node:fs";
import path from "node:path";

import { relativeVirtual } from "../project/path-utils.mjs";

export function parseStringTableCsv(content, options = {}) {
  const rows = parseCsv(content);
  if (rows.length === 0) {
    return {
      filePath: options.filePath ?? null,
      virtualPath: options.virtualPath ?? null,
      columns: [],
      entries: [],
      byKey: new Map(),
      diagnostics: [],
    };
  }

  const columns = rows[0].map((value) => value.trim());
  const keyIndex = findKeyColumn(columns);
  const diagnostics = [];
  const entries = [];
  const byKey = new Map();

  if (keyIndex < 0) {
    diagnostics.push({
      code: "stringtable.missing-key-column",
      severity: "error",
      message: "Stringtable CSV is missing a key column.",
      filePath: options.filePath ?? null,
      line: 1,
      column: 1,
    });
  }

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.every((value) => value.trim() === "")) continue;
    const rawKey = keyIndex >= 0 ? row[keyIndex]?.trim() : row[0]?.trim();
    if (!rawKey) continue;
    const key = normalizeStringKey(rawKey);
    const values = {};
    for (let index = 0; index < columns.length; index += 1) {
      if (index === keyIndex) continue;
      const column = columns[index] || `column_${index}`;
      values[column] = row[index] ?? "";
    }
    const entry = {
      key,
      rawKey,
      values,
      line: rowIndex + 1,
    };
    entries.push(entry);
    byKey.set(key.toLowerCase(), entry);
    byKey.set(`#${key}`.toLowerCase(), entry);
  }

  return {
    filePath: options.filePath ?? null,
    virtualPath: options.virtualPath ?? null,
    columns,
    entries,
    byKey,
    diagnostics,
  };
}

export function updateStringTableCsv(content, update) {
  const rows = parseCsv(content);
  const columns = rows[0]?.length ? rows[0] : ["Key", "English"];
  const keyIndex = findKeyColumn(columns);
  const effectiveKeyIndex = keyIndex >= 0 ? keyIndex : 0;
  const key = normalizeStringKey(required(update.key, "key"));
  const values = update.values ?? {};
  const nextRows = rows.length ? rows.map((row) => [...row]) : [columns];
  let inserted = false;
  let rowIndex = nextRows.findIndex((row, index) => {
    if (index === 0) return false;
    return normalizeStringKey(row[effectiveKeyIndex] ?? "").toLowerCase() === key.toLowerCase();
  });

  if (rowIndex < 0) {
    const row = new Array(columns.length).fill("");
    row[effectiveKeyIndex] = key;
    nextRows.push(row);
    rowIndex = nextRows.length - 1;
    inserted = true;
  }

  for (const [column, value] of Object.entries(values)) {
    let columnIndex = columns.findIndex((candidate) => candidate.toLowerCase() === column.toLowerCase());
    if (columnIndex < 0) {
      columns.push(column);
      for (const row of nextRows) row.push("");
      columnIndex = columns.length - 1;
    }
    nextRows[rowIndex][columnIndex] = String(value);
  }

  nextRows[0] = columns;
  return {
    source: serializeCsv(nextRows),
    key,
    row: nextRows[rowIndex],
    inserted,
  };
}

export function stringTableToGrid(table) {
  const keyIndex = findKeyColumn(table.columns);
  const effectiveKeyIndex = keyIndex >= 0 ? keyIndex : 0;
  const valueColumns = table.columns.filter((_, index) => index !== effectiveKeyIndex);
  return {
    filePath: table.filePath,
    virtualPath: table.virtualPath,
    keyColumn: table.columns[effectiveKeyIndex] ?? "Key",
    columns: valueColumns,
    rows: table.entries.map((entry) => ({
      key: entry.key,
      rawKey: entry.rawKey,
      line: entry.line,
      values: Object.fromEntries(valueColumns.map((column) => [column, entry.values[column] ?? ""])),
    })),
    diagnostics: table.diagnostics,
  };
}

export function localizeStringValue(value, stringTable, language = "English") {
  const text = String(value ?? "");
  if (!text.startsWith("#") || !stringTable) return text;
  const entry = stringTable.get(text) ?? stringTable.get(text.slice(1));
  if (!entry) return text;
  return entry.values?.[language]
    || entry.values?.English
    || Object.values(entry.values ?? {}).find((candidate) => candidate)
    || text;
}

export function buildStringTableIndex(root, files) {
  const tables = [];
  const byKey = new Map();
  const diagnostics = [];

  for (const filePath of files.filter((candidate) => path.basename(candidate).toLowerCase() === "stringtable.csv")) {
    const table = parseStringTableCsv(fs.readFileSync(filePath, "utf8"), {
      filePath,
      virtualPath: relativeVirtual(root, filePath),
    });
    tables.push(table);
    diagnostics.push(...table.diagnostics);
    for (const [key, entry] of table.byKey) {
      byKey.set(key, {
        ...entry,
        filePath,
        virtualPath: table.virtualPath,
      });
    }
  }

  return {
    tables,
    byKey,
    diagnostics,
    has(key) {
      return byKey.has(normalizeStringKey(key).toLowerCase()) || byKey.has(String(key).toLowerCase());
    },
    get(key) {
      return byKey.get(normalizeStringKey(key).toLowerCase()) ?? byKey.get(String(key).toLowerCase()) ?? null;
    },
  };
}

export function normalizeStringKey(key) {
  return String(key).trim().replace(/^#/, "");
}

function findKeyColumn(columns) {
  return columns.findIndex((column) => {
    const normalized = column.trim().toLowerCase();
    return normalized === "key" || normalized === "id" || normalized === "stringid" || normalized === "string_id";
  });
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
    } else if (char === "\n" || char === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function serializeCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvField).join(",")).join("\n")}\n`;
}

function escapeCsvField(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}
