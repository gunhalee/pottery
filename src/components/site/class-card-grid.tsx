import { ExternalButtonLink } from "@/components/site/primitives";
import type { ClassItem } from "@/lib/content/site-content";

type ClassCardGridProps = {
  actionHref: string;
  items: readonly ClassItem[];
};

export function ClassCardGrid({ actionHref, items }: ClassCardGridProps) {
  return (
    <div className="class-grid section-gap">
      {items.map((item) => (
        <ClassCard actionHref={actionHref} item={item} key={item.eyebrow} />
      ))}
    </div>
  );
}

function ClassCard({
  actionHref,
  item,
}: {
  actionHref: string;
  item: ClassItem;
}) {
  return (
    <article className="class-card">
      <div className="small-caps">{item.eyebrow}</div>
      <h2 className="card-title">{item.title}</h2>
      <p className="body-copy">{item.description}</p>
      <ul className="detail-list">
        {item.details.map((detail) => (
          <li key={detail.label}>
            {detail.label}
            <span>{detail.value}</span>
          </li>
        ))}
      </ul>
      <ExternalButtonLink href={actionHref}>{item.action}</ExternalButtonLink>
    </article>
  );
}
