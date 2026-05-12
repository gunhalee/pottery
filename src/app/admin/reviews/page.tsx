import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getAdminProductFeedback,
  type AdminProductFeedbackEntry,
  type AdminProductFeedbackStatus,
} from "@/lib/admin/product-feedback";
import { updateAdminProductFeedbackStatusAction } from "./actions";

type AdminReviewsPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    status?: AdminProductFeedbackStatus | "all";
  }>;
};

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
  const reviews = await getAdminProductFeedback({ status });

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>구매평 승인</h1>
          <p>고객이 작성한 구매평과 사진을 검토한 뒤 공개 또는 숨김 처리합니다.</p>
        </div>
        <AdminNav />
      </header>

      {flags.saved ? (
        <div className="admin-alert">구매평 상태를 저장했습니다.</div>
      ) : null}
      {flags.error ? (
        <div className="admin-alert admin-alert-danger">
          구매평 상태를 저장하지 못했습니다.
        </div>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>검토 목록</h2>
          <span>{reviews.length} reviews</span>
        </div>
        <nav className="admin-review-filter" aria-label="Review status filter">
          {(["pending", "published", "hidden", "all"] as const).map((item) => (
            <Link
              aria-current={status === item ? "page" : undefined}
              href={`/admin/reviews?status=${item}`}
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
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">검토할 구매평이 없습니다.</p>
        )}
      </section>
    </main>
  );
}

function ReviewCard({ review }: { review: AdminProductFeedbackEntry }) {
  return (
    <article className="admin-review-card">
      <div className="admin-review-card-main">
        <div>
          <span className="admin-order-action">{reviewStatusLabel(review.status)}</span>
          <h2>{review.productTitle ?? "상품 정보 없음"}</h2>
          <p>
            {review.authorName} · 평점 {review.rating} ·{" "}
            {formatDateTime(review.createdAt)}
          </p>
          {review.contact ? <p>연락처: {review.contact}</p> : null}
        </div>
        {review.productSlug ? (
          <Link
            className="admin-text-button"
            href={`/shop/${review.productSlug}`}
            prefetch={false}
            target="_blank"
          >
            상품 보기
          </Link>
        ) : null}
      </div>
      <p className="admin-review-body">{review.body}</p>
      {review.images.length > 0 ? (
        <div className="admin-review-image-grid">
          {review.images.map((image) => (
            <a
              href={image.src}
              key={image.id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Image
                alt={image.alt}
                height={image.height}
                loading="lazy"
                src={image.src}
                width={image.width}
              />
            </a>
          ))}
        </div>
      ) : null}
      <form
        action={updateAdminProductFeedbackStatusAction}
        className="admin-review-actions"
      >
        <input name="feedbackId" type="hidden" value={review.id} />
        <button
          className="admin-secondary-button"
          name="status"
          type="submit"
          value="published"
        >
          공개
        </button>
        <button
          className="admin-secondary-button"
          name="status"
          type="submit"
          value="hidden"
        >
          숨김
        </button>
        <button
          className="admin-secondary-button"
          name="status"
          type="submit"
          value="pending"
        >
          대기
        </button>
      </form>
    </article>
  );
}

function reviewStatusLabel(status: AdminProductFeedbackStatus | "all") {
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
