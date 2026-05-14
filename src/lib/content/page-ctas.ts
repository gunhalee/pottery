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
      body: "클래스를 신청하고 싶다면",
      href: siteConfig.naverReservationUrl,
      kind: "external",
      label: "네이버예약으로 이동",
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
      label: "예약하기",
    },
  ],
} as const satisfies Record<string, readonly PageCta[]>;
