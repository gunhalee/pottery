import type { Metadata } from "next";
import { Gothic_A1 } from "next/font/google";
import { SiteTelemetry } from "@/components/layout/site-telemetry";
import { siteConfig } from "@/lib/config/site";
import "./globals.css";

const gothicA1 = Gothic_A1({
  variable: "--font-gothic-a1",
  weight: ["300", "400", "500", "700"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: getSiteMetadataBase(),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${gothicA1.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <SiteTelemetry />
      </body>
    </html>
  );
}

function getSiteMetadataBase() {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!rawUrl) {
    return new URL("http://localhost:3000");
  }

  try {
    return new URL(rawUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
}
