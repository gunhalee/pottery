import {
  ArrowLink,
  PlaceholderFrame,
  Section,
  SectionTitle,
} from "@/components/site/primitives";
import { ArtworkImage } from "@/components/media/artwork-image";
import type { HomeStoryContent } from "@/lib/content/site-content";

const homeStoryImageSizes = "(max-width: 900px) calc(100vw - 48px), 560px";

export function HomeStorySection({ content }: { content: HomeStoryContent }) {
  return (
    <Section className="split home-story-section" deferred>
      <StoryImage
        className="home-story-image-desktop"
        content={content}
        eager
      />
      <div className="home-story-copy">
        <div className="home-story-head">
          <SectionTitle emphasis={content.titleEmphasis}>
            {content.title}
          </SectionTitle>
          <ArrowLink href={content.ctaHref}>{content.ctaLabel}</ArrowLink>
        </div>
        <StoryImage className="home-story-image-mobile" content={content} />
        <p className="body-copy">{content.description}</p>
      </div>
    </Section>
  );
}

function StoryImage({
  className,
  content,
  eager = false,
}: {
  className: string;
  content: HomeStoryContent;
  eager?: boolean;
}) {
  if (!content.imageSrc) {
    return (
      <PlaceholderFrame
        className={`story-image ${className}`}
        label={content.imageLabel}
      />
    );
  }

  return (
    <span className={`story-image home-story-artwork ${className}`}>
      <ArtworkImage
        alt={content.imageAlt ?? content.imageLabel}
        className="home-story-artwork-img"
        fetchPriority={eager ? "low" : "auto"}
        fill
        loading={eager ? "eager" : "lazy"}
        quality={70}
        sizes={homeStoryImageSizes}
        src={content.imageSrc}
      />
    </span>
  );
}
