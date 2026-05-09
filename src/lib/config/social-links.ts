import { siteConfig } from "@/lib/config/site";

export type SocialIconName = "instagram" | "kakao" | "naverblog" | "youtube";

export type SocialIconAsset = {
  height: number;
  src: string;
  width: number;
};

export type SocialLinkDefinition = {
  footerIcon?: SocialIconAsset;
  href: string;
  icon: SocialIconAsset;
  key: SocialIconName;
  label: string;
};

export type SocialIconLinkData = Omit<SocialLinkDefinition, "href"> & {
  href: string | null;
};

export const socialLinks = {
  instagram: {
    href: siteConfig.instagramUrl,
    icon: {
      height: 17,
      src: "/asset/logo_instagram_bk.svg",
      width: 17,
    },
    key: "instagram",
    label: "인스타그램",
  },
  kakao: {
    href: siteConfig.kakaoChannelUrl,
    icon: {
      height: 18,
      src: "/asset/icon_kakaotalk.png",
      width: 18,
    },
    key: "kakao",
    label: "카카오채널",
  },
  naverblog: {
    footerIcon: {
      height: 13,
      src: "/asset/logo_naverblog_bk.svg",
      width: 24,
    },
    href: siteConfig.naverBlogUrl,
    icon: {
      height: 13,
      src: "/asset/logo_naverblog_bk.svg",
      width: 24,
    },
    key: "naverblog",
    label: "네이버 블로그",
  },
  youtube: {
    footerIcon: {
      height: 32,
      src: "/asset/icon_youtube_bk.png",
      width: 37,
    },
    href: siteConfig.youtubeUrl,
    icon: {
      height: 24,
      src: "/asset/icon_youtube_bk.png",
      width: 28,
    },
    key: "youtube",
    label: "YouTube",
  },
} as const satisfies Record<SocialIconName, SocialLinkDefinition>;

export const pageSocialLinks = {
  gallery: [socialLinks.instagram, socialLinks.youtube],
  news: [socialLinks.instagram, socialLinks.naverblog],
} as const satisfies Record<string, readonly SocialLinkDefinition[]>;

export const homeSubscribeLinks = [
  socialLinks.instagram,
  socialLinks.youtube,
  socialLinks.naverblog,
  socialLinks.kakao,
] as const satisfies readonly SocialLinkDefinition[];

export const footerSocialLinks = [
  socialLinks.instagram,
  {
    ...socialLinks.youtube,
    href: null,
  },
  socialLinks.naverblog,
  socialLinks.kakao,
] as const satisfies readonly SocialIconLinkData[];
