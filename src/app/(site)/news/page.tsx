import { MetaLabel, PageShell } from "@/components/site/primitives";
import { newsItems, scheduleItems } from "@/lib/content/site-content";

export default function NewsPage() {
  return (
    <PageShell>
      <MetaLabel>News</MetaLabel>
      <div className="news-layout">
        <div>
          <h1 className="section-title">
            News &amp;
            <br />
            Updates
          </h1>
          {newsItems.map((item) => (
            <article className="news-item" key={item.title}>
              <div className="news-date">{item.date}</div>
              <div>
                <div className="tag">{item.tag}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
        <aside>
          <div className="aside-title">Schedule</div>
          {scheduleItems.map((item) => (
            <div className="schedule" key={item.title}>
              <div className="schedule-date">{item.date}</div>
              <div className="schedule-title">{item.title}</div>
              <div className="schedule-place">{item.place}</div>
            </div>
          ))}
          <div className="follow-box">
            <div className="aside-title">Follow Us</div>
            <div className="follow-links">
              <a className="follow-link" href="#">
                Instagram
              </a>
              <a className="follow-link" href="#">
                Channel
              </a>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
