import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export function SiteHeader() {
  return (
    <header className="site-nav">
      <Link href="/" className="nav-logo">
        {siteConfig.name}
      </Link>
      <nav className="nav-links" aria-label="Primary navigation">
        {siteConfig.navigation.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
