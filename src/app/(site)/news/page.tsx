import Image from "next/image";
import Link from "next/link";
import { HomeSubscribeLinksSection } from "@/components/home/home-subscribe-links-section";
import { PageShell } from "@/components/site/primitives";
import { scheduleItems } from "@/lib/content/site-content";
import type { ContentEntryListItem } from "@/lib/content-manager/content-model";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import type { NaverBlogPost } from "@/lib/naver-blog/naver-blog-model";
import { getPublishedNaverBlogPosts } from "@/lib/naver-blog/naver-blog-store";

type NewsFeedItem = {
  dateLabel: string;
  external: boolean;
  href: string;
  id: string;
  linkLabel?: string;
  previewLabel?: string;
  sourceLabel: string;
  summary: string;
  thumbnailUrl?: string;
  timestamp: number;
  title: string;
};

export default async function NewsPage() {
  const [newsItems, naverBlogItems] = await Promise.all([
    getPublishedContentListEntries("news"),
    getPublishedNaverBlogPosts({ limit: 12 }),
  ]);
  const feedItems = createNewsFeedItems(newsItems, naverBlogItems);

  return (
    <>
      <PageShell className="listing-page-shell listing-page-shell-with-subscribe">
        <h1 className="sr-only">소식</h1>
        <div className="news-layout">
          <div>
            {feedItems.length > 0 ? (
              feedItems.map((item) => (
                <article
                  className={`news-item${item.thumbnailUrl ? " news-item-with-thumb" : ""}`}
                  key={item.id}
                >
                  <div className="news-date">{item.dateLabel}</div>
                  <div className="news-body">
                    {item.thumbnailUrl ? (
                      item.external ? (
                        <a
                          aria-label={`${item.title} 원문 보기`}
                          className="news-thumb-link"
                          href={item.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Image
                            alt=""
                            className="news-thumb"
                            height={90}
                            loading="lazy"
                            sizes="120px"
                            src={item.thumbnailUrl}
                            width={120}
                          />
                        </a>
                      ) : (
                        <Image
                          alt=""
                          className="news-thumb"
                          height={90}
                          loading="lazy"
                          sizes="120px"
                          src={item.thumbnailUrl}
                          width={120}
                        />
                      )
                    ) : null}
                    <div className="news-copy">
                      <div className="news-meta">
                        <span className="tag">{item.sourceLabel}</span>
                        {item.previewLabel ? (
                          <span className="news-preview-label">
                            {item.previewLabel}
                          </span>
                        ) : null}
                      </div>
                      <h3>
                        {item.external ? (
                          <a
                            href={item.href}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {item.title}
                          </a>
                        ) : (
                          <Link href={item.href} prefetch={false}>
                            {item.title}
                          </Link>
                        )}
                      </h3>
                      {item.summary ? (
                        item.external ? (
                          <a
                            className="news-preview-link"
                            href={item.href}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <span className="news-preview">{item.summary}</span>
                          </a>
                        ) : (
                          <p className="news-preview">{item.summary}</p>
                        )
                      ) : null}
                      {item.external && item.linkLabel ? (
                        <a
                          className="news-original-link"
                          href={item.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {item.linkLabel}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <article className="news-item">
                <div className="news-date">Soon</div>
                <div>
                  <div className="tag">소식</div>
                  <h3>준비 중입니다</h3>
                  <p className="news-preview">공개된 소식이 아직 없습니다.</p>
                </div>
              </article>
            )}
          </div>
          <aside>
            <div className="aside-title">일정</div>
            {scheduleItems.map((item) => (
              <div className="schedule" key={item.title}>
                <div className="schedule-date">{item.date}</div>
                <div className="schedule-title">{item.title}</div>
                <div className="schedule-place">{item.place}</div>
              </div>
            ))}
          </aside>
        </div>
      </PageShell>
      <HomeSubscribeLinksSection className="page-subscribe-section" />
    </>
  );
}

function createNewsFeedItems(
  newsItems: ContentEntryListItem[],
  naverBlogItems: NaverBlogPost[],
) {
  return [
    ...newsItems.map(toLocalNewsFeedItem),
    ...naverBlogItems.map(toNaverBlogFeedItem),
  ].sort((left, right) => right.timestamp - left.timestamp);
}

function toLocalNewsFeedItem(item: ContentEntryListItem): NewsFeedItem {
  return {
    dateLabel: item.displayDate ?? item.publishedAt ?? "",
    external: false,
    href: `/news/${item.slug}`,
    id: item.id,
    sourceLabel: "소식",
    summary: item.summary || item.bodyText,
    timestamp: readTimestamp(item.publishedAt, item.createdAt),
    title: item.title,
  };
}

function toNaverBlogFeedItem(item: NaverBlogPost): NewsFeedItem {
  return {
    dateLabel: formatDateLabel(item.publishedAt),
    external: true,
    href: item.link,
    id: `naver-blog-${item.id}`,
    linkLabel: "네이버 블로그에서 보기",
    previewLabel: "원문 미리보기",
    sourceLabel: item.category || "블로그",
    summary: item.summary,
    thumbnailUrl: item.thumbnailUrl,
    timestamp: readTimestamp(item.publishedAt, item.createdAt),
    title: item.title,
  };
}

function readTimestamp(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestamp = new Date(value).getTime();

    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function formatDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}.${month}.${day}`;
}
