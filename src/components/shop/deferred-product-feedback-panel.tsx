"use client";

import dynamic from "next/dynamic";
import { useDeferredActivation } from "@/lib/browser/use-deferred-activation";
import type { ProductFeedbackPanelProps } from "./product-feedback-panel";

const ProductFeedbackPanel = dynamic(
  () =>
    import("./product-feedback-panel").then((mod) => mod.ProductFeedbackPanel),
  { ssr: false },
);

export function DeferredProductFeedbackPanel(
  props: ProductFeedbackPanelProps,
) {
  const { active: enabled, ref: rootRef } =
    useDeferredActivation<HTMLDivElement>({
      idleTimeout: 1800,
      rootMargin: "720px 0px",
    });

  if (enabled) {
    return <ProductFeedbackPanel {...props} />;
  }

  return (
    <div
      aria-hidden="true"
      className="product-feedback-section product-feedback-placeholder deferred-section"
      ref={rootRef}
    />
  );
}
