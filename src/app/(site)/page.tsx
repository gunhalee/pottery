import { HomeEntryGrid } from "@/components/home/home-entry-grid";
import {
  HomeHero,
  type HomeHeroMediaItem,
} from "@/components/home/home-hero";
import { HomeRecentWorksSection } from "@/components/home/home-recent-works-section";
import { HomeStorySection } from "@/components/home/home-story-section";
import {
  homeEntryCards,
  homeHero,
  homeStory,
  homeWorks,
} from "@/lib/content/site-content";
import { getPublishedContentEntries } from "@/lib/content-manager/content-store";
import {
  getProductListImage,
  getPublishedProducts,
  type ConsepotProduct,
} from "@/lib/shop";

const heroImageLimit = 6;

export default async function HomePage() {
  const [products, galleryItems] = await Promise.all([
    getPublishedProducts(),
    getPublishedContentEntries("gallery"),
  ]);
  const heroMediaItems = buildHeroMediaItems(products, galleryItems);

  return (
    <>
      <HomeHero {...homeHero} mediaItems={heroMediaItems} />
      <HomeEntryGrid items={homeEntryCards} />
      <HomeStorySection content={homeStory} />
      <HomeRecentWorksSection fallbackItems={homeWorks} products={products} />
    </>
  );
}

function buildHeroMediaItems(
  products: ConsepotProduct[],
  galleryItems: Awaited<ReturnType<typeof getPublishedContentEntries>>,
) {
  const productImages: HomeHeroMediaItem[] = products.flatMap((product) => {
    const image = getProductListImage(product);

    if (!image?.src) {
      return [];
    }

    return [
      {
        alt: image.alt,
        label: product.titleKo,
        src: image.src,
      },
    ];
  });
  const galleryImages: HomeHeroMediaItem[] = galleryItems.flatMap((entry) => {
    const image = entry.images.find((item) => item.isListImage) ?? null;

    if (!image?.src) {
      return [];
    }

    return [
      {
        alt: image.alt,
        label: entry.title,
        src: image.src,
      },
    ];
  });

  return [...productImages, ...galleryImages].slice(0, heroImageLimit);
}
