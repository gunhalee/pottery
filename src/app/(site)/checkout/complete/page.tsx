import type { Metadata } from "next";
import { CheckoutCompleteClient } from "@/components/shop/checkout-complete-client";
import { PageIntro, PageShell } from "@/components/site/primitives";

type CheckoutCompletePageProps = {
  searchParams: Promise<{
    code?: string;
    message?: string;
    orderId?: string;
    paymentId?: string;
  }>;
};

export const metadata: Metadata = {
  description: "PortOne 결제 결과를 확인합니다.",
  title: "결제 확인",
};

export default async function CheckoutCompletePage({
  searchParams,
}: CheckoutCompletePageProps) {
  const params = await searchParams;

  return (
    <PageShell className="checkout-page-shell">
      <PageIntro
        subtitle="PortOne 결제 결과를 서버에서 다시 검증합니다."
        title="결제 확인"
        variant="compact"
      />
      <CheckoutCompleteClient
        errorCode={params.code}
        errorMessage={params.message}
        orderId={params.orderId}
        paymentId={params.paymentId}
      />
    </PageShell>
  );
}
