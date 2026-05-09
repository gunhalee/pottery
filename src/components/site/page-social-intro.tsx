import { SocialIconLink } from "@/components/site/social-icon-link";
import type { SocialIconLinkData } from "@/lib/config/social-links";

type PageSocialIntroProps = {
  socials: readonly SocialIconLinkData[];
  subtitle: string;
  title: string;
};

export function PageSocialIntro({
  socials,
  subtitle,
  title,
}: PageSocialIntroProps) {
  return (
    <div className="page-social-intro">
      <div className="page-title-wrap">
        <h1 className="page-title">{title}</h1>
        {socials.length > 0 ? (
          <div className="page-title-socials">
            {socials.map((social) => (
              <SocialIconLink
                key={social.key}
                link={social}
                variant="page-title"
              />
            ))}
          </div>
        ) : null}
      </div>
      <p className="page-subtitle">{subtitle}</p>
    </div>
  );
}
