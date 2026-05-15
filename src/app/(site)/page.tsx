import type { Metadata } from "next";
import { HomeEntryGrid } from "@/components/home/home-entry-grid";
import { HomeHero } from "@/components/home/home-hero";
import { HomeRecentWorksSection } from "@/components/home/home-recent-works-section";
import { HomeStorySection } from "@/components/home/home-story-section";
import { HomeSubscribeLinksSection } from "@/components/home/home-subscribe-links-section";
import { siteConfig } from "@/lib/config/site";
import {
  homeEntryCards,
  homeHero,
  homeStory,
} from "@/lib/content/site-content";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import { getOptionalPublicAsset } from "@/lib/site/public-assets";
import "./home.css";

const heroVideoSrc = getOptionalPublicAsset("/asset/hero-video.mp4");

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  description: siteConfig.description,
  openGraph: {
    description: siteConfig.description,
    title: "콩새와 도자기공방",
    type: "website",
  },
  title: "경기 광주 능평동 도자기 클래스와 수공예 도자",
};

export default async function HomePage() {
  const recentGalleryEntries = await getPublishedContentListEntries("gallery", {
    limit: 3,
  });

  return (
    <>
      <HomeHero {...homeHero} videoSrc={heroVideoSrc} />
      <HomeEntryGrid items={homeEntryCards} />
      <HomeStorySection content={homeStory} />
      <HomeRecentWorksSection entries={recentGalleryEntries} />
      <HomeSubscribeLinksSection />
    </>
  );
}
