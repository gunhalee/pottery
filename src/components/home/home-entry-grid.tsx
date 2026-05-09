import { SiteLink } from "@/components/navigation/site-link";
import type { HomeEntryCard } from "@/lib/content/site-content";

export function HomeEntryGrid({
  items,
}: {
  items: ReadonlyArray<HomeEntryCard>;
}) {
  return (
    <section className="home-entry-grid fade-in" aria-label="주요 페이지">
      {items.map((item) => (
        <SiteLink href={item.href} className="home-entry-card" key={item.label}>
          <h2 className="card-title">{item.title}</h2>
          <p className="home-entry-meta">
            <span className="home-entry-label">{item.label}</span>
            <span className="home-entry-divider" aria-hidden="true">
              |
            </span>
            <span>{item.description}</span>
          </p>
        </SiteLink>
      ))}
    </section>
  );
}
