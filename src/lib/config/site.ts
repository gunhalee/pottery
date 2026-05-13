export const siteConfig = {
  name: "콩새와 도자기공방",
  businessName: "크룬프로젝트",
  description:
    "차분한 도자 작업과 수업, 작업물 소식을 전하는 공방 웹사이트입니다.",
  email: "consepot@gmail.com",
  phone: "0507-0177-5929",
  privacyOfficer: "하지영",
  instagramUrl:
    process.env.NEXT_PUBLIC_INSTAGRAM_URL ||
    "https://www.instagram.com/pottery_conse/",
  kakaoChannelUrl:
    process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "https://pf.kakao.com/",
  naverReservationUrl:
    process.env.NEXT_PUBLIC_NAVER_RESERVATION_URL ||
    "https://booking.naver.com/booking/6/bizes/1654694",
  naverBlogUrl:
    process.env.NEXT_PUBLIC_NAVER_BLOG_URL || "https://blog.naver.com/consepot",
  youtubeUrl:
    process.env.NEXT_PUBLIC_YOUTUBE_URL || "https://www.youtube.com/@consepot",
  navigation: [
    { href: "/intro", label: "소개" },
    { href: "/news", label: "소식" },
    { href: "/gallery", label: "작업물" },
    { href: "/class", label: "함께하기" },
    { href: "/shop", label: "소장하기" },
  ],
} as const;

export const studioLocation = {
  address: "12772 경기도 광주시 수레실길 25-10 1층 (능평동)",
  latitude: 37.350127611411,
  longitude: 127.16304443232,
  mapClientId: process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID || "",
  name: siteConfig.name,
  naverMapUrl:
    process.env.NEXT_PUBLIC_NAVER_MAP_URL ||
    "https://map.naver.com/p/entry/place/1574826004?c=15.00,0,0,0,dh",
  phone: siteConfig.phone,
} as const;
