export const siteConfig = {
  name: "콩새와 도자기공방",
  description:
    "차분한 도자 작업과 수업, 작품 소식을 전하는 공방 웹사이트입니다.",
  instagramUrl: "https://www.instagram.com/",
  kakaoChannelUrl:
    process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "https://pf.kakao.com/",
  navigation: [
    { href: "/intro", label: "소개" },
    { href: "/news", label: "소식" },
    { href: "/gallery", label: "작업물" },
    { href: "/class", label: "함께하기" },
    { href: "/shop", label: "소장하기" },
  ],
} as const;
