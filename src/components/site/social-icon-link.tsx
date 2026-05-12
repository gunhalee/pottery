import Image from "next/image";
import type { SocialIconLinkData } from "@/lib/config/social-links";

type SocialIconLinkProps = {
  link: SocialIconLinkData;
};

export function SocialIconLink({ link }: SocialIconLinkProps) {
  const icon = link.footerIcon ?? link.icon;
  const className = "footer-social-link";
  const imageClassName = `footer-social-image footer-social-image-${link.key}`;
  const image = (
    <Image
      alt=""
      aria-hidden="true"
      className={imageClassName}
      height={icon.height}
      src={icon.src}
      width={icon.width}
    />
  );

  if (!link.href) {
    return (
      <span
        aria-label={`${link.label} 링크 준비 중`}
        className={`${className} footer-social-link-placeholder`}
        role="img"
      >
        {image}
      </span>
    );
  }

  return (
    <a
      aria-label={link.label}
      className={className}
      href={link.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {image}
    </a>
  );
}
