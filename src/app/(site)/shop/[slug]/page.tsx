import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShopBackButton } from "@/components/navigation/shop-back-button";
import { PageShell } from "@/components/site/primitives";
import { RichTextRenderer } from "@/components/content/rich-text-renderer";
import { ProductBadge } from "@/components/shop/product-badge";
import { ProductCard } from "@/components/shop/product-card";
import { ProductFeedbackPanel } from "@/components/shop/product-feedback-panel";
import {
  ProductImageGallery,
  type ProductGalleryImage,
} from "@/components/shop/product-image-gallery";
import { ProductPurchasePanel } from "@/components/shop/product-purchase-panel";
import { ProductSpecList } from "@/components/shop/product-spec-list";
import { ProductTitleActions } from "@/components/shop/product-title-actions";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import {
  formatProductPrice,
  getProductBadges,
  getProductBySlug,
  getProductCta,
  getProductDisplayImages,
  getProductPrimaryImage,
  getProductThumbnailImage,
  getProductSlugs,
  getPublishedProductListItems,
} from "@/lib/shop";
import { getProductFeedbackSummary } from "@/lib/shop/product-feedback";

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

  const primaryImage = getProductPrimaryImage(product);
  const displayImages = getProductDisplayImages(product);
  const cta = getProductCta(product);
  const isMadeToOrderPurchase = cta.kind === "made_to_order";
  const feedbackSummary = await getProductFeedbackSummary(product.id);
  const galleryImages = getGalleryImages({
    displayImages,
    primaryImage,
    title: product.titleKo,
  });
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
              isMadeToOrderPurchase ? null : product.commerce.stockQuantity
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
          { label: "안내", value: product.usageNote },
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

      <ProductFeedbackPanel
        productId={product.id}
        productSlug={product.slug}
        reviewCount={feedbackSummary.reviewCount}
        reviews={feedbackSummary.reviews}
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

function getGalleryImages({
  displayImages,
  primaryImage,
  title,
}: {
  displayImages: ReturnType<typeof getProductDisplayImages>;
  primaryImage: ReturnType<typeof getProductPrimaryImage>;
  title: string;
}): ProductGalleryImage[] {
  const images = displayImages.length > 0 ? displayImages : primaryImage ? [primaryImage] : [];
  const seen = new Set<string>();
  const galleryImages: ProductGalleryImage[] = [];

  for (const image of images) {
    if (!image.src || seen.has(image.src)) {
      continue;
    }

    seen.add(image.src);
    const thumbnail = getProductThumbnailImage(image);

    galleryImages.push({
      alt: image.alt,
      height: image.height,
      id: image.id ?? image.src,
      src: image.src,
      thumbnailHeight: thumbnail.height,
      thumbnailSrc: thumbnail.src,
      thumbnailWidth: thumbnail.width,
      width: image.width,
    });
  }

  if (galleryImages.length === 0) {
    return [
      {
        alt: `${title} 이미지 준비 중`,
        height: 1783,
        id: "fallback-product-image",
        src: "/asset/hero-image.jpg",
        width: 3156,
      },
    ];
  }

  return galleryImages;
}
