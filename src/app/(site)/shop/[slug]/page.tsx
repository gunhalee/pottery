import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BottomNav,
  PageShell,
} from "@/components/site/primitives";
import { RichTextRenderer } from "@/components/content/rich-text-renderer";
import { ProductBadge } from "@/components/shop/product-badge";
import { ProductCard } from "@/components/shop/product-card";
import {
  ProductImageGallery,
  type ProductGalleryImage,
} from "@/components/shop/product-image-gallery";
import { ProductPurchasePanel } from "@/components/shop/product-purchase-panel";
import { ProductVisitTracker } from "@/components/shop/recent-products";
import { ProductSpecList } from "@/components/shop/product-spec-list";
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
import { toProductListSummary } from "@/lib/shop/product-list-view";

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
  const currentProductSummary = toProductListSummary(product);
  const galleryImages = getGalleryImages({
    displayImages,
    primaryImage,
    title: product.titleKo,
  });
  const relatedProducts = productListItems
    .filter((item) => item.slug !== product.slug)
    .slice(0, 3);

  return (
    <>
      <ProductVisitTracker product={currentProductSummary} />
      <PageShell className="product-detail-shell">
        <div className="product-detail-layout">
          <div className="product-detail-media">
            <ProductImageGallery
              images={galleryImages}
              productTitle={product.titleKo}
            />
          </div>

          <article className="product-detail-info">
            <div className="product-detail-heading">
              <h1 className="product-detail-title">{product.titleKo}</h1>
            </div>
            <div className="product-badge-row">
              {getProductBadges(product).map((badge) => (
                <ProductBadge key={badge} kind={badge} />
              ))}
            </div>
            <p className="product-detail-price">{formatProductPrice(product)}</p>
            <p className="product-detail-lead">{product.shortDescription}</p>
            <ProductPurchasePanel
              availabilityLabel={cta.label}
              currency={product.commerce.currency}
              isPurchasable={cta.kind === "buy"}
              maxQuantity={product.commerce.stockQuantity}
              price={product.commerce.price}
              productTitle={product.titleKo}
            />
          </article>
        </div>

        <nav className="product-detail-tabs" aria-label="상품 정보">
          <a href="#product-detail-description">상세정보</a>
          <span aria-hidden="true">/</span>
          <a href="#product-reviews">구매평 <em>(0)</em></a>
          <span aria-hidden="true">/</span>
          <a href="#product-qna">Q&amp;A <em>(0)</em></a>
        </nav>

        <section
          className="product-detail-section product-detail-story-section"
          id="product-detail-description"
        >
          <details className="product-detail-disclosure">
            <summary>상세정보 펼쳐보기</summary>
            <div className="product-detail-disclosure-body">
              <h2 className="section-title">작품 이야기</h2>
              <p className="product-detail-lead product-detail-story-lead">
                {product.shortDescription}
              </p>
              {product.storyBody ? (
                <RichTextRenderer body={product.storyBody} />
              ) : (
                <p className="body-copy">
                  {product.story ?? product.shortDescription}
                </p>
              )}
            </div>
          </details>
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

        <ProductSpecList
          items={[
            { label: "크기", value: product.size },
            { label: "소재", value: product.material },
            { label: "유약", value: product.glaze },
            { label: "주문안내", value: product.usageNote },
            { label: "배송", value: product.shippingNote },
          ]}
        />

        <section className="product-feedback-section" id="product-reviews">
          <div className="product-feedback-head">
            <h2>구매평<span>(0)</span></h2>
            <button type="button">구매평 작성</button>
          </div>
          <label className="product-photo-review-filter">
            <input type="checkbox" disabled />
            포토 구매평만 보기
          </label>
          <p className="product-empty-state">등록된 구매평이 없습니다.</p>
        </section>

        <section className="product-feedback-section" id="product-qna">
          <div className="product-feedback-head">
            <h2>Q&amp;A<span>(0)</span></h2>
          </div>
          <p className="product-qna-copy">
            구매하시려는 상품에 대해 궁금한 점이 있으면 문의주세요.
          </p>
          <p className="product-empty-state">등록된 문의가 없습니다.</p>
        </section>

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
