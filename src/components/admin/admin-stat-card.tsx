type AdminStatCardTone = "danger" | "neutral" | "warning";

type AdminStatCardProps = {
  label: string;
  tone?: AdminStatCardTone;
  value: number;
};

export function AdminStatCard({
  label,
  tone = "neutral",
  value,
}: AdminStatCardProps) {
  return (
    <article className={`admin-ops-stat admin-ops-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
