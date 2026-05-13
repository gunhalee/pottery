import {
  MetaLabel,
  PageIntro,
  PageShell,
  QuoteBand,
  Section,
  SectionTitle,
  SplitFeature,
} from "@/components/site/primitives";
import { SiteExternalActionLink } from "@/components/site/actions";
import { NaverPlaceMap } from "@/components/site/naver-place-map";
import { introFeatures, paletteLabels } from "@/lib/content/site-content";
import { studioLocation } from "@/lib/config/site";

export default function IntroPage() {
  return (
    <>
      <PageShell className="intro-page-header">
        <PageIntro
          subtitle="흙과 손, 쓰임을 중심에 둔 공방입니다."
          title="콩새와 도자기 공방은"
          variant="editorial"
        />
      </PageShell>

      <SplitFeature {...introFeatures[0]} />

      <QuoteBand>
        오래 곁에 두고 쓰는 형태를 천천히 만듭니다.
      </QuoteBand>

      <SplitFeature {...introFeatures[1]} />

      <div className="palette-grid">
        {paletteLabels.map((label) => (
          <div className="palette-cell" key={label}>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <SplitFeature {...introFeatures[2]} />

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
