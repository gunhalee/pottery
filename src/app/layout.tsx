import type { Metadata } from "next";
import { Gothic_A1, Gowun_Batang } from "next/font/google";
import { siteConfig } from "@/lib/config/site";
import { getSiteUrl } from "@/lib/seo/site";
import "./globals.css";

const gothicA1 = Gothic_A1({
  adjustFontFallback: false,
  display: "optional",
  fallback: [
    "Apple SD Gothic Neo",
    "Malgun Gothic",
    "Segoe UI",
    "system-ui",
    "sans-serif",
  ],
  variable: "--font-gothic-a1",
  weight: ["300", "400", "500", "700"],
  preload: false,
});

const gowunBatang = Gowun_Batang({
  adjustFontFallback: false,
  display: "optional",
  fallback: ["AppleMyungjo", "Batang", "Times New Roman", "serif"],
  variable: "--font-gowun-batang",
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  creator: siteConfig.name,
  description: siteConfig.description,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  metadataBase: getSiteUrl(),
  openGraph: {
    description: siteConfig.description,
    locale: "ko_KR",
    siteName: siteConfig.name,
    title: siteConfig.name,
    type: "website",
  },
  publisher: siteConfig.businessName,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  twitter: {
    card: "summary_large_image",
    description: siteConfig.description,
    title: siteConfig.name,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      data-scroll-behavior="smooth"
      className={`${gothicA1.variable} ${gowunBatang.variable} h-full`}
    >
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
