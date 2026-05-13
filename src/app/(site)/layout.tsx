import type { ReactNode } from "react";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteTelemetry } from "@/components/layout/site-telemetry";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full" id="site-top">
      <SiteHeader />
      <main className="site-main">{children}</main>
      <SiteFooter />
      <ScrollToTopButton />
      <SiteTelemetry />
    </div>
  );
}
