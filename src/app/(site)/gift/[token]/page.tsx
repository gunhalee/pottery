import type { Metadata } from "next";
import { GiftRecipientAddressForm } from "@/components/shop/gift-recipient-address-form";
import { SiteActionLink } from "@/components/site/actions";
import { PageShell } from "@/components/site/primitives";
import { readGiftRecipientAddressState } from "@/lib/orders/gift-recipient";

type GiftRecipientAddressPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export const metadata: Metadata = {
  title: "선물 배송 정보 입력",
};

export default async function GiftRecipientAddressPage({
  params,
}: GiftRecipientAddressPageProps) {
  const { token } = await params;
  const state = await readGiftRecipientAddressState(token);

  return (
    <PageShell className="gift-address-page-shell">
      {state.kind === "pending" ? (
        <GiftRecipientAddressForm
          expiresAt={state.expiresAt}
          orderNumber={state.orderNumber}
          recipientName={state.recipientName}
          token={token}
        />
      ) : (
        <div className="gift-address-result">
          <span>선물 배송 정보</span>
          <strong>{state.kind === "submitted" ? state.orderNumber : "확인 필요"}</strong>
          <p>{state.message}</p>
          <SiteActionLink href="/">
            홈으로 이동
          </SiteActionLink>
        </div>
      )}
    </PageShell>
  );
}
