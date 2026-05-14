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
      <h2 className="card-title">{renderClassTitle(item.title)}</h2>
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

function renderClassTitle(title: string) {
  if (title === "원데이클래스 · 커플 원데이클래스") {
    return (
      <>
        <span className="class-title-nowrap">원데이클래스 ·</span>
        <br />
        <span className="class-title-nowrap">커플 원데이클래스</span>
      </>
    );
  }

  return title;
}
