import { SiteLink } from "@/components/navigation/site-link";

type SiteHeaderNavItem = {
  href: string;
  label: string;
};

type SiteHeaderNavProps = {
  items: readonly SiteHeaderNavItem[];
};

export function SiteHeaderNav({ items }: SiteHeaderNavProps) {
  return (
    <nav className="nav-links" aria-label="Primary navigation">
      {items.map((item) => (
        <SiteLink
          className="nav-link"
          data-nav-href={item.href}
          href={item.href}
          key={item.label}
        >
          {item.label}
        </SiteLink>
      ))}
    </nav>
  );
}
