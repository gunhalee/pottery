import { XMLParser } from "fast-xml-parser";
import {
  buildNaverBlogRssUrl,
  normalizeNaverBlogId,
} from "@/lib/naver-blog/naver-blog-config";
import type { NaverBlogPostInput } from "@/lib/naver-blog/naver-blog-model";

type NaverBlogRssFeed = {
  feedTitle?: string;
  posts: NaverBlogPostInput[];
};

type RssItemRecord = {
  author?: unknown;
  category?: unknown;
  description?: unknown;
  guid?: unknown;
  link?: unknown;
  pubDate?: unknown;
  tag?: unknown;
  title?: unknown;
};

const rssParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

export async function fetchNaverBlogRss({
  blogId,
  cache = "no-store",
  limit,
  revalidate,
}: {
  blogId: string;
  cache?: RequestCache;
  limit?: number;
  revalidate?: number;
}) {
  const normalizedBlogId = normalizeNaverBlogId(blogId);

  if (!normalizedBlogId) {
    throw new Error("A valid NAVER_BLOG_ID is required.");
  }

  const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": "consepot-site-naver-rss/1.0",
    },
  };

  if (revalidate) {
    fetchOptions.next = { revalidate };
  } else {
    fetchOptions.cache = cache;
  }

  const response = await fetch(buildNaverBlogRssUrl(normalizedBlogId), fetchOptions);

  if (!response.ok) {
    throw new Error(
      `Naver Blog RSS request failed with ${response.status} ${response.statusText}.`,
    );
  }

  return parseNaverBlogRss(await response.text(), {
    blogId: normalizedBlogId,
    limit,
  });
}

export function parseNaverBlogRss(
  xml: string,
  {
    blogId,
    limit,
  }: {
    blogId: string;
    limit?: number;
  },
): NaverBlogRssFeed {
  const parsed = rssParser.parse(xml) as {
    rss?: {
      channel?: {
        item?: RssItemRecord | RssItemRecord[];
        title?: unknown;
      };
    };
  };
  const channel = parsed.rss?.channel;
  const items = toArray(channel?.item).slice(0, limit);

  return {
    feedTitle: textValue(channel?.title) || undefined,
    posts: items.flatMap((item) => normalizeRssItem(item, blogId)),
  };
}

function normalizeRssItem(
  item: RssItemRecord,
  blogId: string,
): NaverBlogPostInput[] {
  const title = createPlainText(textValue(item.title), 200);
  const rawLink = textValue(item.link);
  const guid = textValue(item.guid) || rawLink;
  const link = normalizeBlogPostLink(rawLink, guid);
  const descriptionHtml = textValue(item.description);

  if (!title || !link || !guid) {
    return [];
  }

  return [
    {
      category: optionalText(item.category),
      descriptionHtml,
      guid,
      link,
      naverBlogId: blogId,
      publishedAt: parseRssDate(textValue(item.pubDate)),
      summary: createSummary(descriptionHtml),
      tags: splitTags(textValue(item.tag)),
      thumbnailUrl: extractThumbnailUrl(descriptionHtml),
      title,
    },
  ];
}

function normalizeBlogPostLink(rawLink: string, guid: string) {
  const fallback = guid || rawLink;
  const link = rawLink || fallback;

  try {
    const url = new URL(link);
    url.searchParams.delete("fromRss");
    url.searchParams.delete("trackingCode");
    return url.toString();
  } catch {
    return fallback;
  }
}

function parseRssDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function createSummary(descriptionHtml: string) {
  return createPlainText(descriptionHtml, 260);
}

function createPlainText(value: string, maxLength: number) {
  const text = decodeHtmlEntities(
    value
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function extractThumbnailUrl(descriptionHtml: string) {
  const match = descriptionHtml.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  const rawUrl = match?.[1];

  if (!rawUrl) {
    return undefined;
  }

  const decodedUrl = decodeHtmlEntities(rawUrl);

  try {
    return new URL(decodedUrl).toString();
  } catch {
    return undefined;
  }
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function optionalText(value: unknown) {
  const text = textValue(value);
  return text || undefined;
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return "";
}

function toArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, code: string) => {
      const lowerCode = code.toLowerCase();

      if (lowerCode === "amp") {
        return "&";
      }

      if (lowerCode === "lt") {
        return "<";
      }

      if (lowerCode === "gt") {
        return ">";
      }

      if (lowerCode === "quot") {
        return '"';
      }

      if (lowerCode === "apos") {
        return "'";
      }

      if (lowerCode === "nbsp") {
        return " ";
      }

      const radix = lowerCode.startsWith("#x") ? 16 : 10;
      const numberValue = Number.parseInt(
        lowerCode.replace(/^#x?/, ""),
        radix,
      );

      if (!Number.isFinite(numberValue)) {
        return entity;
      }

      return String.fromCodePoint(numberValue);
    },
  );
}
