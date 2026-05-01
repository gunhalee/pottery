import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { SiteHeaderScroll } from "./site-header-scroll";

export function SiteHeader() {
  return (
    <header className="site-nav" id="site-header">
      <SiteHeaderScroll />
      <Link href="/" className="nav-logo" prefetch={false}>
        {siteConfig.name}
      </Link>
      <nav className="nav-links" aria-label="Primary navigation">
        {siteConfig.navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            prefetch={false}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
