import { ArtworkImage } from "@/components/media/artwork-image";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import type {
  ClassReviewEntry,
  StaticClassReview,
} from "./class-review-types";

export function ClassReviewList({
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
