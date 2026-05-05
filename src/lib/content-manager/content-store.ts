import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  emptyRichTextBody,
  createParagraphBody,
} from "./rich-text-defaults";
import type {
  ContentEntry,
  ContentEntryDraftInput,
  ContentEntryUpdateInput,
  ContentImage,
  ContentImageLayout,
  ContentImageUpdateInput,
  ContentImageUploadInput,
  ContentKind,
} from "./content-model";

const dataFilePath = path.join(process.cwd(), "data", "content-entries.json");
export const contentImageBucket = "content-images";

type ContentEntryRow = {
  body_json: unknown;
  body_text: string;
  created_at: string;
  display_date: string | null;
  id: string;
  kind: ContentKind;
  published_at: string | null;
  related_product_slug: string | null;
  slug: string;
  status: "draft" | "published";
  summary: string;
  title: string;
  updated_at: string;
};

type ContentImageRow = {
  alt: string;
  caption: string | null;
  created_at: string;
  height: number;
  id: string;
  is_cover: boolean;
  is_detail: boolean;
  layout: ContentImageLayout;
  sort_order: number;
  src: string;
  storage_path: string;
  updated_at: string;
  width: number;
};

type ContentSelectRow = ContentEntryRow & {
  content_images?: ContentImageRow[] | null;
};

const imageLayoutSchema = z.enum([
  "align-left",
  "align-right",
  "default",
  "full",
  "two-column",
  "wide",
]);

const imageSchema = z.object({
  alt: z.string(),
  caption: z.string().optional(),
  createdAt: z.string(),
  height: z.number().int().positive(),
  id: z.string().min(1),
  isCover: z.boolean(),
  isDetail: z.boolean(),
  layout: imageLayoutSchema,
  sortOrder: z.number().int().nonnegative(),
  src: z.string().min(1),
  storagePath: z.string().min(1),
  updatedAt: z.string(),
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

const entryListSchema = z.array(entrySchema);

export function normalizeContentSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createFallbackContentSlug(prefix = "content") {
  return `${prefix}-${Date.now().toString(36)}`;
}

export async function readContentEntries(kind?: ContentKind) {
  const entries = isSupabaseConfigured()
    ? await readEntriesFromSupabase()
    : await readEntriesFromJson();

  return kind ? entries.filter((entry) => entry.kind === kind) : entries;
}

export async function getPublishedContentEntries(kind: ContentKind) {
  const entries = await readContentEntries(kind);
  return entries.filter((entry) => entry.status === "published");
}

export async function getContentEntryById(id: string) {
  const entries = await readContentEntries();
  return entries.find((entry) => entry.id === id) ?? null;
}

export async function getContentEntryBySlug(kind: ContentKind, slug: string) {
  const entries = await getPublishedContentEntries(kind);
  return entries.find((entry) => entry.slug === slug) ?? null;
}

export async function getContentEntryPreviewBySlug(
  kind: ContentKind,
  slug: string,
) {
  const entries = await readContentEntries(kind);
  return entries.find((entry) => entry.slug === slug) ?? null;
}

export async function getPublishedContentSlugs(kind: ContentKind) {
  const entries = await getPublishedContentEntries(kind);
  return entries.map((entry) => entry.slug);
}

export async function createContentDraft(input: ContentEntryDraftInput) {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const normalizedSlug = normalizeContentSlug(input.slug || title);
  const slug =
    normalizedSlug || createFallbackContentSlug(`${input.kind}-draft`);

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

  if (isSupabaseConfigured()) {
    return createEntryInSupabase(entry);
  }

  return createEntryInJson(entry);
}

export async function updateContentEntry(
  id: string,
  input: ContentEntryUpdateInput,
) {
  if (isSupabaseConfigured()) {
    return updateEntryInSupabase(id, input);
  }

  return updateEntryInJson(id, input);
}

export async function addContentImage(input: ContentImageUploadInput) {
  const now = new Date().toISOString();
  const image = imageSchema.parse({
    alt: input.alt,
    caption: input.caption || undefined,
    createdAt: now,
    height: input.height,
    id: randomUUID(),
    isCover: false,
    isDetail: false,
    layout: input.layout ?? "default",
    sortOrder: 0,
    src: input.src,
    storagePath: input.storagePath,
    updatedAt: now,
    width: input.width,
  });

  if (isSupabaseConfigured()) {
    return addImageInSupabase(input.entryId, image);
  }

  throw new Error("Supabase Storage 설정이 필요합니다.");
}

export async function deleteContentEntry(id: string) {
  const entry = await getContentEntryById(id);

  if (!entry) {
    throw new Error("콘텐츠를 찾을 수 없습니다.");
  }

  if (isSupabaseConfigured()) {
    await deleteStorageObjects(entry.images);
    return deleteEntryInSupabase(entry);
  }

  return deleteEntryInJson(entry);
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

  if (isSupabaseConfigured()) {
    await deleteStorageObjects([image]);
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("content_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      throw new Error(`Supabase 콘텐츠 이미지 삭제 실패: ${error.message}`);
    }

    return;
  }

  throw new Error("Supabase Storage 설정이 필요합니다.");
}

export function getContentKindLabel(kind: ContentKind) {
  return kind === "news" ? "소식" : "작품";
}

export function getContentAdminPath(kind: ContentKind) {
  return kind === "news" ? "/admin/news" : "/admin/gallery";
}

export function getContentPublicPath(kind: ContentKind) {
  return kind === "news" ? "/news" : "/gallery";
}

async function readEntriesFromSupabase() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select(
      `
        *,
        content_images (*)
      `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingContentTableError(error)) {
      return readEntriesFromJson();
    }

    throw new Error(`Supabase 콘텐츠 조회 실패: ${error.message}`);
  }

  return entryListSchema.parse(
    (data ?? []).map((row) => fromSupabaseEntryRow(row as ContentSelectRow)),
  );
}

async function createEntryInSupabase(entry: ContentEntry) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("content_entries").insert(
    toSupabaseEntryRow(entry),
  );

  if (error) {
    throw new Error(`Supabase 콘텐츠 초안 생성 실패: ${error.message}`);
  }

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

  const entry = buildUpdatedEntry(current, input);
  await assertUniqueContentSlug(entry.kind, entry.slug, id);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("content_entries")
    .update(toSupabaseEntryRow(entry))
    .eq("id", id);

  if (error) {
    throw new Error(`Supabase 콘텐츠 저장 실패: ${error.message}`);
  }

  await updateImagesInSupabase(id, input.images);
  return (await getContentEntryById(id)) ?? entry;
}

async function addImageInSupabase(entryId: string, image: ContentImage) {
  const entry = await getContentEntryById(entryId);

  if (!entry) {
    throw new Error("콘텐츠를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("content_images")
    .insert(toSupabaseImageRow(entryId, image))
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase 콘텐츠 이미지 저장 실패: ${error.message}`);
  }

  return fromSupabaseImageRow(data as ContentImageRow);
}

async function updateImagesInSupabase(
  entryId: string,
  images: ContentImageUpdateInput[],
) {
  const current = await getContentEntryById(entryId);

  if (!current) {
    throw new Error("콘텐츠를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();

  if (images.some((image) => image.isCover)) {
    const { error } = await supabase
      .from("content_images")
      .update({ is_cover: false })
      .eq("entry_id", entryId);

    if (error) {
      throw new Error(`Supabase 대표 이미지 초기화 실패: ${error.message}`);
    }
  }

  for (const image of images) {
    if (!current.images.some((item) => item.id === image.id)) {
      continue;
    }

    const { error } = await supabase
      .from("content_images")
      .update({
        alt: image.alt,
        caption: emptyToNull(image.caption),
        is_cover: image.isCover,
        is_detail: image.isDetail,
        layout: image.layout,
        sort_order: image.sortOrder,
      })
      .eq("id", image.id);

    if (error) {
      throw new Error(`Supabase 콘텐츠 이미지 수정 실패: ${error.message}`);
    }
  }
}

async function deleteEntryInSupabase(entry: ContentEntry) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("content_entries")
    .delete()
    .eq("id", entry.id);

  if (error) {
    throw new Error(`Supabase 콘텐츠 삭제 실패: ${error.message}`);
  }

  return entry;
}

async function readEntriesFromJson() {
  try {
    const file = await readFile(dataFilePath, "utf8");
    return entryListSchema.parse(JSON.parse(file));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [] satisfies ContentEntry[];
    }

    throw error;
  }
}

async function createEntryInJson(entry: ContentEntry) {
  const entries = await readEntriesFromJson();

  if (
    entries.some(
      (item) => item.kind === entry.kind && item.slug === entry.slug,
    )
  ) {
    throw new Error("이미 사용 중인 slug입니다.");
  }

  await writeJsonEntries([entry, ...entries]);
  return entry;
}

async function updateEntryInJson(
  id: string,
  input: ContentEntryUpdateInput,
) {
  const entries = await readEntriesFromJson();
  const current = entries.find((entry) => entry.id === id);

  if (!current) {
    throw new Error("콘텐츠를 찾을 수 없습니다.");
  }

  const nextEntry = buildUpdatedEntry(current, input);
  await assertUniqueContentSlug(nextEntry.kind, nextEntry.slug, id);
  const nextEntries = entries.map((entry) =>
    entry.id === id
      ? entrySchema.parse({
          ...nextEntry,
          images: mergeImageUpdates(entry.images, input.images),
        })
      : entry,
  );

  await writeJsonEntries(nextEntries);
  return nextEntries.find((entry) => entry.id === id) ?? nextEntry;
}

async function deleteEntryInJson(entry: ContentEntry) {
  const entries = await readEntriesFromJson();
  await writeJsonEntries(entries.filter((item) => item.id !== entry.id));
  return entry;
}

async function assertUniqueContentSlug(
  kind: ContentKind,
  slug: string,
  excludeId?: string,
) {
  const entries = await readContentEntries(kind);
  const duplicate = entries.find(
    (entry) => entry.slug === slug && entry.id !== excludeId,
  );

  if (duplicate) {
    throw new Error("이미 사용 중인 slug입니다.");
  }
}

async function writeJsonEntries(entries: ContentEntry[]) {
  const parsed = entryListSchema.parse(entries);
  await mkdir(path.dirname(dataFilePath), { recursive: true });
  await writeFile(dataFilePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
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
    body: input.body ?? emptyRichTextBody,
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

function mergeImageUpdates(
  currentImages: ContentImage[],
  inputImages: ContentImageUpdateInput[],
) {
  const inputMap = new Map(inputImages.map((image) => [image.id, image]));

  return currentImages.map((image) => {
    const next = inputMap.get(image.id);

    if (!next) {
      return image;
    }

    return imageSchema.parse({
      ...image,
      alt: next.alt,
      caption: emptyToUndefined(next.caption),
      isCover: next.isCover,
      isDetail: next.isDetail,
      layout: next.layout,
      sortOrder: next.sortOrder,
      updatedAt: new Date().toISOString(),
    });
  });
}

async function deleteStorageObjects(images: ContentImage[]) {
  if (images.length === 0 || !isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(contentImageBucket)
    .remove(images.map((image) => image.storagePath));

  if (error) {
    throw new Error(`Supabase Storage 이미지 삭제 실패: ${error.message}`);
  }
}

function fromSupabaseEntryRow(row: ContentSelectRow): ContentEntry {
  const images = [...(row.content_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => fromSupabaseImageRow(image));

  return entrySchema.parse({
    body: row.body_json,
    bodyText: row.body_text,
    createdAt: row.created_at,
    displayDate: row.display_date ?? undefined,
    id: row.id,
    images,
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

function fromSupabaseImageRow(row: ContentImageRow): ContentImage {
  return imageSchema.parse({
    alt: row.alt,
    caption: row.caption ?? undefined,
    createdAt: row.created_at,
    height: row.height,
    id: row.id,
    isCover: row.is_cover,
    isDetail: row.is_detail,
    layout: row.layout,
    sortOrder: row.sort_order,
    src: row.src,
    storagePath: row.storage_path,
    updatedAt: row.updated_at,
    width: row.width,
  });
}

function toSupabaseEntryRow(entry: ContentEntry) {
  return {
    body_json: entry.body,
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

function toSupabaseImageRow(entryId: string, image: ContentImage) {
  return {
    alt: image.alt,
    caption: image.caption ?? null,
    entry_id: entryId,
    height: image.height,
    id: image.id,
    is_cover: image.isCover,
    is_detail: image.isDetail,
    layout: image.layout,
    sort_order: image.sortOrder,
    src: image.src,
    storage_path: image.storagePath,
    updated_at: image.updatedAt,
    width: image.width,
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

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isMissingContentTableError(error: { message?: string }) {
  const message = error.message ?? "";
  return (
    message.includes("content_entries") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}
