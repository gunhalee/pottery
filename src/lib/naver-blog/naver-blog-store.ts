import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import { publicCacheTags } from "@/lib/cache/public-cache-tags";
import {
  getConfiguredNaverBlogId,
  normalizeNaverBlogId,
} from "@/lib/naver-blog/naver-blog-config";
import type {
  NaverBlogPost,
  NaverBlogPostInput,
} from "@/lib/naver-blog/naver-blog-model";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSupabasePublicReadClient } from "@/lib/supabase/read-client";

type ReadNaverBlogPostsOptions = {
  blogId?: string | null;
  limit?: number;
};

type ExistingNaverBlogPostRow = {
  category: string | null;
  description_html: string;
  guid: string;
  link: string;
  naver_blog_id: string;
  pub_date: string;
  summary: string;
  tags: string[];
  thumbnail_url: string | null;
  title: string;
};

const nullableString = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? "");

const optionalNullableString = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value || undefined);

const naverBlogPostRowSchema = z.object({
  category: optionalNullableString,
  created_at: z.string(),
  description_html: nullableString,
  fetched_at: z.string(),
  guid: z.string(),
  id: z.string(),
  link: z.string(),
  naver_blog_id: z.string(),
  pub_date: z.string(),
  summary: nullableString,
  tags: z
    .array(z.string())
    .nullable()
    .optional()
    .transform((value) => value ?? []),
  thumbnail_url: optionalNullableString,
  title: z.string(),
  updated_at: z.string(),
});
const naverBlogPostRowsSchema = z.array(naverBlogPostRowSchema);

export async function getPublishedNaverBlogPosts(
  options: ReadNaverBlogPostsOptions = {},
) {
  const blogId = normalizeNaverBlogId(
    options.blogId ?? getConfiguredNaverBlogId(),
  );

  if (!blogId) {
    return [];
  }

  return readNaverBlogPostsCached(blogId, options.limit ?? null);
}

export async function upsertNaverBlogPosts(posts: NaverBlogPostInput[]) {
  if (posts.length === 0) {
    return {
      inserted: 0,
      unchanged: 0,
      updated: 0,
    };
  }

  const supabase = getSupabaseAdminClient();
  const existingRows = await readExistingNaverBlogPostRows(posts);
  const existingByKey = new Map(
    existingRows.map((row) => [createPostKey(row.naver_blog_id, row.guid), row]),
  );
  const rowsToUpsert = posts.filter((post) => {
    const existing = existingByKey.get(createPostKey(post.naverBlogId, post.guid));
    return !existing || !isSameNaverBlogPost(existing, post);
  });

  if (rowsToUpsert.length > 0) {
    const { error } = await supabase.from("naver_blog_posts").upsert(
      rowsToUpsert.map(toSupabaseNaverBlogPostRow),
      {
        onConflict: "naver_blog_id,guid",
      },
    );

    if (error) {
      throw new Error(`Supabase Naver blog post upsert failed: ${error.message}`);
    }
  }

  const inserted = rowsToUpsert.filter(
    (post) => !existingByKey.has(createPostKey(post.naverBlogId, post.guid)),
  ).length;
  const updated = rowsToUpsert.length - inserted;

  return {
    inserted,
    unchanged: posts.length - rowsToUpsert.length,
    updated,
  };
}

const readNaverBlogPostsCached = unstable_cache(
  (blogId: string, limit: number | null) =>
    readNaverBlogPostsFromSupabase({
      blogId,
      limit: limit ?? undefined,
    }),
  ["published-naver-blog-posts"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.naverBlog],
  },
);

async function readNaverBlogPostsFromSupabase({
  blogId,
  limit,
}: Required<Pick<ReadNaverBlogPostsOptions, "blogId">> &
  Pick<ReadNaverBlogPostsOptions, "limit">) {
  const supabase = getSupabasePublicReadClient();
  let query = supabase
    .from("naver_blog_posts")
    .select("*")
    .eq("naver_blog_id", blogId)
    .order("pub_date", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingNaverBlogTableError(error)) {
      return [];
    }

    throw new Error(`Supabase Naver blog posts query failed: ${error.message}`);
  }

  return naverBlogPostRowsSchema
    .parse(data ?? [])
    .map(fromSupabaseNaverBlogPostRow);
}

async function readExistingNaverBlogPostRows(posts: NaverBlogPostInput[]) {
  const supabase = getSupabaseAdminClient();
  const guids = [...new Set(posts.map((post) => post.guid))];

  const { data, error } = await supabase
    .from("naver_blog_posts")
    .select(
      `
        naver_blog_id,
        guid,
        title,
        link,
        description_html,
        summary,
        thumbnail_url,
        category,
        tags,
        pub_date
      `,
    )
    .in("guid", guids);

  if (error) {
    throw new Error(
      `Supabase Naver blog existing post query failed: ${error.message}`,
    );
  }

  return (data ?? []) as unknown as ExistingNaverBlogPostRow[];
}

function toSupabaseNaverBlogPostRow(post: NaverBlogPostInput) {
  const now = new Date().toISOString();

  return {
    category: post.category ?? null,
    description_html: post.descriptionHtml,
    fetched_at: now,
    guid: post.guid,
    link: post.link,
    naver_blog_id: post.naverBlogId,
    pub_date: post.publishedAt,
    summary: post.summary,
    tags: post.tags,
    thumbnail_url: post.thumbnailUrl ?? null,
    title: post.title,
    updated_at: now,
  };
}

function fromSupabaseNaverBlogPostRow(
  row: z.infer<typeof naverBlogPostRowSchema>,
): NaverBlogPost {
  return {
    category: row.category,
    createdAt: row.created_at,
    descriptionHtml: row.description_html,
    fetchedAt: row.fetched_at,
    guid: row.guid,
    id: row.id,
    link: row.link,
    naverBlogId: row.naver_blog_id,
    publishedAt: row.pub_date,
    summary: row.summary,
    tags: row.tags,
    thumbnailUrl: row.thumbnail_url,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function isSameNaverBlogPost(
  existing: ExistingNaverBlogPostRow,
  post: NaverBlogPostInput,
) {
  return (
    existing.title === post.title &&
    existing.link === post.link &&
    existing.description_html === post.descriptionHtml &&
    existing.summary === post.summary &&
    (existing.thumbnail_url ?? undefined) === post.thumbnailUrl &&
    (existing.category ?? undefined) === post.category &&
    normalizeTimestamp(existing.pub_date) === normalizeTimestamp(post.publishedAt) &&
    arraysEqual(existing.tags ?? [], post.tags)
  );
}

function normalizeTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function createPostKey(blogId: string, guid: string) {
  return `${blogId}\n${guid}`;
}

function isMissingNaverBlogTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("naver_blog_posts");
}
