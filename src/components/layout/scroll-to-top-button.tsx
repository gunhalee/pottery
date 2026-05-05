"use client";

export function ScrollToTopButton() {
  const handleClick = () => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      className="scroll-top-button"
      aria-label="맨 위로 이동"
      onClick={handleClick}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
