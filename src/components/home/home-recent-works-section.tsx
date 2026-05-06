import { ArrowLink, Section, WorkGrid } from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import type { WorkItem } from "@/lib/content/site-content";
import type { ProductListItem } from "@/lib/shop";

export function HomeRecentWorksSection({
  fallbackItems,
  products,
}: {
  fallbackItems: WorkItem[];
  products: ProductListItem[];
}) {
  const recentProducts = products.slice(0, 3);

  return (
    <Section>
      <div className="works-head">
        <h2 className="section-title">최근 작품</h2>
        <ArrowLink href="/shop">전체 보기</ArrowLink>
      </div>
      {recentProducts.length > 0 ? (
        <ProductGrid products={recentProducts} />
      ) : (
        <WorkGrid items={fallbackItems} />
      )}
    </Section>
  );
}
