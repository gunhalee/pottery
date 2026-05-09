import {
  ArrowLink,
  PlaceholderFrame,
  Section,
  SectionTitle,
} from "@/components/site/primitives";
import type { HomeStoryContent } from "@/lib/content/site-content";

export function HomeStorySection({ content }: { content: HomeStoryContent }) {
  return (
    <Section className="split home-story-section">
      <PlaceholderFrame
        className="story-image home-story-image-desktop"
        label={content.imageLabel}
      />
      <div className="home-story-copy">
        <div className="home-story-head">
          <SectionTitle emphasis={content.titleEmphasis}>
            {content.title}
          </SectionTitle>
          <ArrowLink href={content.ctaHref}>{content.ctaLabel}</ArrowLink>
        </div>
        <PlaceholderFrame
          className="story-image home-story-image-mobile"
          label={content.imageLabel}
        />
        <p className="body-copy">{content.description}</p>
      </div>
    </Section>
  );
}
