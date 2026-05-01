"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function SiteHeaderScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const header = document.getElementById("site-header");

    if (!header) {
      return;
    }

    const isHome = pathname === "/" && Boolean(document.querySelector(".home-hero"));

    if (!isHome) {
      header.classList.remove("site-nav-scrolled");
      return;
    }

    const updateScrollState = () => {
      header.classList.toggle("site-nav-scrolled", window.scrollY > 12);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
    };
  }, [pathname]);

  return null;
}
