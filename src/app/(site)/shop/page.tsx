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
          subtitle="소장 가능한 작품을 모았습니다."
          title="작품 소장"
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
