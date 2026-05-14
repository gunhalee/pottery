import Image from "next/image";
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
import { paletteLabels } from "@/lib/content/site-content";
import { studioLocation } from "@/lib/config/site";

type IntroImageSource = StaticImageData | string;

export default function IntroPage() {
  return (
    <>
      <PageShell className="intro-page-header">
        <PageIntro
          subtitle="화분, 그릇, 작은 기물 속에 사람과 식물, 동물의 이야기를 녹여냅니다."
          title="초록을 담은 도자"
          variant="editorial"
        />
      </PageShell>

      <Section className="split">
        <IntroImage
          alt={potOnForestFourthImage.alt}
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

      <div className="palette-grid">
        {paletteLabels.map((label) => (
          <div className="palette-cell" key={label}>
            <span>{label}</span>
          </div>
        ))}
      </div>

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
            이 공방에는 사람과 식물, 동물의 시간이 함께 머뭅니다.
            곁에 있는 동물의 존재도 이곳의 자연스러운 풍경입니다. 흙으로
            만든 작은 친구들은 초록 사이에 다시 태어난 생명처럼 화분 위에
            놓입니다.
          </p>
          <p className="body-copy">
            이곳의 풍경은 완성된 작업물에만 머물지 않습니다. 창가의 초록,
            흙 위의 작은 동물, 다녀간 사람들의 손끝에서 공방의 시간은
            천천히 겹쳐집니다.
          </p>
        </div>
      </Section>

      <Section className="intro-legacy-section">
        <MetaLabel>기록</MetaLabel>
        <SectionTitle>처음의 이름</SectionTitle>
        <p className="body-copy">
          공방은 처음에 콩새와 팥새라는 이름으로 시작했습니다. 지금은
          콩새와 도자기공방의 이름으로 이어가며, 그때 시작된 흙과 초록의
          시간을 현재의 작업 세계 안에 조용히 담고 있습니다.
        </p>
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
  src,
  variant,
}: {
  alt: string;
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
        quality={70}
        sizes="(max-width: 900px) calc(100vw - 48px), 560px"
        src={src}
        {...imageProps}
      />
    </figure>
  );
}
