import type { MediaVariantSourceMap } from "@/lib/media/media-model";

export type ContentKind = "gallery" | "news";

export type ContentStatus = "draft" | "published";

export type ContentImageLayout =
  | "align-left"
  | "align-right"
  | "default"
  | "full"
  | "two-column"
  | "wide";

export type ContentImage = {
  alt: string;
  caption?: string;
  createdAt: string;
  height: number;
  id: string;
  isCover: boolean;
  isDetail: boolean;
  isListImage: boolean;
  isReserved: boolean;
  layout: ContentImageLayout;
  sortOrder: number;
  src: string;
  storagePath: string;
  updatedAt: string;
  variants?: MediaVariantSourceMap;
  width: number;
};

export type ContentEntry = {
  body: unknown;
  bodyText: string;
  createdAt: string;
  displayDate?: string;
  id: string;
  images: ContentImage[];
  kind: ContentKind;
  publishedAt?: string | null;
  relatedProductSlug?: string | null;
  slug: string;
  status: ContentStatus;
  summary: string;
  title: string;
  updatedAt: string;
};

export type ContentEntryListItem = Omit<ContentEntry, "body">;

export type ContentEntryDraftInput = {
  kind: ContentKind;
  slug: string;
  title: string;
};

export type ContentImageUpdateInput = {
  alt: string;
  caption?: string;
  id: string;
  isCover: boolean;
  isDetail: boolean;
  isListImage: boolean;
  isReserved: boolean;
  layout: ContentImageLayout;
  sortOrder: number;
};

export type ContentEntryUpdateInput = {
  body: unknown;
  bodyText: string;
  displayDate?: string;
  images: ContentImageUpdateInput[];
  relatedProductSlug?: string | null;
  slug: string;
  status: ContentStatus;
  summary: string;
  title: string;
};

export type ContentImageUploadInput = {
  alt: string;
  caption?: string;
  entryId: string;
  height: number;
  layout?: ContentImageLayout;
  src: string;
  storagePath: string;
  width: number;
};
