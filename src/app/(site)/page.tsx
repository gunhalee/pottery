import { HomeEntryGrid } from "@/components/home/home-entry-grid";
import { HomeHero } from "@/components/home/home-hero";
import { HomeRecentWorksSection } from "@/components/home/home-recent-works-section";
import { HomeStorySection } from "@/components/home/home-story-section";
import { HomeSubscribeLinksSection } from "@/components/home/home-subscribe-links-section";
import {
  homeEntryCards,
  homeHero,
  homeStory,
} from "@/lib/content/site-content";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import { getOptionalPublicAsset } from "@/lib/site/public-assets";
import "./home.css";

const heroVideoSrc = getOptionalPublicAsset("/asset/hero-video.mp4");

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
