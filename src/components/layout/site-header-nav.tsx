"use client";

import { usePathname } from "next/navigation";
import { SiteLink } from "@/components/navigation/site-link";

type SiteHeaderNavItem = {
  href: string;
  label: string;
};

type SiteHeaderNavProps = {
  items: readonly SiteHeaderNavItem[];
};

const relatedRoutePrefixes: Record<string, readonly string[]> = {
  "/shop": ["/checkout", "/order/lookup"],
};

export function SiteHeaderNav({ items }: SiteHeaderNavProps) {
  const pathname = usePathname();

  return (
    <nav className="nav-links" aria-label="Primary navigation">
      {items.map((item) => {
        const isActive = isActiveNavItem(pathname, item.href);

        return (
          <SiteLink
            aria-current={isActive ? "page" : undefined}
            className={["nav-link", isActive ? "nav-link-active" : null]
              .filter(Boolean)
              .join(" ")}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </SiteLink>
        );
      })}
    </nav>
  );
}

function isActiveNavItem(pathname: string, href: string) {
  const prefixes = [href, ...(relatedRoutePrefixes[href] ?? [])];

  return prefixes.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}
