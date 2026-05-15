import { ArtworkImage } from "@/components/media/artwork-image";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteArrowLink } from "@/components/site/actions";
import { MetaLabel, PageShell } from "@/components/site/primitives";
import { RichTextRenderer } from "@/components/content/rich-text-renderer";
import {
  getContentCoverImage,
  getContentDetailImages,
} from "@/lib/content-manager/content-images";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import type { ContentEntry } from "@/lib/content-manager/content-model";
import {
  createBreadcrumbJsonLd,
  createContentJsonLd,
} from "@/lib/seo/json-ld";

type ContentDetailPageProps = {
  entry: ContentEntry;
  preview?: boolean;
  relatedProduct?: {
    shortDescription: string;
    slug: string;
    titleKo: string;
  } | null;
};

export function ContentDetailPage({
  entry,
  preview = false,
  relatedProduct,
}: ContentDetailPageProps) {
  const coverImage = getContentCoverImage(entry);
  const detailImages = getContentDetailImages(entry);
  const reservedImageIds = entry.images
    .filter((image) => image.isReserved)
    .map((image) => image.id);
  const kindLabel = entry.kind === "news" ? "소식" : "작업물";
  const contentJsonLd = [
    createContentJsonLd(entry),
    createBreadcrumbJsonLd([
      { name: "홈", path: "/" },
      { name: kindLabel, path: `/${entry.kind}` },
      { name: entry.title, path: `/${entry.kind}/${entry.slug}` },
    ]),
  ];

  return (
    <>
      {preview ? null : (
        <JsonLd data={contentJsonLd} id={`${entry.kind}-${entry.id}-json-ld`} />
      )}
      <PageShell className="content-detail-shell">
        {preview ? (
          <div className="admin-preview-banner">관리자 미리보기</div>
        ) : null}
        <MetaLabel>{kindLabel}</MetaLabel>
        <article className="content-detail">
          {coverImage ? (
            <figure className="content-detail-cover">
              <ArtworkImage
                alt={coverImage.alt}
                height={coverImage.height}
                loading="eager"
                preload
                quality={70}
                sizes={mediaImageSizes.contentCover}
                src={coverImage.src}
                width={coverImage.width}
              />
              {coverImage.caption ? <figcaption>{coverImage.caption}</figcaption> : null}
            </figure>
          ) : null}

          <header className="content-detail-header">
            <p>{entry.displayDate ?? entry.publishedAt ?? "Draft"}</p>
            <h1>{entry.title}</h1>
            {entry.summary ? <div>{entry.summary}</div> : null}
          </header>

          <RichTextRenderer
            body={entry.body}
            hiddenImageIds={reservedImageIds}
            images={entry.images}
          />

          {detailImages.length > 0 ? (
            <div className="content-detail-image-strip">
              {detailImages.map((image) => (
                <figure key={image.id}>
                  <ArtworkImage
                    alt={image.alt}
                    height={image.height}
                    loading="lazy"
                    quality={70}
                    sizes={mediaImageSizes.contentDetailStrip}
                    src={image.src}
                    width={image.width}
                  />
                  {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : null}

          {relatedProduct ? (
            <aside className="content-related-product">
              <div>
                <span>연결 상품</span>
                <h2>{relatedProduct.titleKo}</h2>
                <p>{relatedProduct.shortDescription}</p>
              </div>
              <SiteArrowLink href={`/shop/${relatedProduct.slug}`}>
                작업물 보기
              </SiteArrowLink>
            </aside>
          ) : null}
        </article>
      </PageShell>
    </>
  );
}
