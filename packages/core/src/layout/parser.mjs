import { layoutTokenTypes, tokenizeLayout } from "./tokenizer.mjs";

const NAME_TOKEN_TYPES = new Set([
  layoutTokenTypes.identifier,
  layoutTokenTypes.string,
]);

export function parseLayout(source, options = {}) {
  const parser = new LayoutParser(source, tokenizeLayout(source), options);
  return parser.parseDocument();
}

export function serializeLayout(document) {
  return document.source;
}

export function walkWidgets(documentOrNode) {
  const roots = documentOrNode.kind === "LayoutDocument" ? documentOrNode.roots : [documentOrNode];
  const result = [];

  function visit(node, depth) {
    result.push({ node, depth });
    for (const child of node.children) visit(child, depth + 1);
  }

  for (const root of roots) visit(root, 0);
  return result;
}

export function getProperty(node, key) {
  const normalizedKey = key.toLowerCase();
  return node.props.find((prop) => prop.key.toLowerCase() === normalizedKey) ?? null;
}

export function getProperties(node, key) {
  const normalizedKey = key.toLowerCase();
  return node.props.filter((prop) => prop.key.toLowerCase() === normalizedKey);
}

export function summarizeLayout(document) {
  const widgets = walkWidgets(document);
  const props = widgets.reduce((count, entry) => count + entry.node.props.length, 0);
  const imageRefs = [];

  for (const { node } of widgets) {
    for (const prop of node.props) {
      if (/^image\d*$/i.test(prop.key) && prop.values.length > 0) {
        imageRefs.push({
          widget: node.name,
          widgetType: node.typeClass,
          key: prop.key,
          ref: prop.values.map((value) => value.value).join(" "),
          line: prop.line,
        });
      }
    }
  }

  return {
    filePath: document.filePath,
    rootCount: document.roots.length,
    widgetCount: widgets.length,
    propertyCount: props,
    imageRefCount: imageRefs.length,
    imageRefs,
    diagnostics: document.diagnostics,
  };
}

export function layoutToPlainObject(document, options = {}) {
  const includeSource = options.includeSource === true;
  const includeTokens = options.includeTokens === true;

  return {
    kind: document.kind,
    filePath: document.filePath,
    roots: document.roots.map((root) => widgetToPlainObject(root)),
    diagnostics: document.diagnostics,
    ...(includeSource ? { source: document.source } : {}),
    ...(includeTokens ? { tokens: document.tokens } : {}),
  };
}

function widgetToPlainObject(node) {
  return {
    kind: node.kind,
    typeClass: node.typeClass,
    name: node.name,
    line: node.line,
    column: node.column,
    span: node.span,
    bodySpan: node.bodySpan,
    props: node.props.map((prop) => ({
      kind: prop.kind,
      key: prop.key,
      values: prop.values,
      line: prop.line,
      column: prop.column,
      span: prop.span,
      raw: prop.raw,
    })),
    children: node.children.map((child) => widgetToPlainObject(child)),
  };
}

class LayoutParser {
  constructor(source, tokens, options) {
    this.source = source;
    this.tokens = tokens;
    this.filePath = options.filePath ?? null;
    this.index = 0;
    this.diagnostics = [];
  }

  parseDocument() {
    const roots = [];
    this.skipTrivia();

    while (!this.isEof()) {
      if (this.isWidgetStart()) {
        roots.push(this.parseWidget());
      } else {
        const token = this.peek();
        this.addDiagnostic(
          "layout.unexpected-token",
          `Expected widget declaration, found ${token?.raw ?? "end of file"}.`,
          token,
        );
        this.recoverToNextLineOrClose();
      }
      this.skipTrivia();
    }

    return {
      kind: "LayoutDocument",
      filePath: this.filePath,
      source: this.source,
      tokens: this.tokens,
      roots,
      diagnostics: this.diagnostics,
      span: { start: 0, end: this.source.length },
    };
  }

  parseWidget() {
    const typeToken = this.consume();
    const nameToken = this.consume();
    this.skipInlineComments();
    const openToken = this.consumeIf(layoutTokenTypes.braceOpen);

    if (!openToken) {
      this.addDiagnostic(
        "layout.widget.missing-open-brace",
        `Widget ${tokenValue(typeToken)} ${tokenValue(nameToken)} is missing an opening brace.`,
        this.peek() ?? nameToken,
      );
    }

    const node = {
      kind: "WidgetNode",
      typeClass: tokenValue(typeToken),
      name: tokenValue(nameToken),
      line: typeToken.line,
      column: typeToken.column,
      span: { start: typeToken.start, end: nameToken.end },
      bodySpan: openToken ? { start: openToken.end, end: openToken.end } : null,
      props: [],
      children: [],
      childGroups: [],
    };

    if (!openToken) return node;

    const closeToken = this.parseWidgetBody(node, openToken);
    const end = closeToken?.end ?? this.source.length;
    node.span = { start: typeToken.start, end };
    node.bodySpan = { start: openToken.end, end: closeToken?.start ?? end };
    return node;
  }

  parseWidgetBody(node, openToken) {
    while (!this.isEof()) {
      this.skipTrivia();
      const token = this.peek();
      if (!token) break;

      if (token.type === layoutTokenTypes.braceClose) {
        return this.consume();
      }

      if (token.type === layoutTokenTypes.braceOpen) {
        this.parseChildGroup(node);
        continue;
      }

      if (this.isWidgetStart()) {
        node.children.push(this.parseWidget());
        continue;
      }

      if (isNameToken(token)) {
        node.props.push(this.parseProperty());
        continue;
      }

      this.addDiagnostic(
        "layout.widget-body.unexpected-token",
        `Unexpected token in widget body: ${token.raw}.`,
        token,
      );
      this.recoverToNextLineOrClose();
    }

    this.addDiagnostic(
      "layout.widget.missing-close-brace",
      `Widget ${node.typeClass} ${node.name} opened here was not closed.`,
      openToken,
    );
    return null;
  }

  parseChildGroup(parent) {
    const openToken = this.consume();
    const childGroup = {
      kind: "ChildGroup",
      span: { start: openToken.start, end: openToken.end },
      children: [],
    };

    while (!this.isEof()) {
      this.skipTrivia();
      const token = this.peek();
      if (!token) break;

      if (token.type === layoutTokenTypes.braceClose) {
        const closeToken = this.consume();
        childGroup.span.end = closeToken.end;
        parent.childGroups.push(childGroup);
        return;
      }

      if (this.isWidgetStart()) {
        const child = this.parseWidget();
        childGroup.children.push(child);
        parent.children.push(child);
        continue;
      }

      this.addDiagnostic(
        "layout.child-group.expected-widget",
        `Expected child widget declaration, found ${token.raw}.`,
        token,
      );
      this.recoverToNextLineOrClose();
    }

    this.addDiagnostic(
      "layout.child-group.missing-close-brace",
      "Child widget group was not closed.",
      openToken,
    );
    parent.childGroups.push(childGroup);
  }

  parseProperty() {
    const keyToken = this.consume();
    const valueTokens = [];

    while (!this.isEof()) {
      const token = this.peek();
      if (!token) break;
      if (token.type === layoutTokenTypes.newline || token.type === layoutTokenTypes.braceClose) break;
      if (token.type === layoutTokenTypes.comment) break;
      if (token.type === layoutTokenTypes.braceOpen) break;
      valueTokens.push(this.consume());
    }

    const lastToken = valueTokens[valueTokens.length - 1] ?? keyToken;
    return {
      kind: "Property",
      key: tokenValue(keyToken),
      values: valueTokens.map((token) => ({
        type: token.type,
        value: tokenValue(token),
        raw: token.raw,
        span: { start: token.start, end: token.end },
      })),
      tokens: [keyToken, ...valueTokens],
      line: keyToken.line,
      column: keyToken.column,
      span: { start: keyToken.start, end: lastToken.end },
      raw: this.source.slice(keyToken.start, lastToken.end),
    };
  }

  isWidgetStart() {
    const first = this.peekSameLine(this.index);
    if (!isNameToken(first)) return false;

    const second = this.peekSameLine(first.index + 1);
    if (!isNameToken(second)) return false;

    const third = this.peekSameLine(second.index + 1);
    return third?.type === layoutTokenTypes.braceOpen;
  }

  peekSameLine(startIndex) {
    for (let index = startIndex; index < this.tokens.length; index += 1) {
      const token = this.tokens[index];
      if (token.type === layoutTokenTypes.newline) return null;
      if (token.type === layoutTokenTypes.comment) continue;
      return { ...token, index };
    }
    return null;
  }

  skipTrivia() {
    while (!this.isEof()) {
      const token = this.peek();
      if (token.type !== layoutTokenTypes.newline && token.type !== layoutTokenTypes.comment) break;
      this.index += 1;
    }
  }

  skipInlineComments() {
    while (!this.isEof()) {
      const token = this.peek();
      if (token.type !== layoutTokenTypes.comment) break;
      this.index += 1;
    }
  }

  recoverToNextLineOrClose() {
    while (!this.isEof()) {
      const token = this.peek();
      if (token.type === layoutTokenTypes.newline) {
        this.index += 1;
        return;
      }
      if (token.type === layoutTokenTypes.braceClose) return;
      this.index += 1;
    }
  }

  addDiagnostic(code, message, token) {
    this.diagnostics.push({
      code,
      message,
      filePath: this.filePath,
      line: token?.line ?? null,
      column: token?.column ?? null,
      span: token ? { start: token.start, end: token.end } : null,
    });
  }

  consume() {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  consumeIf(type) {
    if (this.peek()?.type !== type) return null;
    return this.consume();
  }

  peek() {
    return this.tokens[this.index] ?? null;
  }

  isEof() {
    return this.index >= this.tokens.length;
  }
}

function isNameToken(token) {
  return Boolean(token && NAME_TOKEN_TYPES.has(token.type));
}

function tokenValue(token) {
  if (!token) return "";
  return token.value;
}
