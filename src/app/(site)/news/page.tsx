import Link from "next/link";
import {
  ArrowLink,
  BottomNav,
  MetaLabel,
  PageShell,
} from "@/components/site/primitives";
import { siteConfig } from "@/lib/config/site";
import { scheduleItems } from "@/lib/content/site-content";
import { getPublishedContentEntries } from "@/lib/content-manager/content-store";

export default async function NewsPage() {
  const newsItems = await getPublishedContentEntries("news");

  return (
    <>
      <PageShell>
        <MetaLabel>소식</MetaLabel>
        <div className="news-layout">
          <div>
            <h1 className="section-title">소식</h1>
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
            <div className="news-inline-cta">
              <ArrowLink href="/shop">최근 작품 보러 가기</ArrowLink>
            </div>
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
            <div className="follow-box">
              <div className="aside-title">연결</div>
              <div className="follow-links">
                <a
                  className="follow-link"
                  href={siteConfig.instagramUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Instagram
                </a>
                <a
                  className="follow-link"
                  href={siteConfig.kakaoChannelUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  카카오채널
                </a>
              </div>
            </div>
          </aside>
        </div>
      </PageShell>
      <BottomNav
        links={[
          { href: "/shop", label: "작품 소장하기" },
          { href: "/class", label: "클래스" },
        ]}
      />
    </>
  );
}
