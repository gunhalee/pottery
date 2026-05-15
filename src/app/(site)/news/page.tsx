import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HomeSubscribeLinksSection } from "@/components/home/home-subscribe-links-section";
import { PageIntro, PageShell } from "@/components/site/primitives";
import { siteConfig } from "@/lib/config/site";
import { getContentListThumbnailImage } from "@/lib/content-manager/content-images";
import type { ContentEntryListItem } from "@/lib/content-manager/content-model";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import type { NaverBlogPost } from "@/lib/naver-blog/naver-blog-model";
import { getPublishedNaverBlogPosts } from "@/lib/naver-blog/naver-blog-store";
import { getPublishedClassSessions } from "@/lib/shop/class-sessions";

type NewsFeedItem = {
  dateLabel: string;
  external: boolean;
  href: string;
  id: string;
  linkLabel?: string;
  summary: string;
  thumbnailUrl?: string;
  timestamp: number;
  title: string;
};

export const metadata: Metadata = {
  alternates: {
    canonical: "/news",
  },
  description:
    "콩새와 도자기공방의 클래스 일정, 작업물 입고, 애견동반 방문 안내와 공방 소식을 전합니다.",
  openGraph: {
    description:
      "경기 광주 능평동 도자기 공방의 클래스 일정, 작업물 소식, 방문 안내.",
    title: `공방 소식 | ${siteConfig.name}`,
  },
  title: "공방 소식과 클래스 일정",
};

export default async function NewsPage() {
  const [newsItems, naverBlogItems, classSessions] = await Promise.all([
    getPublishedContentListEntries("news"),
    getPublishedNaverBlogPosts({ limit: 12 }),
    getPublishedClassSessions(),
  ]);
  const feedItems = createNewsFeedItems(newsItems, naverBlogItems);

  return (
    <>
      <PageShell className="listing-page-shell listing-page-shell-with-subscribe">
        <PageIntro
          subtitle="경기 광주 능평동 공방의 클래스 일정, 작업물 입고, 애견동반 방문 안내와 계절의 기록을 전합니다."
          title="소식"
          variant="compact"
        />
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
                        <Link
                          aria-label={item.title}
                          className="news-thumb-link"
                          href={item.href}
                          prefetch={false}
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
                        </Link>
                      )
                    ) : null}
                    <div className="news-copy">
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
                  <h3>준비 중입니다</h3>
                  <p className="news-preview">공개된 소식이 아직 없습니다.</p>
                </div>
              </article>
            )}
          </div>
          <aside>
            <div className="aside-title">일정</div>
            {classSessions.length > 0 ? (
              classSessions.map((item) => (
                <div className="schedule" key={item.id}>
                  <div className="schedule-date">
                    {item.dateLabel ?? formatDateLabel(item.sessionDate ?? "")}
                  </div>
                  <div className="schedule-title">{item.title}</div>
                  {item.description ? (
                    <div className="schedule-place">{item.description}</div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="schedule">
                <div className="schedule-date">Soon</div>
                <div className="schedule-title">공개된 일정이 없습니다.</div>
              </div>
            )}
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
  const thumbnailImage = getContentListThumbnailImage(item);

  return {
    dateLabel: item.displayDate ?? formatDateLabel(item.publishedAt ?? item.createdAt),
    external: false,
    href: `/news/${item.slug}`,
    id: item.id,
    summary: item.summary || item.bodyText,
    thumbnailUrl: thumbnailImage?.src,
    timestamp: readTimestamp(item.displayDate, item.publishedAt, item.createdAt),
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

    const timestamp = readDateTimestamp(value);

    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function readDateTimestamp(value: string) {
  const displayDateMatch = value
    .trim()
    .match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);

  if (displayDateMatch) {
    const [, year, month, day] = displayDateMatch;
    return new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+09:00`,
    ).getTime();
  }

  return new Date(value).getTime();
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

  return `${year}. ${month}. ${day}.`;
}
