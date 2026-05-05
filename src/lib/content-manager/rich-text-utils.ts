type LexicalNodeRecord = {
  alt?: unknown;
  caption?: unknown;
  children?: unknown;
  src?: unknown;
  text?: unknown;
  title?: unknown;
  type?: unknown;
  url?: unknown;
  videoId?: unknown;
};

export function extractPlainTextFromLexicalJson(body: unknown) {
  const lines: string[] = [];
  const root = getRootNode(body);

  for (const child of getChildren(root)) {
    const text = extractNodeText(child).trim();

    if (text) {
      lines.push(text);
    }
  }

  return lines.join("\n").trim();
}

export function hasInstagramNode(body: unknown) {
  return walkLexicalNodes(body).some((node) => node.type === "instagram");
}

export function walkLexicalNodes(body: unknown) {
  const root = getRootNode(body);
  const nodes: LexicalNodeRecord[] = [];

  function walk(node: unknown) {
    if (!isNodeRecord(node)) {
      return;
    }

    nodes.push(node);

    for (const child of getChildren(node)) {
      walk(child);
    }
  }

  walk(root);
  return nodes;
}

function extractNodeText(node: unknown): string {
  if (!isNodeRecord(node)) {
    return "";
  }

  if (typeof node.text === "string") {
    return node.text;
  }

  if (node.type === "content-image") {
    return [node.caption, node.alt].filter(isNonEmptyString).join(" ");
  }

  if (node.type === "youtube") {
    return isNonEmptyString(node.url) ? node.url : "";
  }

  if (node.type === "instagram") {
    return isNonEmptyString(node.url) ? node.url : "";
  }

  return getChildren(node).map(extractNodeText).join("");
}

function getRootNode(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "root" in body &&
    isNodeRecord(body.root)
  ) {
    return body.root;
  }

  return null;
}

function getChildren(node: unknown) {
  if (!isNodeRecord(node) || !Array.isArray(node.children)) {
    return [];
  }

  return node.children;
}

function isNodeRecord(value: unknown): value is LexicalNodeRecord {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
