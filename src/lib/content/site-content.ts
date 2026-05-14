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

export type WorkPreview = {
  imageAlt: string;
  imageSrc: string;
  summary: string;
  title: string;
};

export type TogetherRecord = {
  course: string;
  made: string;
  note: string;
  title: string;
};

export const homeHero = {
  taglines: ["고운 바탕"],
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
    description: "곁에 둘 수 있는 작업",
    href: "/shop",
    label: "소장하기",
    title: "작업물 소장",
  },
] as const satisfies ReadonlyArray<HomeEntryCard>;

export const homeStory = {
  ctaHref: "/intro",
  ctaLabel: "소개 보기",
  description:
    "화분과 그릇, 작은 기물은 같은 태도에서 출발합니다. 흙은 초록을 받치고, 작은 동물은 그 곁에 놓이며, 사람의 손이 닿는 시간은 기물 안에 조용히 남습니다.",
  imageAlt: potOnForestFourthImage.alt,
  imageLabel: "초록을 담은 도자",
  imageSrc: potOnForestFourthImage.src,
  title: "초록을 담은 도자",
  titleEmphasis: "",
} as const satisfies HomeStoryContent;

export const homeRecentWorkFallbacks = [
  {
    imageAlt: potOnForestFourthImage.alt,
    imageSrc: potOnForestFourthImage.src,
    summary: "초록이 머무는 작은 풍경",
    title: "화분 위의 숲",
  },
  {
    imageAlt: "햇빛이 드는 창가에 놓인 흰 도자 화분과 초록 식물",
    imageSrc: "/asset/green-pot.webp",
    summary: "식물 곁에 오래 놓이는 형태",
    title: "초록을 담은 화분",
  },
  {
    imageAlt: "화분 흙 위에 놓인 흙으로 만든 작은 강아지 기물",
    imageSrc: "/asset/dog.webp",
    summary: "흙으로 다시 태어난 작은 생명",
    title: "화분 위의 친구",
  },
] as const satisfies readonly WorkPreview[];

export const homeWorks: WorkItem[] = [
  {
    description: "초록이 머무는 작은 풍경",
    href: "/shop",
    placeholder: "작업물 01",
    title: "화분 위의 숲",
  },
  {
    description: "손의 결을 남긴 흙의 형태",
    href: "/shop",
    placeholder: "작업물 02",
    title: "흙색 토분",
    tone: "dark",
  },
  {
    description: "작은 생명이 놓이는 자리",
    href: "/shop",
    placeholder: "작업물 03",
    title: "화분 위의 친구",
  },
];

export const homeQuickLinks = [
  {
    description:
      "정해진 결과물을 빠르게 만드는 대신, 흙의 성질과 자기 손의 속도를 익히는 시간입니다.",
    eyebrow: "수업",
    href: "/class",
    title: "흙을 만지는 시간",
  },
  {
    description: "작업물과 공방의 계절, 새로 빚은 형태의 이야기를 전합니다.",
    eyebrow: "소식",
    href: "/news",
    title: "공방의 기록",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  eyebrow: string;
  href: LinkHref;
  title: string;
}>;

export const introFeatures: FeatureSection[] = [
  {
    eyebrow: "공간",
    imageLabel: "수레실길",
    paragraphs: [
      "경기도 광주 수레실길 안쪽의 작은 공방에서 흙의 형태를 빚습니다. 이곳의 작업은 완성된 물건만이 아니라, 창가의 초록과 작업대의 흙, 다녀간 사람들의 시간이 함께 놓이는 방식으로 이어집니다.",
      "처음에는 두 사람이 열었던 공간이었고, 지금은 그때 시작된 흙과 초록의 시간을 현재의 작업으로 이어가고 있습니다.",
    ],
    title: "수레실길의 작업 공간",
    titleEmphasis: "",
  },
  {
    eyebrow: "작업관",
    imageLabel: "초록과 도자",
    imageTone: "dark",
    paragraphs: [
      "초록을 담는 도자는 단순한 화분이 아니라 식물이 머물 자리를 함께 생각하는 일입니다. 흙의 무게, 물이 지나가는 길, 손으로 만졌을 때의 질감까지 식물과 사람이 오래 곁에 둘 수 있는 형태를 살핍니다.",
      "화분, 그릇, 작은 기물은 서로 다른 용도를 갖지만 같은 태도에서 출발합니다. 쓰임과 생명이 함께 놓일 수 있는 도자를 천천히 만듭니다.",
    ],
    reverse: true,
    title: "초록과 도자",
    titleEmphasis: "",
  },
  {
    eyebrow: "공방",
    imageLabel: "함께 머무는 곳",
    imageVariant: "wide",
    paragraphs: [
      "이 공방에는 사람과 식물, 동물의 시간이 함께 머뭅니다. 반려동물과 함께 오는 방문을 환영하고, 흙으로 만든 작은 친구들은 화분 위의 풍경처럼 놓입니다.",
      "창가의 초록, 흙 위의 작은 동물, 다녀간 사람들의 손끝에서 공방의 시간은 천천히 겹쳐집니다.",
    ],
    title: "사람과 식물, 동물이 함께 머무는 곳",
    titleEmphasis: "",
  },
];

export const paletteLabels = [
  "백색",
  "회색",
  "흙색",
  "그늘",
  "먹색",
] as const;

export const newsItems = [
  {
    date: "2026.04",
    description: "봄 시즌 작업물과 공방 오픈 일정을 안내합니다.",
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
  { date: "05.12", place: "수레실길 공방", title: "공방 작업일" },
  { date: "05.19", place: "수레실길 공방", title: "원데이 클래스" },
  { date: "06.02", place: "온라인 스토어", title: "작업물 입고" },
] as const;

export const galleryItems = [
  { title: "화분 위의 숲" },
  { title: "초록을 담은 화분" },
  { title: "화분 위의 친구" },
  { featured: true, title: "흙과 초록의 작업 과정" },
  { title: "무유 토분" },
  { title: "손의 결이 남은 기물" },
  { title: "식물 곁의 작은 도자" },
  { title: "수레실길의 작업물" },
] as const;

export const classItems = [
  {
    action: "예약 문의",
    description:
      "처음 흙을 만지는 분도 괜찮습니다. 손의 속도에 맞춰 작은 기물부터 시작합니다.",
    details: [
      { label: "구성", value: "기초 체험" },
      { label: "시간", value: "예약 시 안내" },
      { label: "비용", value: "60,000원" },
      { label: "인원", value: "1명부터" },
    ],
    eyebrow: "원데이",
    title: "원데이클래스",
  },
  {
    action: "예약 문의",
    description:
      "둘이 함께 접시나 컵을 빚으며 그날의 시간을 작은 물건으로 남깁니다.",
    details: [
      { label: "구성", value: "2인 체험" },
      { label: "시간", value: "예약 시 안내" },
      { label: "비용", value: "100,000원" },
      { label: "인원", value: "2명" },
    ],
    eyebrow: "커플",
    title: "커플 원데이클래스",
  },
  {
    action: "상담 문의",
    description:
      "핀칭, 코일링, 판성형, 가압성형과 장식기법을 익히며 손의 기본기를 다집니다.",
    details: [
      { label: "구성", value: "주 1회 x 4주" },
      { label: "과정", value: "기초 성형" },
      { label: "비용", value: "150,000원" },
      { label: "예시", value: "찻잔 · 공기 · 사발 · 머그" },
    ],
    eyebrow: "익힘반",
    title: "익힘반",
  },
  {
    action: "상담 문의",
    description:
      "성형기법을 손에 익히며 원하는 형태와 기능을 구현합니다.",
    details: [
      { label: "구성", value: "주 2회 x 4주" },
      { label: "과정", value: "자유 제작" },
      { label: "비용", value: "190,000원" },
      { label: "예시", value: "원형접시 · 사각판접시 · 드립퍼" },
    ],
    eyebrow: "익숙반",
    title: "익숙반",
  },
  {
    action: "상담 문의",
    description:
      "자신만의 디자인과 작업 방향을 구체화하고 싶은 분께 추천합니다.",
    details: [
      { label: "구성", value: "주 3회 x 4주" },
      { label: "과정", value: "개인 작업" },
      { label: "비용", value: "240,000원" },
      { label: "재료", value: "소지 · 유약 · 도구 협의" },
    ],
    eyebrow: "야심반",
    title: "야심반",
  },
] as const satisfies readonly ClassItem[];

export const classReviews = [
  {
    cite: "결혼기념일 / 커플 원데이",
    quote: "함께 빚은 접시가 그날을 오래 기억하게 해줄 물건으로 남았습니다.",
  },
  {
    cite: "친구와 함께 / 원데이",
    quote: "따뜻한 대화를 나누며 컵을 만들고, 완성될 시간을 함께 기다렸습니다.",
  },
  {
    cite: "수레실길 공방 / 원데이",
    quote: "처음 만지는 흙도 천천히 다루면 각자의 모양으로 남습니다.",
  },
] as const;

export const togetherRecords = [
  {
    course: "익힘반",
    made: "찻잔 · 공기 · 작은 접시",
    note: "처음에는 흙의 두께를 맞추는 일부터 시작해, 손에 남는 압력과 작은 쓰임을 하나씩 배워간 시간입니다.",
    title: "처음의 손이 남긴 기물",
  },
  {
    course: "익숙반",
    made: "원형접시 · 사각판접시 · 드립퍼",
    note: "원하는 형태와 쓰임을 직접 정하고, 반복 제작을 통해 균형과 완성도를 살핀 과정입니다.",
    title: "자기 쓰임을 찾아간 과정",
  },
  {
    course: "회원님 작품",
    made: "모빌 · 화분 · 생활 기물",
    note: "공방을 다녀간 사람들의 손에서 각자의 취향과 시간이 담긴 작업이 남았습니다.",
    title: "각자의 풍경이 된 작업",
  },
] as const satisfies readonly TogetherRecord[];

export const galleryFallbackItems = [
  {
    imageAlt: potOnForestFourthImage.alt,
    imageSrc: potOnForestFourthImage.src,
    summary: "초록이 머무는 작은 풍경",
    title: "화분 위의 숲",
  },
  {
    imageAlt: "햇빛이 드는 창가에 놓인 흰 도자 화분과 초록 식물",
    imageSrc: "/asset/green-pot.webp",
    summary: "식물 곁에 오래 놓이는 형태",
    title: "초록을 담은 화분",
  },
  {
    imageAlt: "화분 흙 위에 놓인 흙으로 만든 작은 강아지 기물",
    imageSrc: "/asset/dog.webp",
    summary: "흙으로 다시 태어난 작은 생명",
    title: "화분 위의 친구",
  },
] as const satisfies readonly WorkPreview[];

export const shopProducts: WorkItem[] = [
  {
    description: "초록이 머무는 작은 풍경을 흙으로 빚은 토분",
    placeholder: "01",
    price: "80,000원",
    title: "화분 위의 숲",
  },
  {
    description: "식물 곁에 오래 놓이도록 만든 무유 토분",
    placeholder: "02",
    price: "120,000원",
    title: "흙색 토분",
    tone: "dark",
  },
  {
    description: "화분 위에 조용히 놓이는 작은 흙 친구",
    placeholder: "03",
    price: "95,000원",
    title: "화분 위의 친구",
  },
];
