import { MetaLabel, PageShell } from "@/components/site/primitives";

type PlaceholderPageProps = {
  checklist: string[];
  description: string;
  eyebrow: string;
  title: string;
};

export function PlaceholderPage({
  checklist,
  description,
  eyebrow,
  title,
}: PlaceholderPageProps) {
  return (
    <PageShell>
      <div className="placeholder-layout">
        <div>
          <MetaLabel>{eyebrow}</MetaLabel>
          <h1 className="section-title">{title}</h1>
          <p className="body-copy">{description}</p>
        </div>
        <aside className="placeholder-panel">
          <div className="small-caps">Next Up</div>
          <ul className="placeholder-list">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </PageShell>
  );
}
