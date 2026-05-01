import {
  BottomNav,
  ExternalButtonLink,
  FollowCTA,
  PageIntro,
  PageShell,
  PlaceholderFrame,
  WorkGrid,
} from "@/components/site/primitives";
import { siteConfig } from "@/lib/config/site";
import { shopProducts } from "@/lib/content/site-content";

export default function ShopPage() {
  return (
    <>
      <PageShell>
        <PageIntro
          subtitle="공방에서 제작한 작은 오브제와 일상용 그릇을 소개합니다."
          title="Shop"
          titleEmphasis="Works"
        />

        <div className="section-gap">
          <WorkGrid
            inquiryHref={siteConfig.kakaoChannelUrl}
            items={shopProducts}
          />
        </div>

        <FollowCTA title="새 작품이 나오면 알려드릴까요" />

        <div className="custom-box" id="custom">
          <div>
            <h2 className="section-title">Custom Order</h2>
            <p className="body-copy">
              공간, 용도, 선물 목적에 맞춰 색과 크기를 상담한 뒤 제작합니다.
              제작 기간과 견적은 요청 내용에 따라 달라집니다.
            </p>
            <p className="work-sub">제작 기간 / 상담 / 견적 안내</p>
            <div className="custom-action">
              <ExternalButtonLink href={siteConfig.kakaoChannelUrl}>
                Contact
              </ExternalButtonLink>
            </div>
          </div>
          <PlaceholderFrame
            className="wide-image"
            label="Custom"
            tone="dark"
          />
        </div>
      </PageShell>
      <BottomNav
        links={[
          { href: "/gallery", label: "작업 과정 보기" },
          { href: "/news", label: "공방 소식" },
        ]}
      />
    </>
  );
}
