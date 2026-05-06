"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import {
  buildMediaVariantSources,
  pickMediaVariantForSurface,
} from "@/lib/media/media-variant-policy";
import type { MediaAsset } from "@/lib/media/media-model";

export type MediaPickerAsset = MediaAsset & {
  usageCount?: number;
};

type MediaPickerProps = {
  assets: MediaPickerAsset[];
  disabledAssetIds?: string[];
  emptyText?: string;
  onSelect: (asset: MediaPickerAsset) => void;
  title?: string;
};

const requiredVariants = ["detail", "list", "master", "thumbnail"] as const;

export function MediaPicker({
  assets,
  disabledAssetIds = [],
  emptyText = "선택할 수 있는 미디어가 없습니다.",
  onSelect,
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
      const missingVariants = getMissingVariants(asset);
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
  }, [assets, filter, query]);

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
            const thumbnail = pickMediaVariantForSurface(asset, "thumbnail");
            const missingVariants = getMissingVariants(asset);
            const disabled = disabledIds.has(asset.id);

            return (
              <button
                className="admin-media-picker-item"
                disabled={disabled}
                key={asset.id}
                onClick={() => onSelect(asset)}
                type="button"
              >
                <img alt={asset.alt} src={thumbnail?.src ?? asset.src} />
                <span>{asset.artworkTitle ?? asset.alt}</span>
                <small>
                  {disabled
                    ? "이미 연결됨"
                    : missingVariants.length > 0
                      ? `${missingVariants.join(", ")} 누락`
                      : `${asset.usageCount ?? 0} usages`}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="admin-empty-text">{emptyText}</p>
      )}
    </section>
  );
}

function getMissingVariants(asset: MediaPickerAsset) {
  const sources = buildMediaVariantSources(asset);
  return requiredVariants.filter((variant) => !sources[variant]?.src);
}
