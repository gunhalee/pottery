"use client";

import { useMemo, useState } from "react";
import { AdminMediaAssetThumbnail } from "@/components/admin/admin-media-thumbnail";
import { AdminEmptyText } from "@/components/admin/admin-actions";
import { buildMediaVariantSources } from "@/lib/media/media-variant-policy";
import { getVariantStatusLabel } from "@/lib/media/media-editor-status";
import type { MediaAsset, MediaVariantName } from "@/lib/media/media-model";

export type MediaPickerAsset = MediaAsset & {
  usageCount?: number;
};

type MediaPickerProps = {
  assets: MediaPickerAsset[];
  disabledAssetIds?: string[];
  emptyText?: string;
  onSelect: (asset: MediaPickerAsset) => void;
  requiredVariants?: readonly MediaVariantName[];
  title?: string;
};

const defaultRequiredVariants = [
  "detail",
  "list",
  "master",
  "thumbnail",
] as const satisfies readonly MediaVariantName[];

export function MediaPicker({
  assets,
  disabledAssetIds = [],
  emptyText = "선택할 수 있는 미디어가 없습니다.",
  onSelect,
  requiredVariants = defaultRequiredVariants,
  title = "라이브러리에서 선택",
}: MediaPickerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "issues" | "unused">("all");
  const disabledIds = useMemo(
    () => new Set(disabledAssetIds),
    [disabledAssetIds],
  );
  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const missingVariants = getMissingVariants(asset, requiredVariants);
      const searchable = [
        asset.alt,
        asset.artworkTitle,
        asset.caption,
        asset.masterPath,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "issues" && missingVariants.length > 0) ||
        (filter === "unused" && (asset.usageCount ?? 0) === 0);

      return matchesQuery && matchesFilter;
    });
  }, [assets, filter, query, requiredVariants]);

  return (
    <section className="admin-media-picker">
      <div className="admin-media-picker-head">
        <strong>{title}</strong>
        <span>{filteredAssets.length} assets</span>
      </div>
      <div className="admin-media-picker-controls">
        <input
          aria-label="미디어 검색"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="제목, alt, 경로 검색"
          value={query}
        />
        <select
          aria-label="미디어 필터"
          onChange={(event) =>
            setFilter(event.target.value as "all" | "issues" | "unused")
          }
          value={filter}
        >
          <option value="all">전체</option>
          <option value="issues">variant 점검 필요</option>
          <option value="unused">미사용</option>
        </select>
      </div>
      {filteredAssets.length > 0 ? (
        <div className="admin-media-picker-grid">
          {filteredAssets.map((asset) => {
            const missingVariants = getMissingVariants(asset, requiredVariants);
            const variantLabel = getVariantStatusLabel(
              buildMediaVariantSources(asset),
            );
            const disabled = disabledIds.has(asset.id);

            return (
              <button
                className="admin-media-picker-item"
                disabled={disabled}
                key={asset.id}
                onClick={() => onSelect(asset)}
                type="button"
              >
                <AdminMediaAssetThumbnail asset={asset} />
                <span>{asset.artworkTitle ?? asset.alt}</span>
                <small>
                  {disabled
                    ? "이미 연결됨"
                    : missingVariants.length > 0
                      ? `${variantLabel} / missing ${missingVariants.join(", ")}`
                      : `${variantLabel} / ${asset.usageCount ?? 0} usages`}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <AdminEmptyText>{emptyText}</AdminEmptyText>
      )}
    </section>
  );
}

function getMissingVariants(
  asset: MediaPickerAsset,
  requiredVariants: readonly MediaVariantName[],
) {
  const sources = buildMediaVariantSources(asset);
  return requiredVariants.filter((variant) => !sources[variant]?.src);
}
