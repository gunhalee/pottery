import type { Metadata } from "next";
import { Cormorant_Garamond, Gowun_Batang, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteConfig } from "@/lib/config/site";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  preload: false,
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: "variable",
  preload: false,
});

const gowunBatang = Gowun_Batang({
  variable: "--font-gowun-batang",
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: getSiteMetadataBase(),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${cormorant.variable} ${outfit.variable} ${gowunBatang.variable} h-full`}
    >
      <body className="min-h-full">
        {children}
        <Analytics />
        <SpeedInsights />
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
