import Image from "next/image";
import { Section } from "@/components/site/primitives";
import {
  homeSubscribeLinks,
  type SocialIconLinkData,
} from "@/lib/config/social-links";

type HomeSubscribeLinksSectionProps = {
  ariaLabel?: string;
  className?: string;
  links?: readonly SocialIconLinkData[];
  title?: string;
};

export function HomeSubscribeLinksSection({
  ariaLabel = "소식 구독 링크",
  className,
  links = homeSubscribeLinks,
  title = "소식을 구독하고 싶다면",
}: HomeSubscribeLinksSectionProps) {
  return (
    <Section
      className={["home-subscribe-section", className]
        .filter(Boolean)
        .join(" ")}
      deferred
    >
      <div className="home-subscribe-panel">
        <p className="home-subscribe-title">{title}</p>
        <div className="home-subscribe-links" aria-label={ariaLabel}>
          {links.map((link) =>
            link.href ? (
              <a
                aria-label={link.label}
                className={`home-subscribe-link home-subscribe-link-${link.key}`}
                href={link.href}
                key={link.key}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className={`home-subscribe-icon home-subscribe-icon-${link.key}`}
                  height={link.icon.height}
                  src={link.icon.src}
                  width={link.icon.width}
                />
              </a>
            ) : null,
          )}
        </div>
      </div>
    </Section>
  );
}
