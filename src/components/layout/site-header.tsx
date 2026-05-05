import { SiteLink } from "@/components/navigation/site-link";
import { siteConfig } from "@/lib/config/site";
import { SiteHeaderScroll } from "./site-header-scroll";

export function SiteHeader() {
  return (
    <header className="site-nav" id="site-header">
      <SiteHeaderScroll />
      <SiteLink href="/" className="nav-logo">
        {siteConfig.name}
      </SiteLink>
      <nav className="nav-links" aria-label="Primary navigation">
        {siteConfig.navigation.map((item) => (
          <SiteLink key={item.label} href={item.href} className="nav-link">
            {item.label}
          </SiteLink>
        ))}
      </nav>
    </header>
  );
}
