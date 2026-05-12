import { SocialIconLink } from "@/components/site/social-icon-link";
import { PageIntro } from "@/components/site/primitives";
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
  const actions =
    socials.length > 0 ? (
      <div className="page-title-socials">
        {socials.map((social) => (
          <SocialIconLink
            key={social.key}
            link={social}
            variant="page-title"
          />
        ))}
      </div>
    ) : null;

  return (
    <PageIntro
      actions={actions}
      subtitle={subtitle}
      title={title}
      variant="listing"
    />
  );
}
