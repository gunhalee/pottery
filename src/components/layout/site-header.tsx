import Script from "next/script";
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
    <Script id="site-header-effects" strategy="afterInteractive">
      {`
(function () {
  var relatedRoutePrefixes = { "/shop": ["/checkout", "/order/lookup"] };
  var routeSyncFrame = 0;
  var scrollTrackingEnabled = false;

  if (window.__siteHeaderEffectsStarted) {
    return;
  }

  window.__siteHeaderEffectsStarted = true;

  function isActiveNavItem(pathname, href) {
    var prefixes = [href].concat(relatedRoutePrefixes[href] || []);
    return prefixes.some(function (prefix) {
      return pathname === prefix || pathname.indexOf(prefix + "/") === 0;
    });
  }

  function updateScrollState() {
    var header = document.getElementById("site-header");

    if (!header) {
      return;
    }

    var shouldTrackScroll =
      window.location.pathname === "/" && Boolean(document.querySelector(".home-hero"));
    header.classList.toggle("site-nav-scrolled", shouldTrackScroll && window.scrollY > 12);
  }

  function setScrollTracking(enabled) {
    if (enabled === scrollTrackingEnabled) {
      return;
    }

    scrollTrackingEnabled = enabled;

    if (enabled) {
      window.addEventListener("scroll", updateScrollState, { passive: true });
    } else {
      window.removeEventListener("scroll", updateScrollState);
    }
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

    setScrollTracking(pathname === "/" && Boolean(document.querySelector(".home-hero")));
    updateScrollState();
  }

  function scheduleHeaderSync() {
    if (routeSyncFrame) {
      window.cancelAnimationFrame(routeSyncFrame);
    }

    routeSyncFrame = window.requestAnimationFrame(function () {
      routeSyncFrame = 0;
      syncHeader();
    });
  }

  function patchHistoryMethod(methodName) {
    var original = window.history[methodName];

    if (!original || original.__siteHeaderPatched) {
      return;
    }

    window.history[methodName] = function () {
      var result = original.apply(this, arguments);
      scheduleHeaderSync();
      return result;
    };
    window.history[methodName].__siteHeaderPatched = true;
  }

  function observeRouteDomChanges() {
    if (window.__siteHeaderObserver || !window.MutationObserver) {
      return;
    }

    var root = document.getElementById("site-top") || document.body;
    window.__siteHeaderObserver = new MutationObserver(scheduleHeaderSync);
    window.__siteHeaderObserver.observe(root, { childList: true, subtree: true });
  }

  function startHeaderEffects() {
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");
    window.addEventListener("popstate", scheduleHeaderSync);
    observeRouteDomChanges();
    syncHeader();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startHeaderEffects, { once: true });
  } else {
    startHeaderEffects();
  }
})();`}
    </Script>
  );
}
