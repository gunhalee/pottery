import {
  FloatingActionAnchor,
  FloatingArrowUpIcon,
} from "@/components/navigation/floating-action-primitives";

export function ScrollToTopButton() {
  return (
    <div className="floating-quick-actions" aria-label="빠른 이동">
      <FloatingActionAnchor
        aria-label="맨 위로 이동"
        className="scroll-top-button"
        href="#site-top"
      >
        <FloatingArrowUpIcon />
      </FloatingActionAnchor>
    </div>
  );
}
