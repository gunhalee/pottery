"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

type ProductFeedbackImage = {
  alt: string;
  height: number;
  id: string;
  src: string;
  width: number;
};

type ProductFeedbackEntry = {
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  images: ProductFeedbackImage[];
  rating: number;
};

type ProductFeedbackPanelProps = {
  productId: string;
  productSlug: string;
  reviewCount: number;
  reviews: ProductFeedbackEntry[];
};

type FeedbackFormStatus = {
  kind: "error" | "success";
  message: string;
} | null;

export function ProductFeedbackPanel({
  productId,
  productSlug,
  reviewCount,
  reviews,
}: ProductFeedbackPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onlyPhotoReviews, setOnlyPhotoReviews] = useState(false);
  const [status, setStatus] = useState<FeedbackFormStatus>(null);
  const visibleReviews = onlyPhotoReviews
    ? reviews.filter((review) => review.images.length > 0)
    : reviews;

  const toggleForm = () => {
    setIsFormOpen((current) => !current);
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    formData.set("productId", productId);
    formData.set("productSlug", productSlug);

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/product-feedback", {
        body: formData,
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "접수 중 오류가 발생했습니다.");
      }

      form.reset();
      setStatus({
        kind: "success",
        message: result.message ?? "접수되었습니다. 검토 후 반영됩니다.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "접수 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="product-feedback-section" id="product-reviews">
      <div className="product-feedback-head">
        <div className="product-feedback-title">
          <h2>
            구매평<span>({reviewCount})</span>
          </h2>
        </div>
        <button type="button" onClick={toggleForm}>
          구매평 작성
        </button>
      </div>
      {isFormOpen ? (
        <ProductFeedbackForm
          onSubmit={handleSubmit}
          status={status}
          submitting={isSubmitting}
        />
      ) : null}
      <label className="product-photo-review-filter">
        <input
          checked={onlyPhotoReviews}
          onChange={(event) => setOnlyPhotoReviews(event.target.checked)}
          type="checkbox"
        />
        포토 구매평만 보기
      </label>
      <ProductFeedbackList
        emptyText="등록된 구매평이 없습니다."
        entries={visibleReviews}
      />
    </section>
  );
}

function ProductFeedbackForm({
  onSubmit,
  status,
  submitting,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: FeedbackFormStatus;
  submitting: boolean;
}) {
  return (
    <form className="product-feedback-form" onSubmit={onSubmit}>
      <label className="product-feedback-field product-feedback-honeypot">
        홈페이지
        <input autoComplete="off" name="website" tabIndex={-1} type="text" />
      </label>
      <label className="product-feedback-field">
        이름
        <input name="authorName" required type="text" maxLength={40} />
      </label>
      <label className="product-feedback-field">
        연락처 또는 이메일
        <input name="contact" type="text" maxLength={120} />
      </label>
      <label className="product-feedback-field">
        평점
        <select name="rating" required defaultValue="5">
          <option value="5">5점</option>
          <option value="4">4점</option>
          <option value="3">3점</option>
          <option value="2">2점</option>
          <option value="1">1점</option>
        </select>
      </label>
      <label className="product-feedback-field product-feedback-field-wide">
        내용
        <textarea name="body" required minLength={5} maxLength={1200} />
      </label>
      <label className="product-feedback-field product-feedback-field-wide">
        사진
        <input
          accept="image/jpeg,image/png,image/webp"
          multiple
          name="photos"
          type="file"
        />
        <span className="product-feedback-help">
          jpg, png, webp / 최대 5장 / 각 20MB 이하
        </span>
      </label>
      <label className="product-feedback-consent">
        <input name="marketingConsent" type="checkbox" />
        <span>
          [선택] 작성한 구매평과 사진을 콩새와 도자기공방의 SNS, 홍보
          콘텐츠에 활용하는 데 동의합니다. 동의하지 않아도 구매평 작성은
          가능합니다.
        </span>
      </label>
      <div className="product-feedback-form-actions">
        {status ? (
          <p
            className={`product-feedback-form-status product-feedback-form-status-${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.message}
          </p>
        ) : null}
        <button className="product-feedback-submit" disabled={submitting}>
          {submitting ? "접수 중" : "접수하기"}
        </button>
      </div>
    </form>
  );
}

function ProductFeedbackList({
  emptyText,
  entries,
}: {
  emptyText: string;
  entries: ProductFeedbackEntry[];
}) {
  if (entries.length === 0) {
    return <p className="product-empty-state">{emptyText}</p>;
  }

  return (
    <ul className="product-feedback-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <div className="product-feedback-meta">
            <strong>{entry.authorName}</strong>
            <span>{formatFeedbackDate(entry.createdAt)}</span>
            <span>평점 {entry.rating}점</span>
          </div>
          <p className="product-feedback-body">{entry.body}</p>
          {entry.images.length > 0 ? (
            <div className="product-feedback-image-grid">
              {entry.images.map((image) => (
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
        </li>
      ))}
    </ul>
  );
}

function formatFeedbackDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}
