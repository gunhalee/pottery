"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArtworkImage } from "@/components/media/artwork-image";
import { SiteActionButton } from "@/components/site/actions";
import {
  ReviewEmptyState,
  ReviewFormActions,
  ReviewFormConsent,
  ReviewFormField,
  ReviewFormHelp,
  ReviewFormSubmitButton,
  type ReviewFormStatus,
} from "@/components/site/review-form-primitives";
import { submitReviewForm } from "@/components/site/review-form-submit";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

export type ProductFeedbackImage = {
  alt: string;
  height: number;
  id: string;
  src: string;
  width: number;
};

export type ProductFeedbackEntry = {
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  images: ProductFeedbackImage[];
  rating: number;
};

export type ProductFeedbackPanelProps = {
  productId: string;
  productSlug: string;
  reviewCount?: number;
  reviews?: ProductFeedbackEntry[];
};

type ProductFeedbackSummary = {
  reviewCount: number;
  reviews: ProductFeedbackEntry[];
};

export function ProductFeedbackPanel({
  productId,
  productSlug,
  reviewCount = 0,
  reviews = [],
}: ProductFeedbackPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onlyPhotoReviews, setOnlyPhotoReviews] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReviewFormStatus>(null);
  const [summary, setSummary] = useState<ProductFeedbackSummary>({
    reviewCount,
    reviews,
  });
  const visibleReviews = onlyPhotoReviews
    ? summary.reviews.filter((review) => review.images.length > 0)
    : summary.reviews;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      productId,
      productSlug,
    });

    fetch(`/api/product-feedback?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load product reviews.");
        }

        return (await response.json()) as ProductFeedbackSummary;
      })
      .then((nextSummary) => {
        setSummary(nextSummary);
        setLoadError(null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadError("후기를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingReviews(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [productId, productSlug]);

  const toggleForm = () => {
    setIsFormOpen((current) => !current);
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    setIsSubmitting(true);
    setStatus(null);

    const nextStatus = await submitReviewForm({
      endpoint: "/api/product-feedback",
      form,
      prepareFormData(formData) {
        formData.set("productId", productId);
        formData.set("productSlug", productSlug);
      },
    });

    setStatus(nextStatus);
    setIsSubmitting(false);
  };

  return (
    <section className="product-feedback-section" id="product-reviews">
      <div className="product-feedback-head">
        <div className="product-feedback-title">
          <h2>
            구매후기 <span>({summary.reviewCount})</span>
          </h2>
        </div>
        <SiteActionButton onClick={toggleForm} variant="quiet">
          구매후기 작성
        </SiteActionButton>
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
        포토 후기만 보기
      </label>
      <ProductFeedbackList
        emptyText={
          isLoadingReviews
            ? "후기를 불러오는 중입니다."
            : (loadError ?? "등록된 구매후기가 없습니다.")
        }
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
  status: ReviewFormStatus;
  submitting: boolean;
}) {
  return (
    <form className="product-feedback-form" onSubmit={onSubmit}>
      <ReviewFormField honeypot>
        웹사이트
        <input autoComplete="off" name="website" tabIndex={-1} type="text" />
      </ReviewFormField>
      <ReviewFormField>
        이름
        <input maxLength={40} name="authorName" required type="text" />
      </ReviewFormField>
      <ReviewFormField>
        연락처 또는 이메일
        <input maxLength={120} name="contact" type="text" />
      </ReviewFormField>
      <ReviewFormField>
        평점
        <select defaultValue="5" name="rating" required>
          <option value="5">5점</option>
          <option value="4">4점</option>
          <option value="3">3점</option>
          <option value="2">2점</option>
          <option value="1">1점</option>
        </select>
      </ReviewFormField>
      <ReviewFormField wide>
        내용
        <textarea maxLength={1200} minLength={5} name="body" required />
      </ReviewFormField>
      <ReviewFormField wide>
        사진
        <input
          accept="image/jpeg,image/png,image/webp"
          multiple
          name="photos"
          type="file"
        />
        <ReviewFormHelp>jpg, png, webp / 최대 5장 / 장당 20MB 이하</ReviewFormHelp>
      </ReviewFormField>
      <ReviewFormConsent>
        <input name="marketingConsent" type="checkbox" />
        <span>
          [선택] 작성한 구매후기와 사진을 콘세포트의 SNS, 홍보 콘텐츠에 사용할
          수 있음에 동의합니다. 동의하지 않아도 구매후기 작성은 가능합니다.
        </span>
      </ReviewFormConsent>
      <ReviewFormActions status={status}>
        <ReviewFormSubmitButton
          idleLabel="접수하기"
          pendingLabel="접수 중"
          submitting={submitting}
        />
      </ReviewFormActions>
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
    return <ReviewEmptyState>{emptyText}</ReviewEmptyState>;
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
                  <ArtworkImage
                    alt={image.alt}
                    height={image.height}
                    loading="lazy"
                    sizes={mediaImageSizes.reviewThumbnail}
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
