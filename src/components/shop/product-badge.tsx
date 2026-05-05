import type { ProductBadgeKind } from "@/lib/shop";

const badgeLabels = {
  archive: "아카이브",
  available: "판매중",
  limited: "한정",
  one_of_a_kind: "하나뿐인 작품",
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
