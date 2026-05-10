import { siteConfig } from "@/lib/config/site";
import type { AppHref } from "@/lib/routing/types";

export type PageCta =
  | {
      body: string;
      href: AppHref;
      kind: "internal";
      label: string;
    }
  | {
      body: string;
      href: string;
      kind: "external";
      label: string;
    };

export const pageBottomCtas = {
  class: [
    {
      body: "클래스 오픈 소식을 받으려면",
      href: siteConfig.kakaoChannelUrl,
      kind: "external",
      label: "카카오채널 추가하기",
    },
    {
      body: "클래스 문의를 하고 싶다면",
      href: siteConfig.kakaoChannelUrl,
      kind: "external",
      label: "카카오채널 문의하기",
    },
  ],
  gallery: [
    {
      body: "작업물을 소장하고 싶다면",
      href: "/shop",
      kind: "internal",
      label: "소장하기",
    },
    {
      body: "직접 만들어보고 싶다면",
      href: "/class",
      kind: "internal",
      label: "클래스 신청하기",
    },
  ],
} as const satisfies Record<string, readonly PageCta[]>;
