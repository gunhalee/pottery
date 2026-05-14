import type { AppHref } from "@/lib/routing/types";
import { potOnForestFourthImage } from "@/lib/content/brand-assets";

type LinkHref = AppHref;

export type WorkItem = {
  description: string;
  href?: LinkHref;
  placeholder: string;
  price?: string;
  title: string;
  tone?: "light" | "dark";
};

export type FeatureSection = {
  eyebrow: string;
  imageLabel: string;
  imageTone?: "light" | "dark";
  imageVariant?: "portrait" | "wide";
  paragraphs: string[];
  reverse?: boolean;
  title: string;
  titleEmphasis: string;
};

export type DetailItem = {
  label: string;
  value: string;
};

export type ClassItem = {
  action: string;
  description: string;
  details: readonly DetailItem[];
  eyebrow: string;
  title: string;
};

export type HomeHeroTagline = string;

export type HomeEntryCard = {
  description: string;
  href: LinkHref;
  label: string;
  title: string;
};

export type HomeStoryContent = {
  ctaHref: LinkHref;
  ctaLabel: string;
  description: string;
  imageAlt?: string;
  imageLabel: string;
  imageSrc?: string;
  title: string;
  titleEmphasis: string;
};

export const homeHero = {
  taglines: [
    "화분, 그릇, 작은 기물 속에 사람과 식물, 동물의 이야기를 녹여냅니다.",
  ],
  title: "초록을 담은 흙의 형태",
} as const satisfies {
  taglines: ReadonlyArray<HomeHeroTagline>;
  title: string;
};

export const homeEntryCards = [
  {
    description: "작업과 계절의 기록",
    href: "/news",
    label: "소식",
    title: "공방 이야기",
  },
  {
    description: "흙과 초록의 형태",
    href: "/gallery",
    label: "작업물",
    title: "초록을 담은 도자",
  },
  {
    description: "손으로 가까이 경험하는 시간",
    href: "/class",
    label: "함께하기",
    title: "흙을 만지는 시간",
  },
  {
    description: "곁에 두고 쓰는 작업",
    href: "/shop",
    label: "소장하기",
    title: "작업물 소장",
  },
] as const satisfies ReadonlyArray<HomeEntryCard>;

export const homeStory = {
  ctaHref: "/intro",
  ctaLabel: "소개 보기",
  description:
    "화분과 그릇, 작은 기물은 같은 태도에서 출발합니다. 흙은 초록을 받치고, 작은 동물과 그 곁에 놓이는 사람의 이야기를 조용히 담습니다.",
  imageAlt: potOnForestFourthImage.alt,
  imageLabel: "초록을 담은 도자",
  imageSrc: potOnForestFourthImage.src,
  title: "초록을 담은 도자",
  titleEmphasis: "",
} as const satisfies HomeStoryContent;

export const paletteLabels = ["백색", "회색", "흙색", "그늘", "먹색"] as const;

export const classItems = [
  {
    action: "예약 신청",
    description:
      "처음 흙을 만지는 분도 편하게 시작할 수 있는 시간입니다.",
    details: [
      { label: "구성", value: "흙과 친해지기" },
      { label: "시간", value: "3시간" },
      { label: "비용", value: "6만원 · 10만원" },
      { label: "예시", value: "기초적인 작업의 결과물" },
    ],
    eyebrow: "원데이",
    title: "원데이클래스 · 커플 원데이클래스",
  },
  {
    action: "예약 신청",
    description:
      "핀칭, 코일링, 판성형, 가압성형과 장식기법을 익히는 과정입니다.",
    details: [
      { label: "과정", value: "기초 성형" },
      { label: "구성", value: "주 1회 x 4주" },
      { label: "비용", value: "150,000원" },
      { label: "예시", value: "찻잔 · 공기 · 사발 · 머그" },
    ],
    eyebrow: "익힘반",
    title: "익힘반",
  },
  {
    action: "예약 신청",
    description:
      "원하는 형태와 기능을 자유롭게 구현하는 과정입니다.",
    details: [
      { label: "과정", value: "자유 제작" },
      { label: "구성", value: "주 2회 x 4주" },
      { label: "비용", value: "190,000원" },
      { label: "예시", value: "원형접시 · 사각판접시 · 드리퍼" },
    ],
    eyebrow: "익숙반",
    title: "익숙반",
  },
  {
    action: "예약 신청",
    description:
      "자기 작업을 조금 더 깊게 이어가고 싶은 분께 추천드립니다.",
    details: [
      { label: "과정", value: "개인 작업" },
      { label: "구성", value: "주 3회 x 4주" },
      { label: "비용", value: "240,000원" },
      { label: "재료", value: "소지 · 유약 · 도구 협의" },
    ],
    eyebrow: "야심반",
    title: "야심반",
  },
] as const satisfies readonly ClassItem[];
