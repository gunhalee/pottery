import { SiteLink } from "@/components/navigation/site-link";
import { siteConfig } from "@/lib/config/site";
import { SiteHeaderNav } from "./site-header-nav";

export function SiteHeader() {
  return (
    <header className="site-nav" id="site-header">
      <SiteLink href="/" className="nav-logo">
        {siteConfig.name}
      </SiteLink>
      <SiteHeaderNav items={siteConfig.navigation} />
      <SiteHeaderEffectsScript />
    </header>
  );
}

function SiteHeaderEffectsScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  var relatedRoutePrefixes = { "/shop": ["/checkout", "/order/lookup"] };

  function isActiveNavItem(pathname, href) {
    var prefixes = [href].concat(relatedRoutePrefixes[href] || []);
    return prefixes.some(function (prefix) {
      return pathname === prefix || pathname.indexOf(prefix + "/") === 0;
    });
  }

  function syncHeader() {
    var pathname = window.location.pathname;
    var header = document.getElementById("site-header");

    document.querySelectorAll("[data-nav-href]").forEach(function (link) {
      var href = link.getAttribute("data-nav-href");
      var active = href ? isActiveNavItem(pathname, href) : false;
      link.classList.toggle("nav-link-active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (!header) {
      return;
    }

    if (pathname !== "/" || !document.querySelector(".home-hero")) {
      header.classList.remove("site-nav-scrolled");
      return;
    }

    function updateScrollState() {
      header.classList.toggle("site-nav-scrolled", window.scrollY > 12);
    }

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncHeader, { once: true });
  } else {
    syncHeader();
  }
})();`,
      }}
    />
  );
}
