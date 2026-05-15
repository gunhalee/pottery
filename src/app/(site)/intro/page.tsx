import Image from "next/image";
import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import {
  MetaLabel,
  PageIntro,
  PageShell,
  QuoteBand,
  Section,
  SectionTitle,
} from "@/components/site/primitives";
import { SiteExternalActionLink } from "@/components/site/actions";
import { NaverPlaceMap } from "@/components/site/naver-place-map";
import dogImage from "../../../../public/asset/dog.webp";
import greenPotImage from "../../../../public/asset/green-pot.webp";
import { potOnForestFourthImage } from "@/lib/content/brand-assets";
import { siteConfig, studioLocation } from "@/lib/config/site";

type IntroImageSource = StaticImageData | string;

export const metadata: Metadata = {
  alternates: {
    canonical: "/intro",
  },
  description:
    "경기도 광주시 능평동에 있는 콩새와 도자기공방의 작업관과 위치를 소개합니다. 초록을 담는 도자, 클래스, 애견동반 방문 안내를 확인하세요.",
  openGraph: {
    description:
      "경기 광주 능평동의 애견동반 가능 도자기 공방 소개와 오시는 길.",
    title: `공방 소개 | ${siteConfig.name}`,
  },
  title: "경기 광주 능평동 도자기 공방 소개",
};

export default function IntroPage() {
  return (
    <>
      <PageShell className="intro-page-header">
        <PageIntro
          subtitle="경기도 광주시 능평동에서 초록과 흙, 사람과 동물이 함께 머무는 도자기 공방입니다."
          title="초록을 담은 도자"
          variant="editorial"
        />
      </PageShell>

      <Section className="split">
        <IntroImage
          alt={potOnForestFourthImage.alt}
          priority
          src={potOnForestFourthImage.src}
          variant="portrait"
        />
        <div>
          <MetaLabel>작업관</MetaLabel>
          <SectionTitle>흙으로 만든 작은 생태</SectionTitle>
          <p className="body-copy">
            이곳의 작업은 기물을 하나의 물건으로만 보지 않습니다. 흙은
            화분이 되어 초록이 뿌리내릴 자리를 만들고, 그릇과 작은 기물은
            사람의 손과 일상에 머뭅니다. 흙으로 빚은 작은 동물은 그 풍경
            안에 조용히 섞여 생명의 온도를 더합니다.
          </p>
          <p className="body-copy">
            화분 위의 숲처럼 가장자리의 결, 작은 장식, 손으로 남긴 흔적은
            표면의 꾸밈이 아니라 세계를 만드는 문법입니다. 초록을 담는 일,
            흙으로 생명을 다시 빚는 일, 사람과 동물이 함께 머무는 장면을
            도자 안에서 천천히 완성합니다.
          </p>
        </div>
      </Section>

      <QuoteBand>
        초록이 자라는 자리, 작은 동물이 머무는 자리, 손으로 빚은 흙이
        다시 생명의 풍경이 됩니다.
      </QuoteBand>

      <Section className="split reverse">
        <IntroImage
          alt="햇빛이 드는 창가에 놓인 흰 도자 화분과 초록 식물"
          src={greenPotImage}
          variant="portrait"
        />
        <div>
          <MetaLabel>초록</MetaLabel>
          <SectionTitle>초록과 도자</SectionTitle>
          <p className="body-copy">
            초록을 담는 도자는 단순한 화분이 아니라 식물이 머물 자리를
            함께 생각하는 일입니다. 흙의 무게, 물이 지나가는 길, 손으로
            만졌을 때의 질감까지 살피며 식물과 사람이 오래 곁에 둘 수 있는
            형태를 찾습니다.
          </p>
          <p className="body-copy">
            그래서 장식은 표면에 붙은 무늬로만 남지 않습니다. 식물이 놓일
            풍경을 만들고, 생활 속 쓰임과 생명이 함께 머무는 자리를 천천히
            빚어갑니다.
          </p>
        </div>
      </Section>

      <Section className="split">
        <IntroImage
          alt="화분 흙 위에 놓인 흙으로 만든 작은 강아지 기물"
          src={dogImage}
          variant="wide"
        />
        <div>
          <MetaLabel>공방</MetaLabel>
          <SectionTitle>사람과 식물, 동물이 함께 머무는 곳</SectionTitle>
          <p className="body-copy">
            이곳의 풍경은 완성된 작업물에만 머물지 않습니다. 창가의 초록,
            흙 위의 작은 동물, 다녀간 사람들의 손끝에서 공방의 시간은
            천천히 겹쳐집니다.
          </p>
        </div>
      </Section>

      <Section className="split reverse" id="pet-friendly">
        <div>
          <MetaLabel>애견동반</MetaLabel>
          <SectionTitle>반려견과 함께 머무는 공방</SectionTitle>
          <p className="body-copy">
            공방은 사람과 식물, 동물이 함께 머무는 장면을 소중하게
            생각합니다. 반려견과 함께 방문하고 싶다면 예약 전 카카오채널이나
            예약 문의로 동반 가능 여부를 먼저 확인해 주세요.
          </p>
          <p className="body-copy">
            수업 중에는 다른 참여자와 작업물, 공방 도구가 함께 있는 만큼
            반려견의 컨디션과 현장 상황을 살펴 조용하고 안전하게 머무를 수
            있도록 안내합니다.
          </p>
        </div>
        <dl className="studio-location-details">
          <div>
            <dt>문의</dt>
            <dd>예약 전 반려견 동반 가능 여부를 확인해 주세요.</dd>
          </div>
          <div>
            <dt>배려</dt>
            <dd>다른 수강생과 작업물의 안전을 함께 살핍니다.</dd>
          </div>
          <div>
            <dt>현장</dt>
            <dd>동반 기준은 수업 일정과 공방 상황에 따라 달라질 수 있습니다.</dd>
          </div>
        </dl>
      </Section>

      <Section className="studio-location-section" id="location">
        <div className="studio-location-copy">
          <MetaLabel>오시는 길</MetaLabel>
          <SectionTitle>콩새와 도자기공방 위치</SectionTitle>
          <p className="body-copy">
            방문과 수업 상담은 예약제로 운영합니다. 수레실길 안쪽의 조용한
            골목에 자리하고 있어, 예약 시간에 맞춰 천천히 들러주세요.
          </p>
          <dl className="studio-location-details">
            <div>
              <dt>주소</dt>
              <dd>{studioLocation.address}</dd>
            </div>
            <div>
              <dt>문의</dt>
              <dd>
                <a href={`tel:${studioLocation.phone.replaceAll("-", "")}`}>
                  {studioLocation.phone}
                </a>
              </dd>
            </div>
          </dl>
          <div className="studio-location-actions">
            <SiteExternalActionLink href={studioLocation.naverMapUrl}>
              네이버 지도에서 보기
            </SiteExternalActionLink>
          </div>
        </div>
        <NaverPlaceMap
          address={studioLocation.address}
          latitude={studioLocation.latitude}
          longitude={studioLocation.longitude}
          name={studioLocation.name}
          placeUrl={studioLocation.naverMapUrl}
        />
      </Section>
    </>
  );
}

function IntroImage({
  alt,
  priority = false,
  src,
  variant,
}: {
  alt: string;
  priority?: boolean;
  src: IntroImageSource;
  variant: "portrait" | "wide";
}) {
  const imageProps =
    typeof src === "string" ? {} : ({ placeholder: "blur" as const });

  return (
    <figure
      className={`intro-artwork ${
        variant === "wide" ? "wide-image" : "portrait-image"
      }`}
    >
      <Image
        alt={alt}
        fill
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        quality={70}
        sizes="(max-width: 900px) calc(100vw - 48px), 560px"
        src={src}
        {...imageProps}
      />
    </figure>
  );
}
