import type { AppHref } from "@/lib/routing/types";

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

export type HomeHeroAction = {
  href: LinkHref;
  label: string;
  tone: "primary" | "ghost";
};

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
  imageLabel: string;
  title: string;
  titleEmphasis: string;
};

export const homeHero = {
  actions: [
    { href: "/shop", label: "Shop", tone: "primary" },
    { href: "/class", label: "Class", tone: "ghost" },
  ],
  title: "Headline Text Here",
} as const satisfies {
  actions: ReadonlyArray<HomeHeroAction>;
  title: string;
};

export const homeEntryCards = [
  {
    description: "현재 소장 가능한 작품들",
    href: "/shop",
    label: "Shop",
    title: "작품 소장",
  },
  {
    description: "원데이 · 정기 클래스",
    href: "/class",
    label: "Class",
    title: "직접 해보기",
  },
  {
    description: "작업 과정과 완성작",
    href: "/gallery",
    label: "Gallery",
    title: "작품 아카이브",
  },
  {
    description: "일정 · 신작 · 작업 일지",
    href: "/news",
    label: "News",
    title: "공방 소식",
  },
] as const satisfies ReadonlyArray<HomeEntryCard>;

export const homeStory = {
  ctaHref: "/intro",
  ctaLabel: "Read More",
  description:
    "느린 제작 방식과 절제된 형태를 바탕으로, 오래 곁에 두고 쓰는 도자 작품을 만듭니다. 공방의 분위기와 작업 철학을 소개합니다.",
  imageLabel: "Brand Image",
  title: "Brand Story",
  titleEmphasis: "Headline",
} as const satisfies HomeStoryContent;

export const homeWorks: WorkItem[] = [
  {
    description: "White porcelain",
    href: "/shop",
    placeholder: "Product 01",
    title: "Moon Jar",
  },
  {
    description: "Hand-thrown stoneware",
    href: "/shop",
    placeholder: "Product 02",
    title: "Tea Bowl",
    tone: "dark",
  },
  {
    description: "Matte ash glaze",
    href: "/shop",
    placeholder: "Product 03",
    title: "Small Vase",
  },
];

export const homeQuickLinks = [
  {
    description:
      "손으로 빚고 다듬는 시간을 경험할 수 있는 정규 수업과 원데이 클래스를 운영합니다.",
    eyebrow: "Class",
    href: "/class",
    title: "Section Title",
  },
  {
    description: "새 작품, 전시 일정, 공방 운영 소식을 간결하게 전합니다.",
    eyebrow: "News",
    href: "/news",
    title: "Section Title",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  eyebrow: string;
  href: LinkHref;
  title: string;
}>;

export const introFeatures: FeatureSection[] = [
  {
    eyebrow: "Section 01",
    imageLabel: "Portrait",
    paragraphs: [
      "매일의 식탁 위에서 오래 머무는 형태를 고민합니다. 과한 장식보다 균형, 무게감, 손끝에 닿는 감각을 중요하게 여깁니다.",
      "계절에 따라 달라지는 흙과 유약의 표정을 기록하며 공방의 이야기를 이어갑니다.",
    ],
    title: "Heading",
    titleEmphasis: "Text",
  },
  {
    eyebrow: "Section 02",
    imageLabel: "Works",
    imageTone: "dark",
    paragraphs: [
      "물레 성형부터 건조, 초벌, 시유, 재벌까지 모든 과정을 천천히 살핍니다. 같은 형태라도 손의 흔적이 남아 각기 다른 분위기를 가집니다.",
    ],
    reverse: true,
    title: "Heading",
    titleEmphasis: "Text",
  },
  {
    eyebrow: "Section 03",
    imageLabel: "Studio",
    imageVariant: "wide",
    paragraphs: [
      "공방 방문과 수업 상담은 예약제로 운영합니다. 조용히 작품을 보고 직접 손으로 만져볼 수 있는 시간을 준비합니다.",
    ],
    title: "Heading",
    titleEmphasis: "Text",
  },
];

export const paletteLabels = [
  "Style 01",
  "Style 02",
  "Style 03",
  "Style 04",
  "Style 05",
] as const;

export const newsItems = [
  {
    date: "2026.04",
    description: "봄 시즌 작품과 공방 오픈 일정을 안내합니다.",
    tag: "Label",
    title: "새 전시 준비 소식",
  },
  {
    date: "2026.03",
    description: "기초 성형부터 유약 테스트까지 함께하는 수업입니다.",
    tag: "Label",
    title: "정규 클래스 모집",
  },
  {
    date: "2026.02",
    description: "새로운 찻잔과 화병을 순차적으로 소개합니다.",
    tag: "Label",
    title: "온라인 스토어 업데이트",
  },
] as const;

export const scheduleItems = [
  { date: "05.12", place: "서울 공방", title: "오픈 스튜디오" },
  { date: "05.19", place: "도자 체험", title: "원데이 클래스" },
  { date: "06.02", place: "온라인 스토어", title: "작품 입고" },
] as const;

export const galleryItems = [
  { title: "작품명 / 연도" },
  { title: "작품명 / 연도" },
  { title: "작품명 / 연도" },
  { featured: true, title: "작업 과정 / 스튜디오" },
  { title: "작품명 / 연도" },
  { title: "작품명 / 연도" },
  { title: "작품명 / 스타일링" },
  { title: "작품명 / 연도" },
] as const;

export const classItems = [
  {
    action: "Book",
    description:
      "처음 흙을 만지는 분도 차분히 따라올 수 있는 기초 클래스입니다.",
    details: [
      { label: "구성", value: "물레 성형" },
      { label: "시간", value: "120분" },
      { label: "비용", value: "80,000원" },
      { label: "인원", value: "1-3명" },
    ],
    eyebrow: "Type A",
    title: "Class Name",
  },
  {
    action: "Contact",
    description: "원하는 형태와 쓰임을 함께 정해 제작하는 맞춤형 수업입니다.",
    details: [
      { label: "구성", value: "핸드빌딩" },
      { label: "시간", value: "150분" },
      { label: "비용", value: "상담 후 안내" },
      { label: "인원", value: "개인/그룹" },
    ],
    eyebrow: "Type B",
    title: "Class Name",
  },
] as const;

export const classReviews = [
  {
    cite: "이름 / 원데이 클래스",
    quote: "천천히 설명해주셔서 처음인데도 편안하게 만들 수 있었어요.",
  },
  {
    cite: "이름 / 정규 클래스",
    quote: "공방 분위기가 조용하고 작품을 기다리는 시간까지 좋았습니다.",
  },
  {
    cite: "이름 / 커스텀 클래스",
    quote: "선물용 그릇을 직접 만들 수 있어 특별한 경험이었습니다.",
  },
] as const;

export const shopProducts: WorkItem[] = [
  {
    description: "작품 설명 텍스트",
    placeholder: "01",
    price: "80,000원",
    title: "작품 이름",
  },
  {
    description: "작품 설명 텍스트",
    placeholder: "02",
    price: "120,000원",
    title: "작품 이름",
    tone: "dark",
  },
  {
    description: "작품 설명 텍스트",
    placeholder: "03",
    price: "95,000원",
    title: "작품 이름",
  },
];
