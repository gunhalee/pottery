import type { ContentImageLayout } from "@/lib/content-manager/content-model";

export const imageLayoutOptions: Array<{
  label: string;
  value: ContentImageLayout;
}> = [
  { label: "기본폭", value: "default" },
  { label: "넓게", value: "wide" },
  { label: "전체폭", value: "full" },
  { label: "2열", value: "two-column" },
  { label: "좌측", value: "align-left" },
  { label: "우측", value: "align-right" },
];

export const editorTheme = {
  code: "lexical-code",
  heading: {
    h2: "lexical-heading lexical-heading-h2",
    h3: "lexical-heading lexical-heading-h3",
  },
  link: "lexical-link",
  list: {
    listitem: "lexical-list-item",
    nested: {
      listitem: "lexical-nested-list-item",
    },
    ol: "lexical-list lexical-list-ordered",
    ul: "lexical-list",
  },
  paragraph: "lexical-paragraph",
  quote: "lexical-quote",
  text: {
    bold: "lexical-text-bold",
    code: "lexical-text-code",
    italic: "lexical-text-italic",
    strikethrough: "lexical-text-strikethrough",
    underline: "lexical-text-underline",
  },
} as const;
