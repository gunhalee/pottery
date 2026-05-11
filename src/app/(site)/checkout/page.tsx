import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { PageIntro, PageShell } from "@/components/site/primitives";
import type {
  CheckoutMode,
  ShippingMethod,
} from "@/lib/orders/order-model";
import { calculateOrderAmounts } from "@/lib/orders/pricing";
import { formatProductPrice, getProductBySlug } from "@/lib/shop";

type CheckoutPageProps = {
  searchParams: Promise<{
    mode?: string;
    product?: string;
    quantity?: string;
    shipping?: string;
  }>;
};

export const metadata: Metadata = {
  description: "주문 정보를 확인하고 자체 주문 기록을 생성합니다.",
  title: "주문하기",
};

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
  const productSlug = params.product?.trim() ?? "";
  const product = productSlug ? await getProductBySlug(productSlug) : null;

  if (!product) {
    return (
      <PageShell className="checkout-page-shell">
        <PageIntro
          subtitle="주문할 작업물을 다시 선택해 주세요."
          title="주문하기"
        />
        <div className="checkout-empty">
          <p>상품 정보를 찾지 못했습니다.</p>
          <Link className="button-primary" href="/shop" prefetch={false}>
            소장하기로 이동
          </Link>
        </div>
      </PageShell>
    );
  }

  const checkoutMode = normalizeCheckoutMode(params.mode);
  const shippingMethod = normalizeShippingMethod(params.shipping);
  const maxQuantity = Math.max(1, product.commerce.stockQuantity ?? 99);
  const quantity = Math.min(normalizeQuantity(params.quantity), maxQuantity);
  const amounts = calculateOrderAmounts({
    quantity,
    shippingMethod,
    unitPrice: product.commerce.price,
  });
  const isPurchasable =
    product.published &&
    !product.isArchived &&
    product.commerce.availabilityStatus === "available" &&
    product.commerce.price !== null &&
    amounts.subtotalKrw !== null &&
    amounts.totalKrw !== null;

  return (
    <PageShell className="checkout-page-shell">
      <PageIntro
        subtitle="주문자 정보와 조회 비밀번호를 입력해 자체 주문 기록을 생성합니다."
        title="주문하기"
      />

      {isPurchasable ? (
        <CheckoutForm
          checkoutMode={checkoutMode}
          productSlug={product.slug}
          productTitle={product.titleKo}
          quantity={quantity}
          shippingFee={amounts.shippingFeeKrw}
          shippingMethod={shippingMethod}
          subtotal={amounts.subtotalKrw!}
          total={amounts.totalKrw!}
          unitPrice={product.commerce.price!}
        />
      ) : (
        <div className="checkout-empty">
          <strong>{product.titleKo}</strong>
          <p>
            현재 주문 가능한 상태가 아닙니다. 표시 가격은{" "}
            {formatProductPrice(product)}입니다.
          </p>
          <Link
            className="button-primary"
            href={`/shop/${product.slug}`}
            prefetch={false}
          >
            상품 상세로 돌아가기
          </Link>
        </div>
      )}
    </PageShell>
  );
}

function normalizeCheckoutMode(mode: string | undefined): CheckoutMode {
  if (mode === "gift" || mode === "naver_pay") {
    return mode;
  }

  return "standard";
}

function normalizeShippingMethod(
  shippingMethod: string | undefined,
): ShippingMethod {
  return shippingMethod === "pickup" ? "pickup" : "parcel";
}

function normalizeQuantity(quantity: string | undefined) {
  const parsed = Number(quantity);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}
