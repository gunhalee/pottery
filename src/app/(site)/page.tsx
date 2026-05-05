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

const heroVideoSrc = getOptionalPublicAsset("/asset/hero-video.mp4");

export default function HomePage() {
  return (
    <>
      <HomeHero {...homeHero} videoSrc={heroVideoSrc} />
      <HomeEntryGrid items={homeEntryCards} />
      <HomeStorySection content={homeStory} />
      <HomeRecentWorksSection items={homeWorks} />
    </>
  );
}
