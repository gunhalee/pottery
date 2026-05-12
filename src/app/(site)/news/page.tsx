import Link from "next/link";
import { HomeSubscribeLinksSection } from "@/components/home/home-subscribe-links-section";
import { PageShell } from "@/components/site/primitives";
import { scheduleItems } from "@/lib/content/site-content";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";

export default async function NewsPage() {
  const newsItems = await getPublishedContentListEntries("news");

  return (
    <>
      <PageShell className="listing-page-shell listing-page-shell-with-subscribe">
        <h1 className="sr-only">소식</h1>
        <div className="news-layout">
          <div>
            {newsItems.length > 0 ? (
              newsItems.map((item) => (
                <article className="news-item" key={item.id}>
                  <div className="news-date">
                    {item.displayDate ?? item.publishedAt ?? ""}
                  </div>
                  <div>
                    <div className="tag">소식</div>
                    <h3>
                      <Link href={`/news/${item.slug}`} prefetch={false}>
                        {item.title}
                      </Link>
                    </h3>
                    <p>{item.summary || item.bodyText}</p>
                  </div>
                </article>
              ))
            ) : (
              <article className="news-item">
                <div className="news-date">Soon</div>
                <div>
                  <div className="tag">소식</div>
                  <h3>준비 중입니다</h3>
                  <p>공개된 소식이 아직 없습니다.</p>
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
