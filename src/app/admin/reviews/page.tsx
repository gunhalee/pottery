import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminActionButton,
  AdminActionLink,
  AdminEmptyText,
} from "@/components/admin/admin-actions";
import { ArtworkImage } from "@/components/media/artwork-image";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getAdminClassReviews,
  type AdminClassReviewEntry,
  type AdminClassReviewStatus,
} from "@/lib/admin/class-reviews";
import {
  getAdminProductFeedback,
  type AdminProductFeedbackEntry,
  type AdminProductFeedbackStatus,
} from "@/lib/admin/product-feedback";
import {
  revokeAdminClassReviewConsentAction,
  updateAdminClassReviewSessionAction,
  updateAdminClassReviewStatusAction,
  updateAdminProductFeedbackStatusAction,
} from "./actions";
import {
  getAdminClassSessions,
  type ClassSessionSummary,
} from "@/lib/shop/class-sessions";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

type AdminReviewsPageProps = {
  searchParams: Promise<{
    classStatus?: AdminClassReviewStatus | "all";
    error?: string;
    saved?: string;
    status?: AdminProductFeedbackStatus | "all";
  }>;
};

type ReviewStatusFilter = AdminProductFeedbackStatus | "all";

export const metadata = {
  title: "Reviews Admin",
};

export default async function AdminReviewsPage({
  searchParams,
}: AdminReviewsPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/reviews");
  }

  const flags = await searchParams;
  const status = flags.status ?? "pending";
  const classStatus = flags.classStatus ?? "pending";
  const [reviews, classReviews, classSessions] = await Promise.all([
    getAdminProductFeedback({ status }),
    getAdminClassReviews({ status: classStatus }),
    getAdminClassSessions(),
  ]);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>후기 승인</h1>
          <p>
            구매평과 클래스 후기를 검토한 뒤 공개, 대기, 숨김 상태로 관리합니다.
          </p>
        </div>
        <AdminNav />
      </header>

      {flags.saved ? (
        <div className="admin-alert">후기 상태를 저장했습니다.</div>
      ) : null}
      {flags.error ? (
        <div className="admin-alert admin-alert-danger">
          후기 상태를 저장하지 못했습니다.
        </div>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>구매평</h2>
          <span>{reviews.length} reviews</span>
        </div>
        <nav className="admin-review-filter" aria-label="Product review filter">
          {(["pending", "published", "hidden", "all"] as const).map((item) => (
            <Link
              aria-current={status === item ? "page" : undefined}
              href={`/admin/reviews?status=${item}&classStatus=${classStatus}`}
              key={item}
              prefetch={false}
            >
              {reviewStatusLabel(item)}
            </Link>
          ))}
        </nav>
        {reviews.length > 0 ? (
          <div className="admin-review-list">
            {reviews.map((review) => (
              <ProductReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <AdminEmptyText>검토할 구매평이 없습니다.</AdminEmptyText>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>클래스 후기</h2>
          <span>{classReviews.length} reviews</span>
        </div>
        <nav className="admin-review-filter" aria-label="Class review filter">
          {(["pending", "published", "hidden", "all"] as const).map((item) => (
            <Link
              aria-current={classStatus === item ? "page" : undefined}
              href={`/admin/reviews?status=${status}&classStatus=${item}`}
              key={item}
              prefetch={false}
            >
              {reviewStatusLabel(item)}
            </Link>
          ))}
        </nav>
        {classReviews.length > 0 ? (
          <div className="admin-review-list">
            {classReviews.map((review) => (
              <ClassReviewCard
                classSessions={classSessions}
                key={review.id}
                review={review}
              />
            ))}
          </div>
        ) : (
          <AdminEmptyText>검토할 클래스 후기가 없습니다.</AdminEmptyText>
        )}
      </section>
    </main>
  );
}

function ProductReviewCard({
  review,
}: {
  review: AdminProductFeedbackEntry;
}) {
  return (
    <article className="admin-review-card">
      <div className="admin-review-card-main">
        <div>
          <span className="admin-order-action">
            {reviewStatusLabel(review.status)}
          </span>
          <h2>{review.productTitle ?? "상품 정보 없음"}</h2>
          <p>
            {review.authorName} · 평점 {review.rating} ·{" "}
            {formatDateTime(review.createdAt)}
          </p>
          {review.contact ? <p>연락처 {review.contact}</p> : null}
          <p>
            홍보 활용 동의:{" "}
            {review.marketingConsent
              ? `동의${review.marketingConsentAt ? ` (${formatDateTime(review.marketingConsentAt)})` : ""}`
              : "미동의"}
          </p>
          {review.marketingConsentScope ? (
            <p>동의 범위: {review.marketingConsentScope}</p>
          ) : null}
        </div>
        {review.productSlug ? (
          <AdminActionLink
            href={`/shop/${review.productSlug}`}
            target="_blank"
          >
            상품 보기
          </AdminActionLink>
        ) : null}
      </div>
      <p className="admin-review-body">{review.body}</p>
      <AdminReviewImages images={review.images} />
      <form
        action={updateAdminProductFeedbackStatusAction}
        className="admin-review-actions"
      >
        <input name="feedbackId" type="hidden" value={review.id} />
        <ReviewStatusButtons />
      </form>
    </article>
  );
}

function ClassReviewCard({
  classSessions,
  review,
}: {
  classSessions: ClassSessionSummary[];
  review: AdminClassReviewEntry;
}) {
  return (
    <article className="admin-review-card">
      <div className="admin-review-card-main">
        <div>
          <span className="admin-order-action">
            {reviewStatusLabel(review.status)}
          </span>
          <h2>{review.classTitle ?? review.classSessionTitle ?? "클래스 후기"}</h2>
          <p>
            {review.participantName} · {formatDateTime(review.createdAt)}
          </p>
          {review.classSessionTitle ? (
            <p>연결 회차: {review.classSessionTitle}</p>
          ) : null}
          {review.contact ? <p>연락처 {review.contact}</p> : null}
          <p>
            활용 동의: {review.marketingConsent ? "동의" : "미동의"}
            {review.marketingConsentAt
              ? ` · 동의 일시 ${formatDateTime(review.marketingConsentAt)}`
              : ""}
            {review.revokedAt
              ? ` · 철회 ${formatDateTime(review.revokedAt)}`
              : ""}
          </p>
          {review.marketingConsentScope ? (
            <p>동의 범위: {review.marketingConsentScope}</p>
          ) : null}
          {review.consentText ? <p>동의 문구: {review.consentText}</p> : null}
        </div>
      </div>
      <p className="admin-review-body">{review.body}</p>
      <AdminReviewImages images={review.images} />
      <div className="admin-review-actions">
        <form action={updateAdminClassReviewSessionAction}>
          <input name="reviewId" type="hidden" value={review.id} />
          <select
            aria-label="클래스 회차 연결"
            defaultValue={review.classSessionId ?? ""}
            name="classSessionId"
          >
            <option value="">연결 없음</option>
            {classSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
                {session.dateLabel || session.sessionDate
                  ? ` · ${session.dateLabel || session.sessionDate}`
                  : ""}
              </option>
            ))}
          </select>
          <AdminActionButton type="submit">
            회차 연결 저장
          </AdminActionButton>
        </form>
        <form action={updateAdminClassReviewStatusAction}>
          <input name="reviewId" type="hidden" value={review.id} />
          <ReviewStatusButtons />
        </form>
        {review.marketingConsent && !review.revokedAt ? (
          <form action={revokeAdminClassReviewConsentAction}>
            <input name="reviewId" type="hidden" value={review.id} />
            <AdminActionButton type="submit">
              동의 철회 처리
            </AdminActionButton>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function AdminReviewImages({
  images,
}: {
  images: Array<{
    alt: string;
    height: number;
    id: string;
    src: string;
    width: number;
  }>;
}) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="admin-review-image-grid">
      {images.map((image) => (
        <a
          href={image.src}
          key={image.id}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ArtworkImage
            alt={image.alt}
            height={image.height}
            loading="lazy"
            sizes={mediaImageSizes.adminReviewThumbnail}
            src={image.src}
            width={image.width}
          />
        </a>
      ))}
    </div>
  );
}

function ReviewStatusButtons() {
  return (
    <>
      <AdminActionButton
        name="status"
        type="submit"
        value="published"
      >
        공개
      </AdminActionButton>
      <AdminActionButton
        name="status"
        type="submit"
        value="hidden"
      >
        숨김
      </AdminActionButton>
      <AdminActionButton
        name="status"
        type="submit"
        value="pending"
      >
        대기
      </AdminActionButton>
    </>
  );
}

function reviewStatusLabel(status: ReviewStatusFilter) {
  return {
    all: "전체",
    hidden: "숨김",
    pending: "승인 대기",
    published: "공개",
  }[status];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
