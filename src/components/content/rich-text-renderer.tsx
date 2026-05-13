import type { ReactNode } from "react";
import { InstagramEmbed } from "@/components/content/instagram-embed";
import { ArtworkImage } from "@/components/media/artwork-image";
import { getContentBodyImage } from "@/lib/content-manager/content-images";
import type { ContentImage } from "@/lib/content-manager/content-model";

type RichTextRendererProps = {
  body: unknown;
  className?: string;
  hiddenImageIds?: string[];
  images?: ContentImage[];
};

type RichNode = {
  alt?: unknown;
  caption?: unknown;
  children?: unknown;
  format?: unknown;
  id?: unknown;
  layout?: unknown;
  listType?: unknown;
  src?: unknown;
  tag?: unknown;
  text?: unknown;
  type?: unknown;
  url?: unknown;
  videoId?: unknown;
  width?: unknown;
  height?: unknown;
};

export function RichTextRenderer({
  body,
  className,
  hiddenImageIds = [],
  images = [],
}: RichTextRendererProps) {
  const imageById = new Map(images.map((image) => [image.id, image]));
  const hiddenImageIdSet = new Set(hiddenImageIds);
  const root = getRoot(body);
  const children = getChildren(root);

  if (children.length === 0) {
    return null;
  }

  return (
    <div className={["rich-text", className].filter(Boolean).join(" ")}>
      {children.map((node, index) =>
        renderNode(node, `${index}`, imageById, hiddenImageIdSet),
      )}
    </div>
  );
}

function renderNode(
  node: unknown,
  key: string,
  imageById: Map<string, ContentImage>,
  hiddenImageIdSet: Set<string>,
): ReactNode {
  if (!isRichNode(node)) {
    return null;
  }

  if (typeof node.text === "string") {
    return renderFormattedText(node.text, node.format, key);
  }

  const children = getChildren(node).map((child, index) =>
    renderNode(child, `${key}-${index}`, imageById, hiddenImageIdSet),
  );

  switch (node.type) {
    case "paragraph":
      return (
        <p className="rich-text-paragraph" key={key}>
          {children.length > 0 ? children : <br />}
        </p>
      );
    case "heading":
      return renderHeading(node, key, children);
    case "quote":
      return (
        <blockquote className="rich-text-quote" key={key}>
          {children}
        </blockquote>
      );
    case "list":
      return node.listType === "number" ? (
        <ol className="rich-text-list rich-text-list-ordered" key={key}>
          {children}
        </ol>
      ) : (
        <ul className="rich-text-list" key={key}>
          {children}
        </ul>
      );
    case "listitem":
      return <li key={key}>{children}</li>;
    case "link":
      return renderLink(node, key, children);
    case "code":
      return (
        <pre className="rich-text-code" key={key}>
          <code>{collectText(node)}</code>
        </pre>
      );
    case "linebreak":
      return <br key={key} />;
    case "horizontalrule":
      return <hr className="rich-text-rule" key={key} />;
    case "content-image":
      return renderContentImage(node, key, imageById, hiddenImageIdSet);
    case "youtube":
      return renderYouTube(node, key);
    case "instagram":
      return renderInstagram(node, key);
    default:
      return children.length > 0 ? <div key={key}>{children}</div> : null;
  }
}

function renderFormattedText(text: string, format: unknown, key: string) {
  let content: ReactNode = text;
  const bitmask = typeof format === "number" ? format : 0;

  if (bitmask & 16) {
    content = <code>{content}</code>;
  }

  if (bitmask & 8) {
    content = <u>{content}</u>;
  }

  if (bitmask & 4) {
    content = <s>{content}</s>;
  }

  if (bitmask & 2) {
    content = <em>{content}</em>;
  }

  if (bitmask & 1) {
    content = <strong>{content}</strong>;
  }

  return <span key={key}>{content}</span>;
}

function renderHeading(node: RichNode, key: string, children: ReactNode[]) {
  if (node.tag === "h3") {
    return (
      <h3 className="rich-text-heading rich-text-heading-h3" key={key}>
        {children}
      </h3>
    );
  }

  if (node.tag === "h4") {
    return (
      <h4 className="rich-text-heading rich-text-heading-h4" key={key}>
        {children}
      </h4>
    );
  }

  return (
    <h2 className="rich-text-heading rich-text-heading-h2" key={key}>
      {children}
    </h2>
  );
}

function renderLink(node: RichNode, key: string, children: ReactNode[]) {
  const href = typeof node.url === "string" ? sanitizeHref(node.url) : null;

  if (!href) {
    return <span key={key}>{children}</span>;
  }

  const external = /^https?:\/\//.test(href);

  return (
    <a
      className="rich-text-link"
      href={href}
      key={key}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

function renderContentImage(
  node: RichNode,
  key: string,
  imageById: Map<string, ContentImage>,
  hiddenImageIdSet: Set<string>,
) {
  if (typeof node.id === "string" && hiddenImageIdSet.has(node.id)) {
    return null;
  }

  const image =
    typeof node.id === "string" ? imageById.get(node.id) ?? null : null;
  const displayImage = image ? getContentBodyImage(image) : null;
  const src = image
    ? (displayImage?.src ?? "")
    : typeof node.src === "string"
      ? node.src
      : "";
  const alt = displayImage?.alt ?? (typeof node.alt === "string" ? node.alt : "");
  const caption =
    displayImage?.caption ??
    (typeof node.caption === "string" ? node.caption : "");
  const layout =
    displayImage?.layout ??
    (typeof node.layout === "string" ? node.layout : "default");
  const width =
    displayImage?.width ??
    (typeof node.width === "number" ? node.width : undefined);
  const height =
    displayImage?.height ??
    (typeof node.height === "number" ? node.height : undefined);

  if (!src) {
    return null;
  }

  return (
    <figure className={`rich-text-image rich-text-image-${layout}`} key={key}>
      <ArtworkImage
        alt={alt}
        height={height}
        loading="lazy"
        quality={70}
        sizes={getRichTextImageSizes(layout)}
        src={src}
        width={width}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function getRichTextImageSizes(layout: string) {
  if (layout === "full") {
    return "100vw";
  }

  if (layout === "wide") {
    return "(max-width: 900px) 100vw, 1120px";
  }

  if (
    layout === "two-column" ||
    layout === "align-left" ||
    layout === "align-right"
  ) {
    return "(max-width: 760px) 100vw, 50vw";
  }

  return "(max-width: 900px) 100vw, 760px";
}

function renderYouTube(node: RichNode, key: string) {
  const embedUrl = getYouTubeEmbedUrl(node);

  if (!embedUrl) {
    return null;
  }

  return (
    <div className="rich-text-embed rich-text-youtube" key={key}>
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        src={embedUrl}
        title="YouTube video"
      />
    </div>
  );
}

function renderInstagram(node: RichNode, key: string) {
  const url = typeof node.url === "string" ? sanitizeInstagramUrl(node.url) : "";

  if (!url) {
    return null;
  }

  return <InstagramEmbed key={key} url={url} />;
}

function getYouTubeEmbedUrl(node: RichNode) {
  const videoId =
    typeof node.videoId === "string"
      ? node.videoId
      : typeof node.url === "string"
        ? extractYouTubeId(node.url)
        : null;

  if (!videoId || !/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) {
    return null;
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

function extractYouTubeId(value: string) {
  try {
    const url = new URL(value);

    if (url.hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const [, kind, id] = url.pathname.split("/");

      if (kind === "embed" || kind === "shorts") {
        return id ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeInstagramUrl(value: string) {
  try {
    const url = new URL(value);

    if (!url.hostname.endsWith("instagram.com")) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function sanitizeHref(value: string) {
  const href = value.trim();

  if (href.startsWith("/")) {
    return href;
  }

  if (/^https?:\/\//.test(href)) {
    return href;
  }

  return "";
}

function collectText(node: RichNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }

  return getChildren(node)
    .map((child) => (isRichNode(child) ? collectText(child) : ""))
    .join("");
}

function getRoot(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "root" in body &&
    isRichNode(body.root)
  ) {
    return body.root;
  }

  return null;
}

function getChildren(node: unknown) {
  if (!isRichNode(node) || !Array.isArray(node.children)) {
    return [];
  }

  return node.children;
}

function isRichNode(value: unknown): value is RichNode {
  return typeof value === "object" && value !== null;
}
