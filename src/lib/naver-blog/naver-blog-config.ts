export const defaultNaverBlogSyncLimit = 20;

export function getConfiguredNaverBlogId() {
  const explicitId = normalizeNaverBlogId(process.env.NAVER_BLOG_ID);

  if (explicitId) {
    return explicitId;
  }

  return extractNaverBlogId(process.env.NEXT_PUBLIC_NAVER_BLOG_URL);
}

export function getConfiguredNaverBlogSyncLimit() {
  const rawValue = process.env.NAVER_BLOG_RSS_LIMIT;
  const numberValue = Number(rawValue);

  if (!Number.isFinite(numberValue)) {
    return defaultNaverBlogSyncLimit;
  }

  return Math.min(50, Math.max(1, Math.floor(numberValue)));
}

export function buildNaverBlogRssUrl(blogId: string) {
  return `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`;
}

export function normalizeNaverBlogId(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed || !/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function extractNaverBlogId(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const maybeUrl = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(maybeUrl);

    if (!url.hostname.endsWith("naver.com")) {
      return normalizeNaverBlogId(trimmed);
    }

    const pathId = url.pathname.split("/").filter(Boolean)[0];
    return normalizeNaverBlogId(pathId);
  } catch {
    return normalizeNaverBlogId(trimmed);
  }
}
