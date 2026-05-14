import type { Metadata } from "next";
import { Gothic_A1, Gowun_Batang } from "next/font/google";
import { siteConfig } from "@/lib/config/site";
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
      data-scroll-behavior="smooth"
      className={`${gothicA1.variable} ${gowunBatang.variable} h-full`}
    >
      <body className="min-h-full">
        {children}
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
