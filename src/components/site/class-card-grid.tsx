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
    <a
      aria-label={`${item.title} 네이버 예약하기`}
      className="class-card"
      href={actionHref}
      rel="noopener noreferrer"
      target="_blank"
    >
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
    </a>
  );
}
