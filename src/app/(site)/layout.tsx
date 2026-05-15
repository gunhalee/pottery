import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteTelemetry } from "@/components/layout/site-telemetry";
import {
  createLocalBusinessJsonLd,
  createOrganizationJsonLd,
  createWebsiteJsonLd,
} from "@/lib/seo/json-ld";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full" id="site-top">
      <JsonLd
        id="site-identity-json-ld"
        data={[
          createOrganizationJsonLd(),
          createLocalBusinessJsonLd(),
          createWebsiteJsonLd(),
        ]}
      />
      <SiteHeader />
      <main className="site-main">{children}</main>
      <SiteFooter />
      <ScrollToTopButton />
      <SiteTelemetry />
    </div>
  );
}
