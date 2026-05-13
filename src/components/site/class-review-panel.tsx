"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

type ClassReviewImage = {
  alt: string;
  height: number;
  id: string;
  src: string;
  width: number;
};

type ClassReviewEntry = {
  body: string;
  classTitle: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  images: ClassReviewImage[];
};

type StaticClassReview = {
  cite: string;
  quote: string;
};

type ClassReviewPanelProps = {
  reviews: ClassReviewEntry[];
  staticReviews: readonly StaticClassReview[];
};

type ClassReviewFormStatus = {
  kind: "error" | "success";
  message: string;
} | null;

export function ClassReviewPanel({
  reviews,
  staticReviews,
}: ClassReviewPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<ClassReviewFormStatus>(null);

  const toggleForm = () => {
    setIsFormOpen((current) => !current);
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/class-reviews", {
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
    <section className="class-review-section" id="class-reviews">
      <div className="product-feedback-head class-review-head">
        <div className="product-feedback-title">
          <h2>후기</h2>
        </div>
        <button type="button" onClick={toggleForm}>
          후기 작성
        </button>
      </div>
      {isFormOpen ? (
        <ClassReviewForm
          onSubmit={handleSubmit}
          status={status}
          submitting={isSubmitting}
        />
      ) : null}
      <ClassReviewList reviews={reviews} staticReviews={staticReviews} />
    </section>
  );
}

function ClassReviewForm({
  onSubmit,
  status,
  submitting,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: ClassReviewFormStatus;
  submitting: boolean;
}) {
  return (
    <form className="product-feedback-form class-review-form" onSubmit={onSubmit}>
      <label className="product-feedback-field product-feedback-honeypot">
        웹페이지
        <input autoComplete="off" name="website" tabIndex={-1} type="text" />
      </label>
      <label className="product-feedback-field">
        이름
        <input maxLength={40} name="participantName" required type="text" />
      </label>
      <label className="product-feedback-field">
        연락처 또는 이메일
        <input maxLength={120} name="contact" type="text" />
      </label>
      <label className="product-feedback-field">
        클래스명
        <input maxLength={80} name="classTitle" type="text" />
      </label>
      <label className="product-feedback-field product-feedback-field-wide">
        내용
        <textarea maxLength={1200} minLength={5} name="body" required />
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
        <span>[선택] 작성 후기와 작업물 사진의 마케팅 활용에 동의합니다.</span>
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

function ClassReviewList({
  reviews,
  staticReviews,
}: {
  reviews: ClassReviewEntry[];
  staticReviews: readonly StaticClassReview[];
}) {
  return (
    <div className="review-grid class-review-grid">
      {reviews.map((review) => (
        <figure className="review class-review-card" key={review.id}>
          <q>{review.body}</q>
          <cite>
            {review.displayName}
            {review.classTitle ? ` / ${review.classTitle}` : ""}
            <span>{formatReviewDate(review.createdAt)}</span>
          </cite>
          {review.images.length > 0 ? (
            <div className="class-review-image-grid">
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
        </figure>
      ))}
      {staticReviews.map((review) => (
        <figure className="review" key={review.quote}>
          <q>{review.quote}</q>
          <cite>{review.cite}</cite>
        </figure>
      ))}
    </div>
  );
}

function formatReviewDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}
