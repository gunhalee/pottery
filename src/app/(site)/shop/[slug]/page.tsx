import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BottomNav,
  PageShell,
  PlaceholderFrame,
} from "@/components/site/primitives";
import { ProductActionLink } from "@/components/shop/product-action-link";
import { ProductBadge } from "@/components/shop/product-badge";
import { ProductFixedCta } from "@/components/shop/product-fixed-cta";
import {
  formatProductPrice,
  getProductActionHref,
  getProductBadges,
  getProductBySlug,
  getProductCta,
  getProductSlugs,
} from "@/lib/shop";

type ShopDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ShopDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {};
  }

  return {
    description: product.shortDescription,
    title: product.titleKo,
  };
}

export default async function ShopDetailPage({
  params,
}: ShopDetailPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const primaryImage = product.images.find((image) => image.isPrimary);
  const cta = getProductCta(product);
  const action = getProductActionHref(product);

  return (
    <>
      <PageShell className="product-detail-shell">
        <div className="product-detail-layout">
          <div className="product-detail-media">
            <PlaceholderFrame
              className="product-detail-image"
              label={primaryImage?.placeholderLabel ?? product.titleKo}
              tone={product.kind === "one_of_a_kind" ? "dark" : "light"}
            />
          </div>

          <article className="product-detail-info">
            <div className="small-caps">Shop Detail</div>
            <div className="product-badge-row">
              {getProductBadges(product).map((badge) => (
                <ProductBadge key={badge} kind={badge} />
              ))}
            </div>
            <h1 className="product-detail-title">{product.titleKo}</h1>
            <p className="product-detail-lead">{product.shortDescription}</p>
            <div className="product-detail-price">
              {formatProductPrice(product)}
            </div>

            <div className="product-detail-action">
              <ProductActionLink product={product} />
              {cta.kind === "buy" && action.href ? (
                <p>안전한 결제를 위해 Cafe24 주문 화면으로 이동합니다.</p>
              ) : cta.kind === "buy" ? (
                <p>
                  Cafe24 상품 동기화가 끝나면 구매 버튼이 주문 화면으로
                  연결됩니다.
                </p>
              ) : (
                <p>카카오채널에서 입고와 비슷한 작품 소식을 안내합니다.</p>
              )}
            </div>
          </article>
        </div>

        <section className="product-detail-section">
          <h2 className="section-title">작품 이야기</h2>
          <p className="body-copy">{product.story ?? product.shortDescription}</p>
        </section>

        <section className="product-detail-section product-spec-grid">
          {[
            ["크기", product.size],
            ["소재", product.material],
            ["유약", product.glaze],
            ["사용", product.usageNote],
            ["관리", product.careNote],
            ["배송", product.shippingNote],
          ]
            .filter((item): item is [string, string] => Boolean(item[1]))
            .map(([label, value]) => (
              <div className="product-spec-item" key={label}>
                <span>{label}</span>
                <p>{value}</p>
              </div>
            ))}
        </section>
      </PageShell>

      <ProductFixedCta product={product} />

      <BottomNav
        links={[
          { href: "/shop", label: "작품 목록" },
          { href: "/gallery", label: "작업 과정" },
        ]}
      />
    </>
  );
}
