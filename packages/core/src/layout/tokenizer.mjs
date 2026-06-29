const TOKEN_BRACE_OPEN = "braceOpen";
const TOKEN_BRACE_CLOSE = "braceClose";
const TOKEN_COMMENT = "comment";
const TOKEN_IDENTIFIER = "identifier";
const TOKEN_NEWLINE = "newline";
const TOKEN_NUMBER = "number";
const TOKEN_STRING = "string";

export const layoutTokenTypes = Object.freeze({
  braceOpen: TOKEN_BRACE_OPEN,
  braceClose: TOKEN_BRACE_CLOSE,
  comment: TOKEN_COMMENT,
  identifier: TOKEN_IDENTIFIER,
  newline: TOKEN_NEWLINE,
  number: TOKEN_NUMBER,
  string: TOKEN_STRING,
});

export function tokenizeLayout(source) {
  const tokens = [];
  let offset = 0;
  let line = 1;
  let column = 1;

  function push(type, start, end, startLine, startColumn, value = source.slice(start, end)) {
    tokens.push({
      type,
      value,
      raw: source.slice(start, end),
      start,
      end,
      line: startLine,
      column: startColumn,
    });
  }

  function advance(text) {
    for (const char of text) {
      offset += 1;
      if (char === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
  }

  while (offset < source.length) {
    const char = source[offset];
    const start = offset;
    const startLine = line;
    const startColumn = column;

    if (char === "\r" || char === "\n") {
      const raw = char === "\r" && source[offset + 1] === "\n" ? "\r\n" : char;
      advance(raw);
      push(TOKEN_NEWLINE, start, offset, startLine, startColumn, raw);
      continue;
    }

    if (char === " " || char === "\t" || char === "\f" || char === "\v") {
      advance(char);
      continue;
    }

    if (char === "/" && source[offset + 1] === "/") {
      let end = offset + 2;
      while (end < source.length && source[end] !== "\r" && source[end] !== "\n") end += 1;
      const raw = source.slice(offset, end);
      advance(raw);
      push(TOKEN_COMMENT, start, offset, startLine, startColumn, raw);
      continue;
    }

    if (char === "/" && source[offset + 1] === "*") {
      let end = offset + 2;
      while (end < source.length && !(source[end] === "*" && source[end + 1] === "/")) end += 1;
      end = Math.min(source.length, end + 2);
      const raw = source.slice(offset, end);
      advance(raw);
      push(TOKEN_COMMENT, start, offset, startLine, startColumn, raw);
      continue;
    }

    if (char === "{") {
      advance(char);
      push(TOKEN_BRACE_OPEN, start, offset, startLine, startColumn, char);
      continue;
    }

    if (char === "}") {
      advance(char);
      push(TOKEN_BRACE_CLOSE, start, offset, startLine, startColumn, char);
      continue;
    }

    if (char === "\"") {
      let end = offset + 1;
      let escaped = false;
      while (end < source.length) {
        const current = source[end];
        if (escaped) {
          escaped = false;
        } else if (current === "\\") {
          escaped = true;
        } else if (current === "\"") {
          end += 1;
          break;
        }
        end += 1;
      }

      const raw = source.slice(offset, end);
      advance(raw);
      push(TOKEN_STRING, start, offset, startLine, startColumn, decodeLayoutString(raw));
      continue;
    }

    let end = offset;
    while (end < source.length) {
      const current = source[end];
      if (
        current === "{"
        || current === "}"
        || current === "\""
        || current === "\r"
        || current === "\n"
        || current === " "
        || current === "\t"
        || current === "\f"
        || current === "\v"
      ) {
        break;
      }
      if (current === "/" && (source[end + 1] === "/" || source[end + 1] === "*")) break;
      end += 1;
    }

    const raw = source.slice(offset, end);
    advance(raw);
    push(isNumberLike(raw) ? TOKEN_NUMBER : TOKEN_IDENTIFIER, start, offset, startLine, startColumn, raw);
  }

  return tokens;
}

function decodeLayoutString(raw) {
  if (!raw.startsWith("\"")) return raw;
  const body = raw.endsWith("\"") ? raw.slice(1, -1) : raw.slice(1);
  return body.replace(/\\(["\\nrt])/g, (_, escaped) => {
    if (escaped === "n") return "\n";
    if (escaped === "r") return "\r";
    if (escaped === "t") return "\t";
    return escaped;
  });
}

function isNumberLike(value) {
  return /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value);
}
