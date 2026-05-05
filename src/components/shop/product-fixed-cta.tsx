import {
  formatProductPrice,
  getProductActionHref,
  getProductCta,
  type ConsepotProduct,
} from "@/lib/shop";
import { ProductActionLink } from "./product-action-link";

export function ProductFixedCta({ product }: { product: ConsepotProduct }) {
  const cta = getProductCta(product);
  const action = getProductActionHref(product);

  return (
    <aside className="product-fixed-cta" aria-label="작품 구매 또는 알림">
      <div className="product-fixed-cta-copy">
        <span>{product.titleKo}</span>
        <strong>{formatProductPrice(product)}</strong>
      </div>
      <ProductActionLink
        className="button-primary product-fixed-cta-button"
        product={product}
      />
      {cta.kind === "buy" && action.href ? (
        <p>안전한 결제를 위해 Cafe24 주문 화면으로 이동합니다.</p>
      ) : cta.kind === "buy" ? (
        <p>Cafe24 상품 동기화 후 구매 버튼이 주문 화면으로 연결됩니다.</p>
      ) : (
        <p>카카오채널에서 입고와 비슷한 작품 소식을 안내합니다.</p>
      )}
    </aside>
  );
}
