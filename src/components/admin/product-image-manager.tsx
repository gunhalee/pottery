"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { deleteProductImageAction } from "@/app/admin/actions";
import { AdminUploadFeedbackMessage } from "@/components/admin/admin-upload-feedback-message";
import {
  MediaPicker,
  type MediaPickerAsset,
} from "@/components/admin/media-picker";
import {
  buildAdminUploadError,
  readAdminUploadPayload,
  uploadExceptionToFeedback,
  type AdminUploadFeedback,
  type AdminUploadPayload,
} from "@/lib/admin/upload-feedback";
import {
  buildMediaVariantSources,
  pickMediaVariantForSurface,
  pickVariantSource,
} from "@/lib/media/media-variant-policy";
import type { ProductImage } from "@/lib/shop/product-model";

type EditableProductImage = ProductImage & {
  isDescription: boolean;
  isDetail: boolean;
  isListImage: boolean;
  id: string;
  isPrimary: boolean;
};

type ProductImageUploadResponse = AdminUploadPayload & {
  image?: ProductImage;
  ok: boolean;
};

type ProductImageManagerProps = {
  formId: string;
  initialImages: ProductImage[];
  mediaAssets?: MediaPickerAsset[];
  productId: string;
};

export function ProductImageManager({
  formId,
  initialImages,
  mediaAssets = [],
  productId,
}: ProductImageManagerProps) {
  const initialStoragePaths = useMemo(
    () =>
      new Set(
        initialImages
          .map((image) => image.storagePath)
          .filter((storagePath): storagePath is string => Boolean(storagePath)),
      ),
    [initialImages],
  );
  const [images, setImages] = useState(() =>
    ensureSinglePrimary(
      initialImages.map((image, index) => normalizeEditableImage(image, index)),
    ),
  );
  const [status, setStatus] = useState<AdminUploadFeedback | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formSubmittingRef = useRef(false);
  const imagesJson = useMemo(
    () =>
      JSON.stringify(
        images.map((image) => ({
          alt: image.alt,
          cafe24ImagePath: image.cafe24ImagePath,
          caption: image.caption,
          height: image.height,
          id: image.id,
          isDescription: image.isDescription,
          isDetail: image.isDetail,
          isListImage: image.isListImage,
          isPrimary: image.isPrimary,
          placeholderLabel: image.placeholderLabel,
          src: image.src,
          storagePath: image.storagePath,
          variants: image.variants,
          width: image.width,
        })),
      ),
    [images],
  );
  const pendingStoragePaths = useMemo(
    () =>
      images
        .map((image) => image.storagePath)
        .filter(
          (storagePath): storagePath is string =>
            typeof storagePath === "string" &&
            !initialStoragePaths.has(storagePath),
        ),
    [images, initialStoragePaths],
  );
  const pendingStoragePathKey = pendingStoragePaths.join("\n");

  useEffect(() => {
    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const handleSubmit = () => {
      formSubmittingRef.current = true;
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [formId]);

  useEffect(() => {
    if (!pendingStoragePathKey) {
      return;
    }

    const cleanupOnExit = () => {
      if (!formSubmittingRef.current) {
        cleanupPendingProductImages(productId, pendingStoragePaths, true);
      }
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (formSubmittingRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };
    const handleLinkClick = (event: MouseEvent) => {
      if (
        formSubmittingRef.current ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a[href]");

      if (!(link instanceof HTMLAnchorElement) || link.target) {
        return;
      }

      if (!window.confirm("저장하지 않은 상품 이미지 업로드가 있습니다. 이동할까요?")) {
        event.preventDefault();
        return;
      }

      cleanupPendingProductImages(productId, pendingStoragePaths, true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", cleanupOnExit);
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", cleanupOnExit);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [pendingStoragePathKey, pendingStoragePaths, productId]);

  async function uploadImage(file: File) {
    setIsUploading(true);
    setStatus({
      description: "이미지를 webp로 변환하고 역할별 variant를 생성하고 있습니다.",
      title: "상품 이미지 업로드 중",
      tone: "info",
    });

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("file", file);

    try {
      const response = await fetch("/api/uploads/product-image", {
        body: formData,
        method: "POST",
      });
      const payload =
        await readAdminUploadPayload<ProductImageUploadResponse>(response);

      if (!response.ok || !payload?.ok || !payload.image) {
        throw buildAdminUploadError(response, payload, "product-image");
      }

      setImages((current) => {
        const retainedImages = current.filter(hasRealImageSource);
        const shouldBecomePrimary = !retainedImages.some((image) => image.src);
        const nextImage = normalizeEditableImage(payload.image!, current.length);

        return ensureSinglePrimary([
          ...retainedImages.map((image) => ({
            ...image,
            isListImage: shouldBecomePrimary ? false : image.isListImage,
            isPrimary: shouldBecomePrimary ? false : image.isPrimary,
          })),
          {
            ...nextImage,
            isDetail: !shouldBecomePrimary,
            isListImage: shouldBecomePrimary,
            isPrimary: shouldBecomePrimary,
          },
        ]);
      });
      setStatus({
        description: "상품 저장을 누르면 공개 페이지에 반영됩니다.",
        title: "상품 이미지를 업로드했습니다",
        tone: "success",
      });
    } catch (error) {
      setStatus(uploadExceptionToFeedback(error, "product-image"));
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function discardPendingUploads() {
    if (pendingStoragePaths.length === 0) {
      return;
    }

    setStatus({
      description: "저장하지 않은 이미지를 storage에서 제거하고 있습니다.",
      title: "업로드 이미지 정리 중",
      tone: "info",
    });

    try {
      await cleanupPendingProductImages(productId, pendingStoragePaths);
      setImages((current) =>
        ensureSinglePrimary(
          current.filter(
            (image) =>
              !image.storagePath || !pendingStoragePaths.includes(image.storagePath),
          ),
        ),
      );
      setStatus({
        description: "저장 전 업로드된 이미지가 목록에서 제거되었습니다.",
        title: "업로드 이미지를 정리했습니다",
        tone: "success",
      });
    } catch (error) {
      setStatus({
        action: "편집 화면을 새로고침한 뒤 이미지 목록을 다시 확인해 주세요.",
        description:
          error instanceof Error
            ? error.message
            : "저장하지 않은 이미지 정리에 실패했습니다.",
        title: "업로드 이미지 정리 실패",
        tone: "error",
      });
    }
  }

  function addLibraryImage(asset: MediaPickerAsset) {
    if (images.some((image) => image.id === asset.id)) {
      setStatus({
        description: "이미 이 상품에 연결된 미디어입니다.",
        title: "이미지 연결 안내",
        tone: "info",
      });
      return;
    }

    setImages((current) => {
      const retainedImages = current.filter(hasRealImageSource);
      const shouldBecomePrimary = !retainedImages.some((image) => image.src);
      const nextImage = normalizeEditableImage(
        mediaAssetToProductImage(asset),
        current.length,
      );

      return ensureSinglePrimary([
        ...retainedImages.map((image) => ({
          ...image,
          isListImage: shouldBecomePrimary ? false : image.isListImage,
          isPrimary: shouldBecomePrimary ? false : image.isPrimary,
        })),
        {
          ...nextImage,
          isDetail: !shouldBecomePrimary,
          isListImage: shouldBecomePrimary,
          isPrimary: shouldBecomePrimary,
        },
      ]);
    });
    setStatus({
      description: "상품 저장을 누르면 이 미디어 연결이 반영됩니다.",
      title: "라이브러리 이미지를 연결했습니다",
      tone: "success",
    });
  }

  async function cancelPendingImage(image: EditableProductImage) {
    if (!image.storagePath) {
      return;
    }

    setStatus({
      description: "선택한 업로드 이미지를 storage에서 제거하고 있습니다.",
      title: "업로드 이미지 정리 중",
      tone: "info",
    });

    try {
      await cleanupPendingProductImages(productId, [image.storagePath]);
      setImages((current) =>
        ensureSinglePrimary(current.filter((item) => item.id !== image.id)),
      );
      setStatus({
        description: "선택한 이미지가 목록에서 제거되었습니다.",
        title: "업로드 이미지를 정리했습니다",
        tone: "success",
      });
    } catch (error) {
      setStatus({
        action: "편집 화면을 새로고침한 뒤 이미지 목록을 다시 확인해 주세요.",
        description:
          error instanceof Error
            ? error.message
            : "이미지 정리에 실패했습니다.",
        title: "업로드 이미지 정리 실패",
        tone: "error",
      });
    }
  }

  return (
    <section className="admin-product-image-manager">
      <input form={formId} name="imagesJson" type="hidden" value={imagesJson} />

      <div className="admin-product-image-head">
        <div>
          <h3>상품 이미지</h3>
          <p>jpg, png, webp를 업로드하면 자동으로 webp로 변환됩니다.</p>
        </div>
        <label className="admin-secondary-button admin-upload-button">
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void uploadImage(file);
              }
            }}
            ref={fileInputRef}
            type="file"
          />
          {isUploading ? "업로드 중" : "이미지 추가"}
        </label>
      </div>

      {status ? <AdminUploadFeedbackMessage feedback={status} /> : null}
      {pendingStoragePaths.length > 0 ? (
        <div className="admin-pending-upload-actions">
          <span>{pendingStoragePaths.length}개 이미지가 아직 저장되지 않았습니다.</span>
          <button
            className="admin-danger-inline-button"
            onClick={() => {
              void discardPendingUploads();
            }}
            type="button"
          >
            저장 전 업로드 취소
          </button>
        </div>
      ) : null}

      {mediaAssets.length > 0 ? (
        <MediaPicker
          assets={mediaAssets}
          disabledAssetIds={images
            .map((image) => image.id)
            .filter((id): id is string => Boolean(id))}
          onSelect={addLibraryImage}
          title="상품 이미지로 재사용"
        />
      ) : null}

      {images.length > 0 ? (
        <div className="admin-product-image-list">
          {images.map((image, index) => {
            const previewSrc =
              pickVariantSource(image.variants, "thumbnail")?.src ?? image.src;

            return (
              <article className="admin-product-image-item" key={image.id}>
              {previewSrc ? (
                <img alt={image.alt} src={previewSrc} />
              ) : (
                <div className="admin-product-image-placeholder">
                  {image.placeholderLabel ?? "이미지 없음"}
                </div>
              )}
              <div className="admin-product-image-fields">
                <label>
                  <span>대체 텍스트</span>
                  <input
                    onChange={(event) =>
                      updateImage(image.id, { alt: event.target.value }, setImages)
                    }
                    value={image.alt}
                  />
                </label>
                <div className="admin-product-image-controls">
                  <label>
                    <input
                      checked={image.isPrimary}
                      name="primaryProductImage"
                      onChange={() =>
                        setImages((current) =>
                          setSingleRole(current, image.id, "isPrimary"),
                        )
                      }
                      type="radio"
                    />
                    <span>대표</span>
                  </label>
                  <label>
                    <input
                      checked={Boolean(image.isListImage)}
                      name="listProductImage"
                      onChange={() =>
                        setImages((current) =>
                          setSingleRole(current, image.id, "isListImage"),
                        )
                      }
                      type="radio"
                    />
                    <span>목록</span>
                  </label>
                  <label>
                    <input
                      checked={Boolean(image.isDetail)}
                      onChange={(event) =>
                        updateImage(
                          image.id,
                          { isDetail: event.target.checked },
                          setImages,
                        )
                      }
                      type="checkbox"
                    />
                    <span>상세</span>
                  </label>
                  <label>
                    <input
                      checked={Boolean(image.isDescription)}
                      onChange={(event) =>
                        updateImage(
                          image.id,
                          { isDescription: event.target.checked },
                          setImages,
                        )
                      }
                      type="checkbox"
                    />
                    <span>설명</span>
                  </label>
                  <button
                    className="admin-text-button"
                    disabled={index === 0}
                    onClick={() =>
                      setImages((current) => moveImage(current, index, -1))
                    }
                    type="button"
                  >
                    위로
                  </button>
                  <button
                    className="admin-text-button"
                    disabled={index === images.length - 1}
                    onClick={() =>
                      setImages((current) => moveImage(current, index, 1))
                    }
                    type="button"
                  >
                    아래로
                  </button>
                  {image.storagePath && !initialStoragePaths.has(image.storagePath) ? (
                    <button
                      className="admin-danger-inline-button"
                      onClick={() => {
                        void cancelPendingImage(image);
                      }}
                      type="button"
                    >
                      업로드 취소
                    </button>
                  ) : (
                    <button
                      className="admin-danger-inline-button"
                      form={formId}
                      formAction={deleteProductImageAction}
                      name="imageId"
                      type="submit"
                      value={image.id}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="admin-empty-text">아직 등록된 상품 이미지가 없습니다.</p>
      )}
    </section>
  );
}

function mediaAssetToProductImage(asset: MediaPickerAsset): ProductImage {
  const detail = pickMediaVariantForSurface(asset, "detail");
  const variants = buildMediaVariantSources(asset);

  return {
    alt: asset.alt,
    caption: asset.caption,
    height: detail?.height ?? asset.height,
    id: asset.id,
    isDetail: true,
    isListImage: false,
    isPrimary: false,
    src: detail?.src ?? asset.src,
    storagePath: asset.masterPath,
    variants,
    width: detail?.width ?? asset.width,
  };
}

function normalizeEditableImage(
  image: ProductImage,
  index: number,
): EditableProductImage {
  return {
    ...image,
    alt: image.alt || "상품 이미지",
    id: image.id || `product-image-${index}-${image.src || image.placeholderLabel || "empty"}`,
    isDescription: Boolean(image.isDescription),
    isDetail: Boolean(image.isDetail),
    isListImage: Boolean(image.isListImage),
    isPrimary: Boolean(image.isPrimary),
  };
}

function hasRealImageSource(image: ProductImage) {
  return Boolean(image.src || image.cafe24ImagePath);
}

function ensureSinglePrimary(images: EditableProductImage[]) {
  const primaryIndex = images.findIndex((image) => image.isPrimary);
  const nextPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const listIndex = images.findIndex((image) => image.isListImage);
  const nextListIndex = listIndex >= 0 ? listIndex : nextPrimaryIndex;

  return images.map((image, index) => ({
    ...image,
    isListImage: index === nextListIndex,
    isPrimary: index === nextPrimaryIndex,
  }));
}

function updateImage(
  imageId: string,
  patch: Partial<EditableProductImage>,
  setImages: Dispatch<SetStateAction<EditableProductImage[]>>,
) {
  setImages((current) =>
    current.map((image) =>
      image.id === imageId
        ? {
            ...image,
            ...patch,
          }
        : image,
    ),
  );
}

function setSingleRole(
  images: EditableProductImage[],
  imageId: string,
  role: "isListImage" | "isPrimary",
) {
  return images.map((image) => ({
    ...image,
    [role]: image.id === imageId,
  }));
}

function moveImage(
  images: EditableProductImage[],
  index: number,
  direction: -1 | 1,
) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= images.length) {
    return images;
  }

  const nextImages = [...images];
  const [image] = nextImages.splice(index, 1);
  nextImages.splice(nextIndex, 0, image);

  return ensureSinglePrimary(nextImages);
}

async function cleanupPendingProductImages(
  productId: string,
  storagePaths: string[],
  keepalive = false,
) {
  const uniqueStoragePaths = [...new Set(storagePaths)];

  if (uniqueStoragePaths.length === 0) {
    return;
  }

  const request = fetch("/api/uploads/product-image/cleanup", {
    body: JSON.stringify({
      productId,
      storagePaths: uniqueStoragePaths,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive,
    method: "POST",
  });

  if (keepalive) {
    void request.catch(() => {});
    return;
  }

  const response = await request;
  const payload = await readAdminUploadPayload<{
    message?: string;
    ok?: boolean;
  }>(response);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "이미지 정리에 실패했습니다.");
  }
}
