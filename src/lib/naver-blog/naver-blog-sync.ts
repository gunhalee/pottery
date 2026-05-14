import "server-only";

import {
  getConfiguredNaverBlogSyncLimit,
  normalizeNaverBlogId,
} from "@/lib/naver-blog/naver-blog-config";
import { fetchNaverBlogRss } from "@/lib/naver-blog/naver-blog-rss";
import type { NaverBlogSyncSummary } from "@/lib/naver-blog/naver-blog-model";
import { upsertNaverBlogPosts } from "@/lib/naver-blog/naver-blog-store";

export async function syncNaverBlogPosts({
  blogId,
  dryRun = false,
  limit = getConfiguredNaverBlogSyncLimit(),
}: {
  blogId: string;
  dryRun?: boolean;
  limit?: number;
}): Promise<NaverBlogSyncSummary> {
  const normalizedBlogId = normalizeNaverBlogId(blogId);

  if (!normalizedBlogId) {
    throw new Error("A valid NAVER_BLOG_ID is required.");
  }

  const feed = await fetchNaverBlogRss({
    blogId: normalizedBlogId,
    limit,
  });
  const result = dryRun
    ? {
        inserted: 0,
        unchanged: 0,
        updated: 0,
      }
    : await upsertNaverBlogPosts(feed.posts);

  return {
    blogId: normalizedBlogId,
    dryRun,
    feedTitle: feed.feedTitle,
    inserted: result.inserted,
    scanned: feed.posts.length,
    unchanged: dryRun ? feed.posts.length : result.unchanged,
    updated: result.updated,
  };
}
