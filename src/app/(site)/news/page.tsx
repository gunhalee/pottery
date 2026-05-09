import Link from "next/link";
import {
  ArrowLink,
  BottomNav,
  PageIntro,
  PageShell,
  Section,
} from "@/components/site/primitives";
import { siteConfig } from "@/lib/config/site";
import { scheduleItems } from "@/lib/content/site-content";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";

export default async function NewsPage() {
  const newsItems = await getPublishedContentListEntries("news");

  return (
    <>
      <PageShell>
        <PageIntro
          subtitle="새 작업물, 전시 일정, 공방 운영 소식을 전합니다."
          title="소식"
        />
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
      <Section className="intro-gallery-cta">
        <div className="intro-cta-card">
          <p className="body-copy">작업물이 궁금하다면</p>
          <ArrowLink href="/gallery">작업물 보기</ArrowLink>
        </div>
      </Section>
      <BottomNav
        links={[
          { href: "/shop", label: "소장하기" },
          { href: "/class", label: "클래스" },
        ]}
      />
    </>
  );
}
