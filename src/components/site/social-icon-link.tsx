import Image from "next/image";
import type { SocialIconLinkData } from "@/lib/config/social-links";

type SocialIconLinkProps = {
  link: SocialIconLinkData;
  variant: "footer" | "page-title";
};

export function SocialIconLink({ link, variant }: SocialIconLinkProps) {
  const className =
    variant === "footer"
      ? "footer-social-link"
      : `page-title-social-link page-title-social-link-${link.key}`;
  const icon = variant === "footer" ? (link.footerIcon ?? link.icon) : link.icon;
  const imageClassName =
    variant === "footer"
      ? `footer-social-image footer-social-image-${link.key}`
      : `page-title-social-image page-title-social-image-${link.key}`;
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
      {variant === "page-title" ? <span>{link.label}</span> : null}
    </a>
  );
}
