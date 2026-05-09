import Image from "next/image";
import { Section } from "@/components/site/primitives";
import { homeSubscribeLinks } from "@/lib/config/social-links";

export function HomeSubscribeLinksSection() {
  return (
    <Section className="home-subscribe-section">
      <div className="home-subscribe-panel">
        <p className="home-subscribe-title">소식을 구독하고 싶다면</p>
        <div className="home-subscribe-links" aria-label="소식 구독 링크">
          {homeSubscribeLinks.map((link) => (
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
          ))}
        </div>
      </div>
    </Section>
  );
}
