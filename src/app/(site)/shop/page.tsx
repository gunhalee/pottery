import {
  BottomNav,
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import { getPublishedProducts } from "@/lib/shop";

export default async function ShopPage() {
  const products = await getPublishedProducts();

  return (
    <>
      <PageShell>
        <PageIntro
          subtitle="공방에서 빚은 상시 작품과 하나뿐인 작품, 예전 아카이브까지 함께 모았습니다."
          title="Shop"
          titleEmphasis="Archive"
        />

        <ProductGrid products={products} />
      </PageShell>
      <BottomNav
        links={[
          { href: "/gallery", label: "작업 과정 보기" },
          { href: "/news", label: "공방 소식" },
        ]}
      />
    </>
  );
}
