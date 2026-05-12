import type { ProductBadgeKind } from "@/lib/shop";

const badgeLabels = {
  archive: "아카이브",
  available: "판매중",
  gift_available: "선물 가능",
  limited: "한정",
  live_plant: "생화·식물 포함",
  made_to_order: "주문 제작",
  one_of_a_kind: "하나뿐인 작업물",
  pickup_available: "방문수령 가능",
  sold_out: "판매완료",
  upcoming: "입고 예정",
} satisfies Record<ProductBadgeKind, string>;

export function ProductBadge({ kind }: { kind: ProductBadgeKind }) {
  return (
    <span className={`product-badge product-badge-${kind}`}>
      {badgeLabels[kind]}
    </span>
  );
}
