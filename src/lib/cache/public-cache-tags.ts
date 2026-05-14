import type { ContentKind } from "@/lib/content-manager/content-model";

export const publicCacheTags = {
  content: "public:content",
  contentKind: (kind: ContentKind) => `public:content:${kind}`,
  naverBlog: "public:naver-blog",
  products: "public:products",
} as const;
