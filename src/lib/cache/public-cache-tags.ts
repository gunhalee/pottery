import type { ContentKind } from "@/lib/content-manager/content-model";

export const publicCacheTags = {
  content: "public:content",
  contentKind: (kind: ContentKind) => `public:content:${kind}`,
  products: "public:products",
} as const;
