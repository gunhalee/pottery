import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cafe24CartBridge } from "@/components/shop/cafe24-cart-bridge";
import {
  getCafe24CheckoutHref,
  getCafe24ProductHref,
  getProductBySlug,
} from "@/lib/shop";

type Cafe24CheckoutPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Cafe24 주문 연결",
};

export default async function Cafe24CheckoutPage({
  params,
}: Cafe24CheckoutPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const config = getCafe24FrontConfig();
  const fallbackHref = getCafe24ProductHref(product);

  if (
    product.commerce.availabilityStatus !== "available" ||
    !product.cafe24.productNo ||
    !product.cafe24.variantCode
  ) {
    return (
      <main className="checkout-bridge-page">
        <section className="checkout-bridge-panel">
          <p className="small-caps">Cafe24 Checkout</p>
          <h1>구매 연결 준비 중</h1>
          <p>
            Cafe24 상품번호와 품목코드가 준비된 상품만 장바구니에 담을 수
            있습니다.
          </p>
          <Link className="link-arrow" href={`/shop/${product.slug}`}>
            작품 상세로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  if (!config.mallId || !config.clientId) {
    return (
      <main className="checkout-bridge-page">
        <section className="checkout-bridge-panel">
          <p className="small-caps">Cafe24 Checkout</p>
          <h1>Cafe24 Front API 설정 필요</h1>
          <p>
            장바구니 연결에는 Cafe24 mall ID와 client ID 설정이 필요합니다.
          </p>
          <Link className="link-arrow" href={`/shop/${product.slug}`}>
            작품 상세로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-bridge-page">
      <Cafe24CartBridge
        apiBaseUrl={`https://${config.mallId}.cafe24api.com/api/v2`}
        apiVersion={config.apiVersion}
        basketType="A0000"
        checkoutHref={getCafe24CheckoutHref(product)}
        clientId={config.clientId}
        duplicatedItemCheck="F"
        fallbackHref={fallbackHref}
        prepaidShippingFee="P"
        productNo={product.cafe24.productNo}
        productTitle={product.titleKo}
        quantity={1}
        shopNo={config.shopNo}
        variantCode={product.cafe24.variantCode}
      />
    </main>
  );
}

function getCafe24FrontConfig() {
  return {
    apiVersion:
      process.env.NEXT_PUBLIC_CAFE24_API_VERSION ||
      process.env.CAFE24_API_VERSION ||
      "2025-09-01",
    clientId:
      process.env.NEXT_PUBLIC_CAFE24_CLIENT_ID ||
      process.env.CAFE24_CLIENT_ID ||
      "",
    mallId:
      process.env.NEXT_PUBLIC_CAFE24_MALL_ID ||
      process.env.CAFE24_MALL_ID ||
      "",
    shopNo: Number(
      process.env.NEXT_PUBLIC_CAFE24_SHOP_NO ||
        process.env.CAFE24_SHOP_NO ||
        "1",
    ),
  };
}
