import { ArrowLink, Section, WorkGrid } from "@/components/site/primitives";
import type { WorkItem } from "@/lib/content/site-content";

export function HomeRecentWorksSection({ items }: { items: WorkItem[] }) {
  return (
    <Section>
      <div className="works-head">
        <h2 className="section-title">Recent Works</h2>
        <ArrowLink href="/shop">View All</ArrowLink>
      </div>
      <WorkGrid items={items} />
    </Section>
  );
}
