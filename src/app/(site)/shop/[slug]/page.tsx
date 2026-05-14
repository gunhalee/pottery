import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShopBackButton } from "@/components/navigation/shop-back-button";
import { PageShell } from "@/components/site/primitives";
import { RichTextRenderer } from "@/components/content/rich-text-renderer";
import { ProductBadge } from "@/components/shop/product-badge";
import { ProductCard } from "@/components/shop/product-card";
import { DeferredProductFeedbackPanel } from "@/components/shop/deferred-product-feedback-panel";
import { ProductImageGallery } from "@/components/shop/product-image-gallery";
import { ProductPurchasePanel } from "@/components/shop/product-purchase-panel";
import { ProductSpecList } from "@/components/shop/product-spec-list";
import { ProductTitleActions } from "@/components/shop/product-title-actions";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import {
  artworkPlaceholderImage,
  getArtworkPlaceholderAlt,
} from "@/lib/media/media-placeholders";
import {
  formatProductPrice,
  getProductBadges,
  getProductBySlug,
  getProductCta,
  getProductGalleryImages,
  getProductPurchaseLimitQuantity,
  getProductSlugs,
  getPublishedProductListItems,
  type ProductGalleryImage,
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
  const [product, relatedGalleryEntries, productListItems] = await Promise.all([
    getProductBySlug(slug),
    getPublishedContentListEntries("gallery", {
      limit: 3,
      relatedProductSlug: slug,
    }),
    getPublishedProductListItems(),
  ]);

  if (!product) {
    notFound();
  }

  const cta = getProductCta(product);
  const isMadeToOrderPurchase = cta.kind === "made_to_order";
  const productGalleryImages = getProductGalleryImages(product);
  const galleryImages =
    productGalleryImages.length > 0
      ? productGalleryImages
      : getPlaceholderGalleryImages(product.titleKo);
  const relatedProducts = productListItems
    .filter((item) => item.slug !== product.slug)
    .slice(0, 3);

  return (
    <PageShell className="product-detail-shell">
      <nav className="product-detail-backbar" aria-label="상품 상세 탐색">
        <ShopBackButton fallbackHref="/shop" />
      </nav>

      <div className="product-detail-layout">
        <div className="product-detail-media">
          <ProductImageGallery
            images={galleryImages}
            productTitle={product.titleKo}
          />
        </div>

        <article className="product-detail-info">
          <div className="product-detail-heading">
            <div className="product-detail-heading-copy">
              <h1 className="product-detail-title">{product.titleKo}</h1>
              <p className="product-detail-lead">{product.shortDescription}</p>
            </div>
            <ProductTitleActions
              productSlug={product.slug}
              productTitle={product.titleKo}
            />
          </div>
          <div className="product-detail-price-row">
            <div className="product-badge-row">
              {getProductBadges(product).map((badge) => (
                <ProductBadge key={badge} kind={badge} />
              ))}
            </div>
            <p className="product-detail-price">{formatProductPrice(product)}</p>
          </div>
          <ProductPurchasePanel
            availabilityLabel={cta.label}
            currency={product.commerce.currency}
            isPurchasable={cta.kind === "buy" || isMadeToOrderPurchase}
            madeToOrder={{
              ...product.madeToOrder,
              enabled: isMadeToOrderPurchase,
            }}
            maxQuantity={
              isMadeToOrderPurchase
                ? null
                : getProductPurchaseLimitQuantity(product)
            }
            plantOption={product.plantOption}
            price={product.commerce.price}
            productSlug={product.slug}
          />
        </article>
      </div>

      <section
        className="product-detail-section product-detail-story-section"
        id="product-detail-description"
      >
        <div className="product-section-header product-detail-story-head">
          <h2>상세정보</h2>
        </div>
        <div className="product-detail-story-body">
          {product.storyBody ? (
            <RichTextRenderer body={product.storyBody} />
          ) : (
            <p className="body-copy">
              {product.story ?? product.shortDescription}
            </p>
          )}
        </div>
      </section>

      {relatedGalleryEntries.length > 0 ? (
        <section className="product-linked-content">
          <div>
            <p className="small-caps">작업물 기록</p>
            <h2>이 상품과 연결된 작업물 이야기</h2>
          </div>
          <div className="product-linked-content-list">
            {relatedGalleryEntries.map((entry) => (
              <Link
                className="product-linked-content-card"
                href={`/gallery/${entry.slug}`}
                key={entry.id}
                prefetch={false}
              >
                <span>{entry.displayDate ?? entry.publishedAt ?? "작업물"}</span>
                <strong>{entry.title}</strong>
                {entry.summary ? <p>{entry.summary}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <ProductSpecList
        items={[
          { label: "크기", value: product.size },
          { label: "소재", value: product.material },
          { label: "유약", value: product.glaze },
          { label: "안내", value: buildProductNotice(product.usageNote) },
          { label: "배송", value: product.shippingNote },
          {
            label: "식물 옵션",
            value: product.plantOption.enabled
              ? [
                  product.plantOption.species,
                  product.plantOption.careNotice,
                  product.plantOption.shippingRestrictionNotice,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined,
          },
          {
            label: "추가 제작",
            value: product.madeToOrder.available
              ? `결제 또는 입금 확인일 기준 약 ${product.madeToOrder.daysMin}~${product.madeToOrder.daysMax}일`
              : undefined,
          },
        ]}
      />

      <DeferredProductFeedbackPanel
        productId={product.id}
        productSlug={product.slug}
      />

      {relatedProducts.length > 0 ? (
        <section className="product-related-section" aria-label="연관 상품">
          <h2>+ 연관 상품</h2>
          <div className="product-related-grid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

const handmadeCeramicDefaultNotice =
  "수작업 도자기 특성상 유약 흐름, 철점, 작은 기포, 색감 차이, 형태 차이, 굽 자국, 표면 질감 차이가 있을 수 있습니다.";

function buildProductNotice(usageNote: string | undefined) {
  return [usageNote, handmadeCeramicDefaultNotice].filter(Boolean).join("\n");
}

function getPlaceholderGalleryImages(title: string): ProductGalleryImage[] {
  return [
    {
      alt: getArtworkPlaceholderAlt(title),
      height: artworkPlaceholderImage.height,
      id: artworkPlaceholderImage.id,
      src: artworkPlaceholderImage.src,
      width: artworkPlaceholderImage.width,
    },
  ];
}
