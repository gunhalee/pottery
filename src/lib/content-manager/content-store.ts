import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { publicCacheTags } from "@/lib/cache/public-cache-tags";
import type { MediaUsage } from "@/lib/media/media-model";
import { getContentImageUsageRoles } from "@/lib/media/media-role-requirements";
import {
  deleteMediaUsagesForAsset,
  readMediaUsagesByOwner,
} from "@/lib/media/media-store";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { getSupabasePublicReadClient } from "@/lib/supabase/read-client";
import {
  parseContentEntryListRows,
  parseContentEntryRows,
  parseContentSlugRows,
  type ContentEntryListRow,
  type ContentEntryRow,
} from "./content-store-rows";
import {
  createParagraphBody,
  normalizeRichTextBody,
} from "./rich-text-defaults";
import { walkLexicalNodes } from "./rich-text-utils";
import type {
  ContentEntry,
  ContentEntryDraftInput,
  ContentEntryListItem,
  ContentEntryUpdateInput,
  ContentImageUpdateInput,
  ContentKind,
} from "./content-model";
import { createContentImagesFromMediaUsages } from "./content-images";

type ContentEntryQueryOptions = {
  id?: string;
  kind?: ContentKind;
  limit?: number;
  relatedProductSlug?: string;
  slug?: string;
  status?: "draft" | "published";
};

const imageLayoutSchema = z.enum([
  "align-left",
  "align-right",
  "default",
  "full",
  "two-column",
  "wide",
]);

const imageVariantSourceSchema = z.object({
  height: z.number().int().positive(),
  src: z.string().min(1),
  storagePath: z.string().optional(),
  variant: z.enum(["detail", "list", "master", "thumbnail"]),
  width: z.number().int().positive(),
});

const imageVariantsSchema = z
  .object({
    detail: imageVariantSourceSchema.optional(),
    list: imageVariantSourceSchema.optional(),
    master: imageVariantSourceSchema.optional(),
    thumbnail: imageVariantSourceSchema.optional(),
  })
  .optional();

const imageSchema = z.object({
  alt: z.string(),
  caption: z.string().optional(),
  createdAt: z.string(),
  height: z.number().int().positive(),
  id: z.string().min(1),
  isCover: z.boolean().default(false),
  isDetail: z.boolean().default(false),
  isListImage: z.boolean().default(false),
  isReserved: z.boolean().default(false),
  layout: imageLayoutSchema,
  sortOrder: z.number().int().nonnegative(),
  src: z.string().min(1),
  storagePath: z.string().min(1),
  updatedAt: z.string(),
  variants: imageVariantsSchema,
  width: z.number().int().positive(),
});

const entrySchema = z.object({
  body: z.unknown(),
  bodyText: z.string(),
  createdAt: z.string(),
  displayDate: z.string().optional(),
  id: z.string().min(1),
  images: z.array(imageSchema),
  kind: z.enum(["gallery", "news"]),
  publishedAt: z.string().nullable().optional(),
  relatedProductSlug: z.string().nullable().optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(["draft", "published"]),
  summary: z.string(),
  title: z.string().min(1),
  updatedAt: z.string(),
});

const entryListItemSchema = entrySchema.omit({ body: true });
const entryListSchema = z.array(entrySchema);
const publishedEntryListSchema = z.array(entryListItemSchema);

export function normalizeContentSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createGeneratedContentSlug(prefix = "content") {
  return `${prefix}-${Date.now().toString(36)}`;
}

export async function readContentEntries(kind?: ContentKind) {
  requireContentSupabaseStore();
  return readEntriesFromSupabase({ kind });
}

export async function getPublishedContentEntries(kind: ContentKind) {
  return kind === "gallery"
    ? readPublishedGalleryEntriesCached()
    : readPublishedNewsEntriesCached();
}

export async function getPublishedContentListEntries(
  kind: ContentKind,
  options: { limit?: number; relatedProductSlug?: string } = {},
) {
  return readPublishedContentListEntriesCached(
    kind,
    options.relatedProductSlug ?? null,
    options.limit ?? null,
  );
}

export async function getContentEntryById(id: string) {
  requireContentSupabaseStore();
  return readContentEntryByIdFromSupabase(id);
}

export async function getContentEntryBySlug(kind: ContentKind, slug: string) {
  return readPublishedContentEntryBySlugCached(kind, slug);
}

export async function getContentEntryPreviewBySlug(
  kind: ContentKind,
  slug: string,
) {
  requireContentSupabaseStore();
  const entries = await readEntriesFromSupabase({ kind, limit: 1, slug });
  return entries[0] ?? null;
}

export async function getPublishedContentSlugs(kind: ContentKind) {
  return readPublishedContentSlugsCached(kind);
}

export async function createContentDraft(input: ContentEntryDraftInput) {
  requireContentSupabaseStore();

  const now = new Date().toISOString();
  const title = input.title.trim();
  const normalizedSlug = normalizeContentSlug(input.slug || title);
  const slug =
    normalizedSlug || createGeneratedContentSlug(`${input.kind}-draft`);

  const entry = entrySchema.parse({
    body: createParagraphBody(""),
    bodyText: "",
    createdAt: now,
    id: randomUUID(),
    images: [],
    kind: input.kind,
    publishedAt: null,
    relatedProductSlug: null,
    slug,
    status: "draft",
    summary: "",
    title,
    updatedAt: now,
  });

  await assertUniqueContentSlug(entry.kind, entry.slug);

  return createEntryInSupabase(entry);
}

export async function updateContentEntry(
  id: string,
  input: ContentEntryUpdateInput,
) {
  requireContentSupabaseStore();
  return updateEntryInSupabase(id, input);
}

export async function deleteContentEntry(id: string) {
  const entry = await getContentEntryById(id);

  if (!entry) {
    throw new Error("콘텐츠를 찾을 수 없습니다.");
  }

  return deleteEntryInSupabase(entry);
}

export async function deleteContentImage(entryId: string, imageId: string) {
  const entry = await getContentEntryById(entryId);

  if (!entry) {
    throw new Error("콘텐츠를 찾을 수 없습니다.");
  }

  const image = entry.images.find((item) => item.id === imageId);

  if (!image) {
    throw new Error("이미지를 찾을 수 없습니다.");
  }

  await deleteMediaUsagesForAsset("content_entry", entryId, imageId);
}

export function getContentKindLabel(kind: ContentKind) {
  return kind === "news" ? "소식" : "작업물";
}

export function getContentAdminPath(kind: ContentKind) {
  return kind === "news" ? "/admin/news" : "/admin/gallery";
}

export function getContentPublicPath(kind: ContentKind) {
  return kind === "news" ? "/news" : "/gallery";
}

function requireContentSupabaseStore() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 콘텐츠 저장소가 구성되지 않았습니다.");
  }
}

const readPublishedGalleryEntriesCached = unstable_cache(
  () => readPublishedEntries("gallery"),
  ["published-content", "gallery"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.content, publicCacheTags.contentKind("gallery")],
  },
);

const readPublishedNewsEntriesCached = unstable_cache(
  () => readPublishedEntries("news"),
  ["published-content", "news"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.content, publicCacheTags.contentKind("news")],
  },
);

const readPublishedContentListEntriesCached = unstable_cache(
  (
    kind: ContentKind,
    relatedProductSlug: string | null,
    limit: number | null,
  ) =>
    readPublishedListEntries(kind, {
      limit: limit ?? undefined,
      relatedProductSlug: relatedProductSlug ?? undefined,
    }),
  ["published-content-list"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.content],
  },
);

const readPublishedContentEntryBySlugCached = unstable_cache(
  async (kind: ContentKind, slug: string) => {
    const entries = await readEntriesFromSupabase(
      { kind, limit: 1, slug, status: "published" },
      getSupabasePublicReadClient(),
    );
    return entries[0] ?? null;
  },
  ["published-content-entry-by-slug"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.content],
  },
);

const readPublishedContentSlugsCached = unstable_cache(
  (kind: ContentKind) => readPublishedContentSlugs(kind),
  ["published-content-slugs"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.content],
  },
);

async function readPublishedEntries(kind: ContentKind) {
  return readEntriesFromSupabase(
    { kind, status: "published" },
    getSupabasePublicReadClient(),
  );
}

async function readPublishedListEntries(
  kind: ContentKind,
  options: { limit?: number; relatedProductSlug?: string } = {},
) {
  const queryOptions: ContentEntryQueryOptions = {
    kind,
    limit: options.limit,
    relatedProductSlug: options.relatedProductSlug,
    status: "published",
  };

  return readEntryListItemsFromSupabase(
    queryOptions,
    getSupabasePublicReadClient(),
  );
}

async function readPublishedContentSlugs(kind: ContentKind) {
  return readPublishedContentSlugsFromSupabase(
    kind,
    getSupabasePublicReadClient(),
  );
}

async function readContentEntryByIdFromSupabase(id: string) {
  const entries = await readEntriesFromSupabase({ id, limit: 1 });
  return entries[0] ?? null;
}

async function readEntriesFromSupabase(
  options: ContentEntryQueryOptions = {},
  client?: SupabaseClient,
) {
  const supabase = client ?? getSupabaseAdminClient();
  let query = supabase
    .from("content_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.id) {
    query = query.eq("id", options.id);
  }

  if (options.kind) {
    query = query.eq("kind", options.kind);
  }

  if (options.slug) {
    query = query.eq("slug", options.slug);
  }

  if (options.relatedProductSlug) {
    query = query.eq("related_product_slug", options.relatedProductSlug);
  }

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase 콘텐츠 조회 실패: ${error.message}`);
  }

  const rows = parseContentEntryRows(data);
  const usageMap = await readMediaUsagesByOwner(
    "content_entry",
    rows.map((row) => row.id),
    { client: supabase },
  );

  return entryListSchema.parse(
    rows.map((row) => fromSupabaseEntryRow(row, usageMap.get(row.id) ?? [])),
  );
}

async function readEntryListItemsFromSupabase(
  options: ContentEntryQueryOptions = {},
  client?: SupabaseClient,
) {
  const supabase = client ?? getSupabaseAdminClient();
  let query = supabase
    .from("content_entries")
    .select(
      `
        id,
        kind,
        slug,
        title,
        summary,
        body_text,
        display_date,
        related_product_slug,
        status,
        published_at,
        created_at,
        updated_at
      `,
    )
    .order("created_at", { ascending: false });

  if (options.id) {
    query = query.eq("id", options.id);
  }

  if (options.kind) {
    query = query.eq("kind", options.kind);
  }

  if (options.slug) {
    query = query.eq("slug", options.slug);
  }

  if (options.relatedProductSlug) {
    query = query.eq("related_product_slug", options.relatedProductSlug);
  }

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase 콘텐츠 목록 조회 실패: ${error.message}`);
  }

  const rows = parseContentEntryListRows(data);
  const usageMap = await readMediaUsagesByOwner(
    "content_entry",
    rows.map((row) => row.id),
    { client: supabase, roles: ["cover", "detail", "list"] },
  );

  return publishedEntryListSchema.parse(
    rows.map((row) =>
      fromSupabaseEntryListRow(row, usageMap.get(row.id) ?? []),
    ),
  );
}

async function readPublishedContentSlugsFromSupabase(
  kind: ContentKind,
  client?: SupabaseClient,
) {
  const supabase = client ?? getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select("slug")
    .eq("kind", kind)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase 콘텐츠 slug 조회 실패: ${error.message}`);
  }

  return parseContentSlugRows(data).map((row) => row.slug);
}

async function createEntryInSupabase(entry: ContentEntry) {
  await saveContentEntryWithRelationsInSupabase(
    entry,
    entry.images,
    entry.body,
  );

  return (await getContentEntryById(entry.id)) ?? entry;
}

async function updateEntryInSupabase(
  id: string,
  input: ContentEntryUpdateInput,
) {
  const current = await getContentEntryById(id);

  if (!current) {
    throw new Error("콘텐츠를 찾을 수 없습니다.");
  }

  const images = normalizeContentImageUpdates(input.images, input.body);
  const entry = buildUpdatedEntry(current, {
    ...input,
    images,
  });
  await assertUniqueContentSlug(entry.kind, entry.slug, id);
  await saveContentEntryWithRelationsInSupabase(entry, images, entry.body);

  return (await getContentEntryById(id)) ?? entry;
}

async function deleteEntryInSupabase(entry: ContentEntry) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("delete_content_entry_with_relations", {
    target_entry_id: entry.id,
  });

  if (error) {
    throw new Error(`Supabase 콘텐츠 삭제 실패: ${error.message}`);
  }

  return entry;
}

async function assertUniqueContentSlug(
  kind: ContentKind,
  slug: string,
  excludeId?: string,
) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("content_entries")
    .select("id")
    .eq("kind", kind)
    .eq("slug", slug)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase 콘텐츠 slug 확인 실패: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    throw new Error("이미 사용 중인 slug입니다.");
  }
}

async function saveContentEntryWithRelationsInSupabase(
  entry: ContentEntry,
  images: ContentImageUpdateInput[],
  body: unknown,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("save_content_entry_with_relations", {
    entry_row: toSupabaseEntryRow(entry),
    media_usage_rows: toSupabaseContentMediaUsageRows(images, body),
    reserved_asset_rows: toSupabaseContentReservedAssetRows(images),
  });

  if (error) {
    throw new Error(`Supabase 콘텐츠 관계 저장 실패: ${error.message}`);
  }
}

function buildUpdatedEntry(
  current: ContentEntry,
  input: ContentEntryUpdateInput,
) {
  const now = new Date().toISOString();
  const statusChangedToPublished =
    current.status !== "published" && input.status === "published";

  return entrySchema.parse({
    ...current,
    body: normalizeRichTextBody(input.body, input.bodyText),
    bodyText: input.bodyText.trim(),
    displayDate: emptyToUndefined(input.displayDate),
    publishedAt: statusChangedToPublished
      ? now.slice(0, 10)
      : input.status === "published"
        ? current.publishedAt
        : null,
    relatedProductSlug: emptyToNull(input.relatedProductSlug),
    slug: normalizeContentSlug(input.slug) || current.slug,
    status: input.status,
    summary: input.summary.trim(),
    title: input.title.trim(),
    updatedAt: now,
  });
}

function normalizeContentImageUpdates(
  images: ContentImageUpdateInput[],
  body: unknown,
) {
  const bodyImageIds = new Set(
    walkLexicalNodes(body)
      .filter((node) => node.type === "content-image")
      .map((node) => node.id)
      .filter((id): id is string => typeof id === "string"),
  );
  let coverSelected = false;
  let listImageSelected = false;

  return images.map((image, index) => {
    const isInBody = bodyImageIds.has(image.id);
    const isReserved = image.isReserved && !isInBody;
    const isCover = !isReserved && image.isCover && !coverSelected;
    const isListImage =
      !isReserved && image.isListImage && !listImageSelected;

    if (isCover) {
      coverSelected = true;
    }

    if (isListImage) {
      listImageSelected = true;
    }

    return {
      ...image,
      isCover,
      isDetail: !isReserved && image.isDetail,
      isListImage,
      isReserved,
      sortOrder: index,
    };
  });
}

function toSupabaseContentMediaUsageRows(
  images: ContentImageUpdateInput[],
  body: unknown,
) {
  const bodyImageIds = new Set(
    walkLexicalNodes(body)
      .filter((node) => node.type === "content-image")
      .map((node) => node.id)
      .filter((id): id is string => typeof id === "string"),
  );
  return images.flatMap((image, index) => {
    if (image.isReserved) {
      return [];
    }

    const roles = getContentImageUsageRoles(
      image,
      bodyImageIds.has(image.id),
    );

    return roles.map((role) => ({
      alt_override: image.alt,
      asset_id: image.id,
      caption_override: image.caption ?? null,
      layout: image.layout,
      role,
      sort_order: index,
    }));
  });
}

function toSupabaseContentReservedAssetRows(images: ContentImageUpdateInput[]) {
  return images.map((image) => ({
    asset_id: image.id,
    reserved: image.isReserved,
  }));
}

function fromSupabaseEntryRow(
  row: ContentEntryRow,
  usages: MediaUsage[],
): ContentEntry {
  return entrySchema.parse({
    body: normalizeRichTextBody(row.body_json, row.body_text),
    bodyText: row.body_text,
    createdAt: row.created_at,
    displayDate: row.display_date ?? undefined,
    id: row.id,
    images: createContentImagesFromMediaUsages(usages),
    kind: row.kind,
    publishedAt: row.published_at,
    relatedProductSlug: row.related_product_slug,
    slug: row.slug,
    status: row.status,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
  });
}

function fromSupabaseEntryListRow(
  row: ContentEntryListRow,
  usages: MediaUsage[],
): ContentEntryListItem {
  return entryListItemSchema.parse({
    bodyText: row.body_text,
    createdAt: row.created_at,
    displayDate: row.display_date ?? undefined,
    id: row.id,
    images: createContentImagesFromMediaUsages(usages),
    kind: row.kind,
    publishedAt: row.published_at,
    relatedProductSlug: row.related_product_slug,
    slug: row.slug,
    status: row.status,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
  });
}

function toSupabaseEntryRow(entry: ContentEntry) {
  return {
    body_json: normalizeRichTextBody(entry.body, entry.bodyText),
    body_text: entry.bodyText,
    display_date: entry.displayDate ?? null,
    id: entry.id,
    kind: entry.kind,
    published_at: entry.publishedAt ?? null,
    related_product_slug: entry.relatedProductSlug ?? null,
    slug: entry.slug,
    status: entry.status,
    summary: entry.summary,
    title: entry.title,
    updated_at: entry.updatedAt,
  };
}

function emptyToUndefined(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function emptyToNull(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
