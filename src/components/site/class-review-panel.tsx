import { ClassReviewFormPanel } from "./class-review-form-panel";
import { ClassReviewList } from "./class-review-list";
import type {
  ClassReviewEntry,
  ClassReviewSession,
  StaticClassReview,
} from "./class-review-types";

type ClassReviewPanelProps = {
  classSessions: ClassReviewSession[];
  reviews: ClassReviewEntry[];
  staticReviews: readonly StaticClassReview[];
};

export function ClassReviewPanel({
  classSessions,
  reviews,
  staticReviews,
}: ClassReviewPanelProps) {
  return (
    <section className="class-review-section" id="class-reviews">
      <ClassReviewFormPanel classSessions={classSessions} />
      <ClassReviewList reviews={reviews} staticReviews={staticReviews} />
    </section>
  );
}
