import type { Metadata } from "next";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { SiteActionLink, SiteEmptyState } from "@/components/site/actions";
import { PageIntro, PageShell } from "@/components/site/primitives";
import type {
  CheckoutMode,
  ProductOption,
  ShippingMethod,
} from "@/lib/orders/order-model";
import { calculateOrderAmounts } from "@/lib/orders/pricing";
import {
  getProductBySlug,
  getProductPurchaseLimitQuantity,
} from "@/lib/shop";

type CheckoutPageProps = {
  searchParams: Promise<{
    mode?: string;
    option?: string;
    order?: string;
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
          subtitle="주문 상품을 다시 선택해 주세요."
          title="주문하기"
          variant="compact"
        />
        <SiteEmptyState className="checkout-empty">
          <p>상품 정보를 찾지 못했습니다.</p>
          <SiteActionLink href="/shop">
            상점으로 이동
          </SiteActionLink>
        </SiteEmptyState>
      </PageShell>
    );
  }

  const checkoutMode = normalizeCheckoutMode(params.mode);
  const shippingMethod = normalizeShippingMethod(params.shipping);
  const productOption = normalizeProductOption(params.option);
  const containsLivePlant =
    productOption === "plant_included" && product.plantOption.enabled;
  const madeToOrderRequested = params.order === "made_to_order";
  const canMakeToOrder = Boolean(
    product.madeToOrder.available && product.commerce.price !== null,
  );
  const isMadeToOrder = madeToOrderRequested && canMakeToOrder;
  const maxQuantity = isMadeToOrder
    ? 99
    : Math.max(1, getProductPurchaseLimitQuantity(product));
  const quantity = Math.min(normalizeQuantity(params.quantity), maxQuantity);
  const unitPrice =
    product.commerce.price === null
      ? null
      : product.commerce.price +
        (containsLivePlant ? product.plantOption.priceDelta : 0);
  const amounts = calculateOrderAmounts({
    quantity,
    shippingMethod,
    unitPrice,
  });
  const isAvailablePurchase =
    product.commerce.availabilityStatus === "available";
  const isPurchasable =
    product.published &&
    !product.isArchived &&
    (isAvailablePurchase || isMadeToOrder) &&
    product.commerce.price !== null &&
    unitPrice !== null &&
    amounts.subtotalKrw !== null &&
    amounts.totalKrw !== null;

  return (
    <PageShell className="checkout-page-shell">
      <PageIntro
        title="주문하기"
        variant="compact"
      />

      {isPurchasable ? (
        <CheckoutForm
          checkoutMode={checkoutMode}
          containsLivePlant={containsLivePlant}
          isMadeToOrder={isMadeToOrder}
          madeToOrderDaysMax={
            isMadeToOrder ? product.madeToOrder.daysMax : null
          }
          madeToOrderDaysMin={
            isMadeToOrder ? product.madeToOrder.daysMin : null
          }
          madeToOrderNotice={
            isMadeToOrder ? product.madeToOrder.notice : undefined
          }
          productOption={containsLivePlant ? "plant_included" : "plant_excluded"}
          productSlug={product.slug}
          productTitle={product.titleKo}
          quantity={quantity}
          shippingFee={amounts.shippingFeeKrw}
          shippingMethod={shippingMethod}
          subtotal={amounts.subtotalKrw!}
          total={amounts.totalKrw!}
          unitPrice={unitPrice!}
        />
      ) : (
        <SiteEmptyState className="checkout-empty">
          <strong>{product.titleKo}</strong>
          <p>
            주문 과정에서 오류가 일어났습니다. 최대한 빨리 고치겠습니다.
          </p>
          <SiteActionLink href={`/shop/${product.slug}`}>
            상품 상세로 돌아가기
          </SiteActionLink>
        </SiteEmptyState>
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

function normalizeProductOption(option: string | undefined): ProductOption {
  return option === "plant_included" ? "plant_included" : "plant_excluded";
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
