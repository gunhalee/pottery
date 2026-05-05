import {
  ArrowLink,
  PlaceholderFrame,
  Section,
  SectionTitle,
} from "@/components/site/primitives";
import type { HomeStoryContent } from "@/lib/content/site-content";

export function HomeStorySection({ content }: { content: HomeStoryContent }) {
  return (
    <Section className="split">
      <PlaceholderFrame className="story-image" label={content.imageLabel} />
      <div>
        <SectionTitle emphasis={content.titleEmphasis}>
          {content.title}
        </SectionTitle>
        <p className="body-copy">{content.description}</p>
        <ArrowLink href={content.ctaHref}>{content.ctaLabel}</ArrowLink>
      </div>
    </Section>
  );
}
