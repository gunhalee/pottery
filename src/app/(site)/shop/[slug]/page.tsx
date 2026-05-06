import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BottomNav,
  PageShell,
  PlaceholderFrame,
} from "@/components/site/primitives";
import { RichTextRenderer } from "@/components/content/rich-text-renderer";
import { ProductActionLink } from "@/components/shop/product-action-link";
import { ProductBadge } from "@/components/shop/product-badge";
import { ProductSpecList } from "@/components/shop/product-spec-list";
import { getPublishedContentEntries } from "@/lib/content-manager/content-store";
import {
  formatProductPrice,
  getProductBadges,
  getProductBySlug,
  getProductCta,
  getProductDisplayImages,
  getProductPrimaryImage,
  getProductPurchaseKind,
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
  const [product, galleryEntries] = await Promise.all([
    getProductBySlug(slug),
    getPublishedContentEntries("gallery"),
  ]);

  if (!product) {
    notFound();
  }

  const primaryImage = getProductPrimaryImage(product);
  const displayImages = getProductDisplayImages(product);
  const cta = getProductCta(product);
  const purchaseKind = getProductPurchaseKind(product);
  const relatedGalleryEntries = galleryEntries
    .filter((entry) => entry.relatedProductSlug === product.slug)
    .slice(0, 3);

  return (
    <>
      <PageShell className="product-detail-shell">
        <div className="product-detail-layout">
          <div className="product-detail-media">
            {primaryImage?.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={primaryImage.alt}
                className="product-detail-image product-detail-photo"
                src={primaryImage.src}
              />
            ) : (
              <PlaceholderFrame
                className="product-detail-image"
                label={primaryImage?.placeholderLabel ?? product.titleKo}
                tone={product.kind === "one_of_a_kind" ? "dark" : "light"}
              />
            )}
            {displayImages.length > 1 ? (
              <div className="product-detail-gallery">
                {displayImages.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={image.alt}
                    key={image.id ?? image.src ?? image.alt}
                    src={image.src}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <article className="product-detail-info">
            <div className="small-caps">상품 상세</div>
            <div className="product-badge-row">
              {getProductBadges(product).map((badge) => (
                <ProductBadge key={badge} kind={badge} />
              ))}
            </div>
            <h1 className="product-detail-title">{product.titleKo}</h1>
            <p className="product-detail-lead">{product.shortDescription}</p>
          </article>
        </div>

        <section className="product-detail-section">
          <h2 className="section-title">작품 이야기</h2>
          <p className="product-detail-lead product-detail-story-lead">
            {product.shortDescription}
          </p>
          {product.storyBody ? (
            <RichTextRenderer body={product.storyBody} />
          ) : (
            <p className="body-copy">{product.story ?? product.shortDescription}</p>
          )}
        </section>

        {relatedGalleryEntries.length > 0 ? (
          <section className="product-linked-content">
            <div>
              <p className="small-caps">작품 기록</p>
              <h2>이 상품과 연결된 작품 이야기</h2>
            </div>
            <div className="product-linked-content-list">
              {relatedGalleryEntries.map((entry) => (
                <Link
                  className="product-linked-content-card"
                  href={`/gallery/${entry.slug}`}
                  key={entry.id}
                  prefetch={false}
                >
                  <span>{entry.displayDate ?? entry.publishedAt ?? "작품"}</span>
                  <strong>{entry.title}</strong>
                  {entry.summary ? <p>{entry.summary}</p> : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="product-purchase-strip" aria-label="구매 안내">
          <div>
            <span>{product.titleKo}</span>
            <strong>{formatProductPrice(product)}</strong>
          </div>
          <div className="product-detail-action">
            <ProductActionLink className="button-quiet" product={product} />
            {cta.kind === "buy" && purchaseKind === "cafe24_checkout" ? (
              <p>Cafe24 바로구매 주문서로 이동합니다.</p>
            ) : cta.kind === "buy" && purchaseKind === "cafe24_product" ? (
              <p>Cafe24 상품 화면에서 주문을 이어갑니다.</p>
            ) : cta.kind === "buy" && purchaseKind === "cafe24_cart" ? (
              <p>Cafe24 장바구니에 담은 뒤 주문 화면으로 이동합니다.</p>
            ) : cta.kind === "buy" ? (
              <p>Cafe24 상품 동기화 후 구매가 활성화됩니다.</p>
            ) : (
              <p>카카오채널에서 입고와 비슷한 작품 소식을 안내합니다.</p>
            )}
          </div>
        </section>

        <ProductSpecList
          items={[
            { label: "크기", value: product.size },
            { label: "소재", value: product.material },
            { label: "유약", value: product.glaze },
            { label: "사용", value: product.usageNote },
            { label: "관리", value: product.careNote },
            { label: "배송", value: product.shippingNote },
          ]}
        />
      </PageShell>

      <BottomNav
        links={[
          { href: "/shop", label: "상품 목록" },
          { href: "/gallery", label: "작품 기록" },
          { href: "/news", label: "소식" },
        ]}
      />
    </>
  );
}
