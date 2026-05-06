import { HomeEntryGrid } from "@/components/home/home-entry-grid";
import { HomeHero } from "@/components/home/home-hero";
import { HomeRecentWorksSection } from "@/components/home/home-recent-works-section";
import { HomeStorySection } from "@/components/home/home-story-section";
import {
  homeEntryCards,
  homeHero,
  homeStory,
  homeWorks,
} from "@/lib/content/site-content";
import { getOptionalPublicAsset } from "@/lib/site/public-assets";
import { getPublishedProductListItems } from "@/lib/shop";

const heroVideoSrc = getOptionalPublicAsset("/asset/hero-video.mp4");

export default async function HomePage() {
  const products = await getPublishedProductListItems(3);

  return (
    <>
      <HomeHero {...homeHero} videoSrc={heroVideoSrc} />
      <HomeEntryGrid items={homeEntryCards} />
      <HomeStorySection content={homeStory} />
      <HomeRecentWorksSection fallbackItems={homeWorks} products={products} />
    </>
  );
}
