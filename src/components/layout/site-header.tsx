import { SiteLink } from "@/components/navigation/site-link";
import { siteConfig } from "@/lib/config/site";
import { SiteHeaderNav } from "./site-header-nav";
import { SiteHeaderScroll } from "./site-header-scroll";

export function SiteHeader() {
  return (
    <header className="site-nav" id="site-header">
      <SiteHeaderScroll />
      <SiteLink href="/" className="nav-logo">
        {siteConfig.name}
      </SiteLink>
      <SiteHeaderNav items={siteConfig.navigation} />
    </header>
  );
}
