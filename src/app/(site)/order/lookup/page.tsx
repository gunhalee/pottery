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
        subtitle="주문조회를 위해 정보를 입력해 주세요."
        title="주문 조회"
        variant="compact"
      />
      <OrderLookupForm />
    </PageShell>
  );
}
