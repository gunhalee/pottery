"use client";

import { useRouter } from "next/navigation";
import { ShopArrowLeftIcon } from "@/components/shop/shop-icons";

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
      <ShopArrowLeftIcon />
      {label}
    </button>
  );
}
