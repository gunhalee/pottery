import type { Metadata } from "next";
import { siteConfig, studioLocation } from "@/lib/config/site";

export type SeoImage = {
  alt?: string | null;
  height?: number | null;
  src?: string | null;
  width?: number | null;
};

export const noIndexRobots = {
  follow: false,
  googleBot: {
    follow: false,
    index: false,
  },
  index: false,
} satisfies Metadata["robots"];

export function getSiteUrl() {
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

export function getAbsoluteUrl(pathOrUrl: string) {
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl, getSiteUrl()).toString();
  }
}

export function getCanonicalUrl(path: string) {
  return getAbsoluteUrl(path);
}

export function normalizeDescription(value: string | null | undefined, max = 155) {
  const normalized = (value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export function getSeoImages(image: SeoImage | null | undefined) {
  if (!image?.src) {
    return [];
  }

  return [
    {
      alt: image.alt ?? undefined,
      height: image.height ?? undefined,
      url: getAbsoluteUrl(image.src),
      width: image.width ?? undefined,
    },
  ];
}

export function createPageMetadata({
  description,
  image,
  path,
  title,
  type = "website",
}: {
  description: string;
  image?: SeoImage | null;
  path: string;
  title: string;
  type?: "article" | "website";
}): Metadata {
  const normalizedDescription = normalizeDescription(description);
  const url = getCanonicalUrl(path);
  const images = getSeoImages(image);

  return {
    alternates: {
      canonical: path,
    },
    description: normalizedDescription,
    openGraph: {
      description: normalizedDescription,
      images,
      locale: "ko_KR",
      siteName: siteConfig.name,
      title,
      type,
      url,
    },
    title,
    twitter: {
      card: images.length > 0 ? "summary_large_image" : "summary",
      description: normalizedDescription,
      images: images.map((item) => item.url),
      title,
    },
  };
}

export function getSameAsUrls() {
  return [
    siteConfig.instagramUrl,
    siteConfig.naverBlogUrl,
    siteConfig.youtubeUrl,
    siteConfig.kakaoChannelUrl,
  ].filter((href) => href && href !== "https://pf.kakao.com/");
}

export function getBusinessTelephone() {
  return `+82-${siteConfig.phone.replace(/^0/, "").replaceAll("-", "-")}`;
}

export function getBusinessAddress() {
  return {
    addressCountry: "KR",
    addressLocality: "광주시",
    addressRegion: "경기도",
    postalCode: "12772",
    streetAddress: "수레실길 25-10 1층",
  };
}

export function getBusinessGeo() {
  return {
    latitude: studioLocation.latitude,
    longitude: studioLocation.longitude,
  };
}
