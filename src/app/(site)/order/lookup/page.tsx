import type { Metadata } from "next";
import {
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { CartReturnNotice } from "@/components/shop/recent-products";
import { OrderLookupForm } from "@/components/shop/order-lookup-form";

export const metadata: Metadata = {
  description: "Cafe24 주문번호와 연락처로 주문 및 배송 상태를 확인합니다.",
  title: "주문 조회",
};

export default function OrderLookupPage() {
  return (
    <>
      <PageShell>
        <PageIntro
          subtitle="주문번호와 연락처가 일치할 때만 조회됩니다."
          title="주문 조회"
        />
        <CartReturnNotice />
        <OrderLookupForm />
      </PageShell>
    </>
  );
}
