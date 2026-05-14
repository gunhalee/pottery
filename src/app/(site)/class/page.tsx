import { ClassCardGrid } from "@/components/site/class-card-grid";
import { ClassReviewPanel } from "@/components/site/class-review-panel";
import { PageBottomCtaSection } from "@/components/site/page-bottom-cta-section";
import {
  MetaLabel,
  PageIntro,
  PageShell,
  SectionTitle,
} from "@/components/site/primitives";
import { pageBottomCtas } from "@/lib/content/page-ctas";
import { classItems } from "@/lib/content/site-content";
import { siteConfig } from "@/lib/config/site";
import { getPublishedClassSessions } from "@/lib/shop/class-sessions";
import { getPublishedClassReviews } from "@/lib/shop/class-reviews";

export default async function ClassPage() {
  const [publishedClassReviews, classSessions] = await Promise.all([
    getPublishedClassReviews(),
    getPublishedClassSessions(),
  ]);

  return (
    <>
      <PageShell className="listing-page-shell">
        <PageIntro
          action={
            <a
              className="class-reservation-top-link link-arrow"
              href={siteConfig.naverReservationUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              예약하기
            </a>
          }
          subtitle="결과물보다 손의 속도와 형태가 자라는 시간을 중요하게 여깁니다."
          title="클래스"
          variant="compact"
        />

        <ClassCardGrid
          actionHref={siteConfig.naverReservationUrl}
          items={classItems}
        />

        <section
          className="class-curriculum-section"
          aria-label="정규반 커리큘럼"
        >
          <div className="class-section-head">
            <MetaLabel>정규반</MetaLabel>
            <SectionTitle>익히고, 익숙해지고, 자기 작업으로</SectionTitle>
            <p className="body-copy">
              익힘반과 익숙반, 야심반은 흙을 다루는 법을 넓혀가는 과정입니다.
              기초 성형기법부터 개인 작업에 이르기까지,{" "}
              <span className="class-nowrap">흙의 세계를</span> 손의 언어로
              옮겨봅니다.
            </p>
          </div>
          <dl className="product-spec-list">
            <div className="product-spec-row">
              <dt>익힘반</dt>
              <dd>
                핀칭, 코일링, 판성형, 가압성형, 장식기법을 익힙니다.
                찻잔, 공기, 사발, 머그, 원형접시, 사각판접시, 드립퍼 같은
                작은 기물을 차근히 제작하며{" "}
                <span className="class-nowrap">흙의 두께와 균형</span>을
                배웁니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>익숙반</dt>
              <dd>
                다양한 성형기법을 손에 익히며 흙을 자유롭게 다룹니다.
                원하는 형태와 기능을 직접 정하고, 제작 과정에서 완성도를
                높이는 조언을 함께 나눕니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>야심반</dt>
              <dd>
                자신만의 디자인을 개발하고 창의적인 기물을 제작하고 싶은
                분을 위한 과정입니다. 충분한 개인 작업 시간을 바탕으로 소지,
                유약, 도구를 협의해 사용합니다.
              </dd>
            </div>
          </dl>
        </section>

        <section className="class-policy-spec-section" aria-label="클래스 안내">
          <dl className="product-spec-list">
            <div className="product-spec-row">
              <dt>예약</dt>
              <dd>
                클래스 예약과 결제는 네이버예약 등 외부 예약 페이지에서
                진행됩니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>취소</dt>
              <dd>
                수업 시작일 기준 3일 전까지 전액 환불, 2일 전 75% 환불, 1일 전
                50% 환불이며 수업 당일 및 노쇼는 환불이 어렵습니다. 최소 인원
                미달 또는 공방 사정으로 취소되는 경우 수업일 7일 전까지 안내 후
                전액 환불합니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>안전</dt>
              <dd>
                공방 내에서는 강사 안내와 안전수칙을 따라주세요. 도구, 물레,
                유약, 건조 중인 작품, 가마 주변 설비는 부주의하게 사용할 경우
                부상 또는 파손 위험이 있습니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>완성 과정</dt>
              <dd>작품은 건조, 초벌, 유약 작업, 재벌 과정을 거쳐 완성됩니다.</dd>
            </div>
            <div className="product-spec-row">
              <dt>유의 사항</dt>
              <dd>
                도자 작업 특성상 균열, 뒤틀림, 파손, 유약 흐름, 색상 차이가
                발생할 수 있습니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>수령 기한</dt>
              <dd>완성 안내 후 30일 이내 수령을 원칙으로 합니다.</dd>
            </div>
          </dl>
        </section>

        <section className="class-together-section" id="class-records">
          <div className="class-section-head">
            <MetaLabel>기록</MetaLabel>
            <SectionTitle>함께 한 기록</SectionTitle>
            <p className="body-copy">
              원데이의 짧은 장면부터 정규반의 작업 시간까지, 함께 빚어진
              순간들을 이곳에 모읍니다.
            </p>
          </div>
          <ClassReviewPanel
            classSessions={classSessions}
            reviews={publishedClassReviews}
          />
          {publishedClassReviews.length > 0 ? (
            <div className="together-record-grid" aria-label="정규반 작업 기록">
              {publishedClassReviews.slice(0, 3).map((record) => (
                <article className="together-record-card" key={record.id}>
                  <div className="small-caps">
                    {record.classTitle ?? "함께 한 기록"}
                  </div>
                  <h3>{record.displayName}</h3>
                  <dl>
                    <div>
                      <dt>만든 것</dt>
                      <dd>{record.classTitle ?? "수업 기록"}</dd>
                    </div>
                    <div>
                      <dt>기록</dt>
                      <dd>{record.body}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </PageShell>
      <PageBottomCtaSection
        className="class-inquiry-cta"
        ctas={pageBottomCtas.class}
        id="class-inquiries"
      />
    </>
  );
}
