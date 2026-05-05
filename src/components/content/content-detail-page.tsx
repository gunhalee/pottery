/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { MetaLabel, PageShell } from "@/components/site/primitives";
import { RichTextRenderer } from "@/components/content/rich-text-renderer";
import type { ContentEntry } from "@/lib/content-manager/content-model";

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
  const coverImage =
    entry.images.find((image) => image.isCover) ?? entry.images[0] ?? null;
  const detailImages = entry.images.filter((image) => image.isDetail);

  return (
    <PageShell className="content-detail-shell">
      {preview ? (
        <div className="admin-preview-banner">관리자 미리보기</div>
      ) : null}
      <MetaLabel>{entry.kind === "news" ? "News" : "Gallery"}</MetaLabel>
      <article className="content-detail">
        <header className="content-detail-header">
          <p>{entry.displayDate ?? entry.publishedAt ?? "Draft"}</p>
          <h1>{entry.title}</h1>
          {entry.summary ? <div>{entry.summary}</div> : null}
        </header>

        {coverImage ? (
          <figure className="content-detail-cover">
            <img
              alt={coverImage.alt}
              decoding="async"
              height={coverImage.height}
              loading="eager"
              src={coverImage.src}
              width={coverImage.width}
            />
            {coverImage.caption ? <figcaption>{coverImage.caption}</figcaption> : null}
          </figure>
        ) : null}

        <RichTextRenderer body={entry.body} images={entry.images} />

        {detailImages.length > 0 ? (
          <div className="content-detail-image-strip">
            {detailImages.map((image) => (
              <figure key={image.id}>
                <img
                  alt={image.alt}
                  decoding="async"
                  height={image.height}
                  loading="lazy"
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
              <span>Linked Work</span>
              <h2>{relatedProduct.titleKo}</h2>
              <p>{relatedProduct.shortDescription}</p>
            </div>
            <Link className="link-arrow" href={`/shop/${relatedProduct.slug}`}>
              작품 보기
            </Link>
          </aside>
        ) : null}
      </article>
    </PageShell>
  );
}
