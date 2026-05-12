"use client";

import { useRouter } from "next/navigation";

type ShopBackButtonProps = {
  fallbackHref?: string;
  label?: string;
};

export function ShopBackButton({
  fallbackHref = "/shop",
  label = "뒤로 가기",
}: ShopBackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button className="product-detail-backlink" onClick={goBack} type="button">
      <ArrowLeftIcon />
      {label}
    </button>
  );
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
