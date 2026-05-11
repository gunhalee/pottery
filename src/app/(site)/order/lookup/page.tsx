import type { Metadata } from "next";
import { PageIntro, PageShell } from "@/components/site/primitives";
import { OrderLookupForm } from "@/components/shop/order-lookup-form";

export const metadata: Metadata = {
  description: "자체 주문번호와 조회 비밀번호로 주문 및 배송 상태를 확인합니다.",
  title: "주문 조회",
};

export default function OrderLookupPage() {
  return (
    <PageShell>
      <PageIntro
        subtitle="주문번호, 연락처 끝 4자리, 주문 비밀번호가 일치할 때만 조회됩니다."
        title="주문 조회"
      />
      <OrderLookupForm />
    </PageShell>
  );
}
