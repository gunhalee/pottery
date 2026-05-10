export const siteConfig = {
  name: "콩새와 도자기공방",
  businessName: "크룬프로젝트",
  description:
    "차분한 도자 작업과 수업, 작업물 소식을 전하는 공방 웹사이트입니다.",
  email: "consepot@gmail.com",
  phone: "0507-0177-5929",
  privacyOfficer: "하지영",
  instagramUrl: "https://www.instagram.com/",
  kakaoChannelUrl:
    process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "https://pf.kakao.com/",
  naverBlogUrl:
    process.env.NEXT_PUBLIC_NAVER_BLOG_URL || "https://blog.naver.com/",
  youtubeUrl: process.env.NEXT_PUBLIC_YOUTUBE_URL || "https://www.youtube.com/",
  navigation: [
    { href: "/intro", label: "소개" },
    { href: "/news", label: "소식" },
    { href: "/gallery", label: "작업물" },
    { href: "/class", label: "함께하기" },
    { href: "/shop", label: "소장하기" },
  ],
} as const;
