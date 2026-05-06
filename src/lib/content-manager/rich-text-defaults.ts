export const emptyRichTextBody = createParagraphBody("");

export function createParagraphBody(text: string) {
  return {
    root: {
      children: [
        {
          children: text
            ? [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text,
                  type: "text",
                  version: 1,
                },
              ]
            : [],
          direction: null,
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
          type: "paragraph",
          version: 1,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

export function normalizeRichTextBody(body: unknown, fallbackText = "") {
  if (!hasNonEmptyLexicalRoot(body)) {
    return createParagraphBody(fallbackText);
  }

  return body;
}

function hasNonEmptyLexicalRoot(body: unknown) {
  if (typeof body !== "object" || body === null || !("root" in body)) {
    return false;
  }

  const root = body.root;

  if (typeof root !== "object" || root === null || !("children" in root)) {
    return false;
  }

  return Array.isArray(root.children) && root.children.length > 0;
}
