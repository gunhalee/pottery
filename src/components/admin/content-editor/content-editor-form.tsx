"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { CodeHighlightNode, CodeNode, $createCodeNode } from "@lexical/code";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type EditorState,
} from "lexical";
import {
  deleteContentImageAction,
  updateContentEntryAction,
} from "@/app/admin/actions";
import { AdminUploadFeedbackMessage } from "@/components/admin/admin-upload-feedback-message";
import {
  MediaPicker,
  type MediaPickerAsset,
} from "@/components/admin/media-picker";
import { MediaPublishReadiness } from "@/components/admin/media-publish-readiness";
import { RichTextRenderer } from "@/components/content/rich-text-renderer";
import {
  buildAdminUploadError,
  readAdminUploadPayload,
  uploadExceptionToFeedback,
  type AdminUploadFeedback,
  type AdminUploadPayload,
} from "@/lib/admin/upload-feedback";
import { withContentImageVariant } from "@/lib/content-manager/content-images";
import { buildMediaVariantSources } from "@/lib/media/media-variant-policy";
import {
  getContentImageEditorStatus,
  getContentImagesPublishIssues,
} from "@/lib/media/media-editor-status";
import type {
  ContentEntry,
  ContentImage,
  ContentImageLayout,
  ContentKind,
} from "@/lib/content-manager/content-model";
import {
  extractPlainTextFromLexicalJson,
  walkLexicalNodes,
} from "@/lib/content-manager/rich-text-utils";
import { normalizeRichTextBody } from "@/lib/content-manager/rich-text-defaults";
import {
  $createContentImageNode,
  $createInstagramNode,
  $createYouTubeNode,
  ContentImageNode,
  extractYouTubeVideoId,
  InstagramNode,
  normalizeInstagramUrl,
  YouTubeNode,
} from "./nodes";

type ContentEditorFormProps = {
  entry: ContentEntry;
  mediaAssets?: MediaPickerAsset[];
  productOptions?: Array<{
    slug: string;
    title: string;
  }>;
  previewHref: string;
};

type UploadedImageResponse = AdminUploadPayload & {
  image: ContentImage;
  ok: boolean;
};

const imageLayoutOptions: Array<{
  label: string;
  value: ContentImageLayout;
}> = [
  { label: "기본폭", value: "default" },
  { label: "넓게", value: "wide" },
  { label: "전체폭", value: "full" },
  { label: "2열", value: "two-column" },
  { label: "좌측", value: "align-left" },
  { label: "우측", value: "align-right" },
];

const editorTheme = {
  code: "lexical-code",
  heading: {
    h2: "lexical-heading lexical-heading-h2",
    h3: "lexical-heading lexical-heading-h3",
  },
  link: "lexical-link",
  list: {
    listitem: "lexical-list-item",
    nested: {
      listitem: "lexical-nested-list-item",
    },
    ol: "lexical-list lexical-list-ordered",
    ul: "lexical-list",
  },
  paragraph: "lexical-paragraph",
  quote: "lexical-quote",
  text: {
    bold: "lexical-text-bold",
    code: "lexical-text-code",
    italic: "lexical-text-italic",
    strikethrough: "lexical-text-strikethrough",
    underline: "lexical-text-underline",
  },
};

export function ContentEditorForm({
  entry,
  mediaAssets = [],
  previewHref,
  productOptions = [],
}: ContentEditorFormProps) {
  const [title, setTitle] = useState(entry.title);
  const [bodyJson, setBodyJson] = useState(() =>
    JSON.stringify(normalizeRichTextBody(entry.body, entry.bodyText)),
  );
  const [initialBodyJson] = useState(bodyJson);
  const [initialImageIds] = useState(() => entry.images.map((image) => image.id));
  const [bodyText, setBodyText] = useState(entry.bodyText);
  const [displayDate, setDisplayDate] = useState(entry.displayDate ?? "");
  const [images, setImages] = useState(entry.images);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState(entry.summary);
  const previewBody = useMemo(() => safeParseJson(bodyJson), [bodyJson]);
  const bodyImageIds = useMemo(
    () => getContentImageIds(previewBody),
    [previewBody],
  );
  const coverImage = images.find((image) => image.isCover) ?? null;
  const listImage = images.find((image) => image.isListImage) ?? null;
  const hasRoleGaps = images.length > 0 && (!coverImage || !listImage);
  const publishIssues = useMemo(
    () => getContentImagesPublishIssues(images, bodyImageIds),
    [bodyImageIds, images],
  );
  const pendingUploadCount = images.filter(
    (image) => !initialImageIds.includes(image.id),
  ).length;
  const hasUnsavedChanges =
    title !== entry.title ||
    bodyJson !== initialBodyJson ||
    displayDate !== (entry.displayDate ?? "") ||
    summary !== entry.summary ||
    pendingUploadCount > 0;

  useEffect(() => {
    if (!hasUnsavedChanges || isSubmitting) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isSubmitting]);

  const initialConfig = useMemo(
    () => ({
      editorState: initialBodyJson,
      namespace: `content-editor-${entry.id}`,
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        LinkNode,
        CodeNode,
        CodeHighlightNode,
        ContentImageNode,
        YouTubeNode,
        InstagramNode,
      ],
      onError(error: Error) {
        throw error;
      },
      theme: editorTheme,
    }),
    [entry.id, initialBodyJson],
  );

  const imagesJson = useMemo(
    () =>
      JSON.stringify(
        images.map((image, index) => ({
          alt: image.alt,
          caption: image.caption ?? "",
          id: image.id,
          isCover: image.isCover,
          isDetail: image.isDetail,
          isListImage: image.isListImage,
          isReserved: image.isReserved,
          layout: image.layout,
          sortOrder: index,
        })),
      ),
    [images],
  );

  return (
    <form
      action={updateContentEntryAction}
      className="admin-content-editor"
      onSubmit={() => setIsSubmitting(true)}
    >
      <input name="bodyJson" type="hidden" value={bodyJson} />
      <input name="bodyText" type="hidden" value={bodyText} />
      <input name="entryId" type="hidden" value={entry.id} />
      <input name="id" type="hidden" value={entry.id} />
      <input name="imagesJson" type="hidden" value={imagesJson} />
      <input name="kind" type="hidden" value={entry.kind} />

      <div className="admin-content-editor-main">
        {pendingUploadCount > 0 ? (
          <div className="admin-alert admin-alert-warning admin-unsaved-media-alert">
            새로 올린 이미지 {pendingUploadCount}개가 아직 저장되지 않았습니다.
            저장하지 않고 나가면 이후 cleanup 대상이 될 수 있습니다.
          </div>
        ) : null}

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>기본 정보</h2>
            <a
              className="admin-text-button"
              href={previewHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              미리보기
            </a>
          </div>
          <div className="admin-form admin-content-meta-form">
            <div className="admin-form-grid">
              <label>
                <span>제목</span>
                <input
                  name="title"
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  value={title}
                />
              </label>
              <label>
                <span>slug</span>
                <input
                  defaultValue={entry.slug}
                  name="slug"
                  pattern="[a-z0-9-]+"
                  required
                />
              </label>
            </div>
            <div className="admin-form-grid">
              <label>
                <span>{entry.kind === "news" ? "날짜" : "연도/날짜"}</span>
                <input
                  name="displayDate"
                  onChange={(event) => setDisplayDate(event.target.value)}
                  placeholder={entry.kind === "news" ? "2026.05" : "2026"}
                  value={displayDate}
                />
              </label>
              <label>
                <span>상태</span>
                <select defaultValue={entry.status} name="status">
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </label>
            </div>
            <label>
              <span>짧은 설명</span>
              <textarea
                name="summary"
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
                value={summary}
              />
            </label>
            {entry.kind === "gallery" ? (
              <label>
                <span>연결 상품</span>
                <select
                  defaultValue={entry.relatedProductSlug ?? ""}
                  name="relatedProductSlug"
                >
                  <option value="">연결 안 함</option>
                  {productOptions.map((product) => (
                    <option key={product.slug} value={product.slug}>
                      {product.title} / {product.slug}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input name="relatedProductSlug" type="hidden" value="" />
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>본문</h2>
            <span>{bodyText.length} chars</span>
          </div>
          <LexicalComposer initialConfig={initialConfig}>
            <EditorToolbar
              entryId={entry.id}
              kind={entry.kind}
              mediaAssets={mediaAssets}
              onImageUploaded={(image) =>
                setImages((current) =>
                  current.some((item) => item.id === image.id)
                    ? current
                    : [...current, image],
                )
              }
            />
            <div className="editor-shell">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    aria-placeholder="본문을 입력하세요."
                    className="editor-input"
                    placeholder={
                      <div className="editor-placeholder">
                        본문을 입력하세요.
                      </div>
                    }
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
                placeholder={null}
              />
              <HistoryPlugin />
              <ListPlugin />
              <LinkPlugin validateUrl={isSafeEditorUrl} />
              <OnChangePlugin
                ignoreSelectionChange
                onChange={(editorState) =>
                  handleEditorChange(editorState, setBodyJson, setBodyText)
                }
              />
            </div>
          </LexicalComposer>
          <button className="button-primary admin-save-button" type="submit">
            저장
          </button>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>본문 이미지</h2>
            <span>{images.length} images</span>
          </div>
          {hasRoleGaps ? (
            <div className="admin-alert admin-alert-warning admin-image-role-alert">
              대표 이미지와 목록 이미지를 모두 지정해야 상세/목록 노출이
              안정적으로 이어집니다.
            </div>
          ) : null}
          <MediaPublishReadiness
            issues={publishIssues}
            okText="대표, 목록, 본문 이미지와 역할별 variant가 준비되어 있습니다."
          />
          {images.length > 0 ? (
            <div className="admin-image-list">
              {images.map((image) => (
                <ImageSettings
                  imageInBody={bodyImageIds.has(image.id)}
                  image={image}
                  key={image.id}
                  onChange={(patch) =>
                    setImages((current) =>
                      updateImageSettings(current, image.id, patch),
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <p className="admin-empty-text">
              본문 툴바의 이미지 버튼으로 업로드하면 여기에 표시됩니다.
            </p>
          )}
        </section>
      </div>

      <aside className="admin-panel admin-content-preview-panel">
        <div className="admin-panel-head">
          <h2>즉시 미리보기</h2>
          <span>{entry.kind === "news" ? "소식" : "작품"}</span>
        </div>
        <article className="admin-live-preview">
          {coverImage ? (
            <figure className="admin-live-preview-cover">
              <img
                alt={coverImage.alt}
                src={withContentImageVariant(coverImage, "detail").src}
              />
            </figure>
          ) : null}
          <p className="admin-preview-date">{displayDate}</p>
          <h1>{title || "제목 없음"}</h1>
          {summary ? <p className="admin-preview-summary">{summary}</p> : null}
          <RichTextRenderer body={previewBody} images={images} />
        </article>
      </aside>
    </form>
  );
}

function EditorToolbar({
  entryId,
  kind,
  mediaAssets,
  onImageUploaded,
}: {
  entryId: string;
  kind: ContentKind;
  mediaAssets: MediaPickerAsset[];
  onImageUploaded: (image: ContentImage) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [uploadLayout, setUploadLayout] =
    useState<ContentImageLayout>("default");
  const [uploadFeedback, setUploadFeedback] =
    useState<AdminUploadFeedback | null>(null);
  const [uploading, setUploading] = useState(false);

  function formatBlock(type: "paragraph" | "quote" | HeadingTagType | "code") {
    editor.update(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        return;
      }

      if (type === "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (type === "quote") {
        $setBlocksType(selection, () => $createQuoteNode());
      } else if (type === "code") {
        $setBlocksType(selection, () => $createCodeNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(type));
      }
    });
  }

  function insertYouTube() {
    const url = window.prompt("YouTube URL");
    const videoId = url ? extractYouTubeVideoId(url) : null;

    if (!url || !videoId) {
      return;
    }

    editor.update(() => $insertNodes([$createYouTubeNode(url, videoId)]));
  }

  function insertInstagram() {
    const url = normalizeInstagramUrl(window.prompt("Instagram URL") ?? "");

    if (!url) {
      return;
    }

    editor.update(() => $insertNodes([$createInstagramNode(url)]));
  }

  function toggleLink() {
    const url = window.prompt("링크 URL. 빈 값이면 링크를 해제합니다.");

    if (url === null) {
      return;
    }

    const href = url.trim();
    editor.dispatchCommand(
      TOGGLE_LINK_COMMAND,
      href && isSafeEditorUrl(href) ? href : null,
    );
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setUploadFeedback({
      description: "본문에 삽입할 이미지를 webp variant로 변환하고 있습니다.",
      title: "본문 이미지 업로드 중",
      tone: "info",
    });

    try {
      const formData = new FormData();
      formData.set("entryId", entryId);
      formData.set("kind", kind);
      formData.set("layout", uploadLayout);
      formData.set("file", file);

      const response = await fetch("/api/uploads/content-image", {
        body: formData,
        method: "POST",
      });
      const payload = await readAdminUploadPayload<UploadedImageResponse>(
        response,
      );

      if (!response.ok || !payload?.ok || !payload.image) {
        throw buildAdminUploadError(response, payload, "content-image");
      }

      onImageUploaded(payload.image);
      editor.update(() =>
        $insertNodes([
          $createContentImageNode({
            alt: payload.image.alt,
            caption: payload.image.caption,
            height: payload.image.height,
            id: payload.image.id,
            layout: payload.image.layout,
            src: payload.image.src,
            width: payload.image.width,
          }),
        ]),
      );
      setUploadFeedback({
        description: "이미지를 본문에 삽입했습니다. 저장하면 글에 반영됩니다.",
        title: "본문 이미지를 업로드했습니다",
        tone: "success",
      });
    } catch (error) {
      const feedback = uploadExceptionToFeedback(error, "content-image");
      setUploadFeedback(feedback);
    } finally {
      setUploading(false);
    }
  }

  function insertLibraryImage(asset: MediaPickerAsset) {
    const image = mediaAssetToContentImage(asset, uploadLayout);

    onImageUploaded(image);
    editor.update(() =>
      $insertNodes([
        $createContentImageNode({
          alt: image.alt,
          caption: image.caption,
          height: image.height,
          id: image.id,
          layout: image.layout,
          src: image.src,
          width: image.width,
        }),
      ]),
    );
    setUploadFeedback({
      description: "선택한 미디어를 본문에 삽입했습니다. 저장하면 글에 반영됩니다.",
      title: "라이브러리 이미지를 삽입했습니다",
      tone: "success",
    });
  }

  return (
    <>
      <div className="editor-toolbar" role="toolbar" aria-label="본문 편집 도구">
        <button onClick={() => formatBlock("paragraph")} title="문단" type="button">
          P
        </button>
        <button onClick={() => formatBlock("h2")} title="제목 2" type="button">
          H2
        </button>
        <button onClick={() => formatBlock("h3")} title="제목 3" type="button">
          H3
        </button>
        <button onClick={() => formatBlock("quote")} title="인용" type="button">
          “”
        </button>
        <button onClick={() => formatBlock("code")} title="코드블록" type="button">
          {"</>"}
        </button>
        <span className="editor-toolbar-separator" />
        <button
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
          title="굵게"
          type="button"
        >
          B
        </button>
        <button
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
          title="기울임"
          type="button"
        >
          I
        </button>
        <button
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
          title="밑줄"
          type="button"
        >
          U
        </button>
        <button
          onClick={() =>
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
          }
          title="취소선"
          type="button"
        >
          S
        </button>
        <button
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
          title="인라인 코드"
          type="button"
        >
          ``
        </button>
        <span className="editor-toolbar-separator" />
        <button
          onClick={() =>
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
          }
          title="불릿 목록"
          type="button"
        >
          •
        </button>
        <button
          onClick={() =>
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
          }
          title="번호 목록"
          type="button"
        >
          1.
        </button>
        <button onClick={toggleLink} title="링크" type="button">
          Link
        </button>
        <button onClick={insertYouTube} title="YouTube" type="button">
          YouTube
        </button>
        <button onClick={insertInstagram} title="Instagram" type="button">
          Instagram
        </button>
        <label className="editor-upload-control">
          <span>Image</span>
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";

              if (file) {
                void uploadImage(file);
              }
            }}
            type="file"
          />
        </label>
        <select
          aria-label="이미지 레이아웃"
          onChange={(event) =>
            setUploadLayout(event.target.value as ContentImageLayout)
          }
          value={uploadLayout}
        >
          {imageLayoutOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {uploadFeedback ? (
        <AdminUploadFeedbackMessage feedback={uploadFeedback} />
      ) : null}
      {mediaAssets.length > 0 ? (
        <MediaPicker
          assets={mediaAssets}
          onSelect={insertLibraryImage}
          title="본문 이미지로 재사용"
        />
      ) : null}
    </>
  );
}

function mediaAssetToContentImage(
  asset: MediaPickerAsset,
  layout: ContentImageLayout,
): ContentImage {
  const variants = buildMediaVariantSources(asset);
  const detail = withContentImageVariant(
    {
      alt: asset.alt,
      caption: asset.caption,
      createdAt: asset.createdAt,
      height: asset.height,
      id: asset.id,
      isCover: false,
      isDetail: false,
      isListImage: false,
      isReserved: asset.reserved,
      layout,
      sortOrder: 0,
      src: asset.src,
      storagePath: asset.masterPath,
      updatedAt: asset.updatedAt,
      variants,
      width: asset.width,
    },
    "detail",
  );

  return {
    ...detail,
    variants,
  };
}

function ImageSettings({
  imageInBody,
  image,
  onChange,
}: {
  imageInBody: boolean;
  image: ContentImage;
  onChange: (patch: Partial<ContentImage>) => void;
}) {
  const imageStatus = getContentImageEditorStatus(image, imageInBody);
  const previewImage = withContentImageVariant(image, "thumbnail");

  return (
    <article className="admin-image-item">
      <img alt={image.alt} src={previewImage.src} />
      <div className="admin-form">
        <div className="admin-image-role-summary">
          <span>노출 위치</span>
          <strong>{imageStatus.exposureLabel}</strong>
        </div>
        <div className="admin-media-status-strip">
          <span
            className={`admin-media-status-pill admin-media-status-${imageStatus.variantTone}`}
          >
            {imageStatus.variantLabel}
          </span>
          {imageStatus.requiredVariants.length > 0 ? (
            <span>필요: {imageStatus.requiredVariants.join(" / ")}</span>
          ) : (
            <span>발행 필수 variant 없음</span>
          )}
        </div>
        {imageStatus.publishIssues.length > 0 ? (
          <p className="admin-image-role-note admin-image-role-note-danger">
            발행 차단: {imageStatus.publishIssues.join(" · ")}
          </p>
        ) : null}
        <label>
          <span>대체 텍스트</span>
          <input
            onChange={(event) => onChange({ alt: event.target.value })}
            value={image.alt}
          />
        </label>
        <label>
          <span>캡션</span>
          <input
            onChange={(event) => onChange({ caption: event.target.value })}
            value={image.caption ?? ""}
          />
        </label>
        <div className="admin-form-grid">
          <label>
            <span>레이아웃</span>
            <select
              onChange={(event) =>
                onChange({ layout: event.target.value as ContentImageLayout })
              }
              value={image.layout}
            >
              {imageLayoutOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-image-checks">
            <label>
              <input
                checked={image.isCover}
                disabled={image.isReserved}
                onChange={(event) => onChange({ isCover: event.target.checked })}
                type="checkbox"
              />
              <span>대표</span>
            </label>
            <label>
              <input
                checked={image.isListImage}
                disabled={image.isReserved}
                onChange={(event) =>
                  onChange({ isListImage: event.target.checked })
                }
                type="checkbox"
              />
              <span>목록</span>
            </label>
            <label>
              <input
                checked={image.isDetail}
                disabled={image.isReserved}
                onChange={(event) => onChange({ isDetail: event.target.checked })}
                type="checkbox"
              />
              <span>상세</span>
            </label>
            <label>
              <input
                checked={image.isReserved}
                disabled={imageInBody}
                onChange={(event) =>
                  onChange({ isReserved: event.target.checked })
                }
                type="checkbox"
              />
              <span>보관</span>
            </label>
          </div>
        </div>
        {imageInBody && image.isReserved ? (
          <p className="admin-image-role-note">
            본문에 삽입된 이미지는 저장 시 보관 상태가 해제됩니다.
          </p>
        ) : null}
        <button
          className="admin-danger-inline-button"
          formAction={deleteContentImageAction}
          name="imageId"
          type="submit"
          value={image.id}
        >
          이미지 삭제
        </button>
      </div>
    </article>
  );
}

function updateImageSettings(
  images: ContentImage[],
  imageId: string,
  patch: Partial<ContentImage>,
) {
  return images.map((image, index) => {
    const isTarget = image.id === imageId;
    const targetPatch = isTarget ? patch : {};
    const isReserved = isTarget
      ? Boolean(targetPatch.isReserved ?? image.isReserved)
      : image.isReserved;

    return {
      ...image,
      ...(targetPatch as Partial<ContentImage>),
      isCover:
        patch.isCover && !isTarget
          ? false
          : isTarget
            ? !isReserved && (patch.isCover ?? image.isCover)
            : image.isCover,
      isDetail: isTarget
        ? !isReserved && (patch.isDetail ?? image.isDetail)
        : image.isDetail,
      isListImage:
        patch.isListImage && !isTarget
          ? false
          : isTarget
            ? !isReserved && (patch.isListImage ?? image.isListImage)
            : image.isListImage,
      isReserved,
      sortOrder: index,
    };
  });
}

function handleEditorChange(
  editorState: EditorState,
  setBodyJson: (value: string) => void,
  setBodyText: (value: string) => void,
) {
  const json = editorState.toJSON();
  setBodyJson(JSON.stringify(json));
  setBodyText(extractPlainTextFromLexicalJson(json));
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getContentImageIds(body: unknown) {
  return new Set(
    walkLexicalNodes(body)
      .filter((node) => node.type === "content-image")
      .map((node) => node.id)
      .filter((id): id is string => typeof id === "string"),
  );
}

function isSafeEditorUrl(url: string) {
  return url.startsWith("/") || /^https?:\/\//.test(url);
}
