import { ClassReviewFormPanel } from "./class-review-form-panel";
import { ClassReviewList } from "./class-review-list";
import type {
  ClassReviewEntry,
  ClassReviewSession,
} from "./class-review-types";

type ClassReviewPanelProps = {
  classSessions: ClassReviewSession[];
  reviews: ClassReviewEntry[];
};

export function ClassReviewPanel({
  classSessions,
  reviews,
}: ClassReviewPanelProps) {
  return (
    <section className="class-review-section" id="class-reviews">
      <ClassReviewFormPanel classSessions={classSessions} />
      <ClassReviewList reviews={reviews} />
    </section>
  );
}
